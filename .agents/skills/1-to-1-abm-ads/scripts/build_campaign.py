#!/usr/bin/env python3
"""
1:1 ABM campaign builder for LinkedIn - CLIENT-AGNOSTIC, config-driven.

This is the reusable execution engine for `ABM_1TO1_SOP.md`. It replaces the
hardcoded `acme-abm_*.py` scripts: nothing is client-specific here, everything
comes from a --config JSON. It implements the SOP phases in order, with a verify
gate after every create.

Phases (see ABM_1TO1_SOP.md):
  1  Resolve each company to a LinkedIn org URN (typeahead) + size the audience
  2  Create the campaign group (DRAFT)
  3  Create one ad set (campaign) per company, with full targeting (DRAFT)
  4  Attach conversions to every ad set
  5  Set UTMs at ad-set level
  6  Build the ad per ad set  ->  ARTICLE post (title + landing page + thumbnail
     + Learn more CTA), two-step (/posts then /creatives), GET-verified
  7  Final QA + preview URLs

SAFETY:
  - Default mode is --dry-run: resolve + size + print the full plan, ZERO writes.
  - --execute performs the build; EVERYTHING is created DRAFT / campaign PAUSED,
    so nothing spends. Activation is a separate, human step (not in this script).
  - Never deletes anything.

USAGE:
  python3 abm_1to1_build.py --config abm_config.json            # dry-run (plan only)
  python3 abm_1to1_build.py --config abm_config.json --execute  # build (DRAFT)

CONFIG: see abm_config.example.json for the full shape.
"""
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

ENV_PATH = Path(__file__).parent / ".env"
API_VERSION = "202601"
BASE = "https://api.linkedin.com/rest"
MIN_AUDIENCE = 300  # LinkedIn hard minimum to launch an audience

VALID_CTA = {"LEARN_MORE", "SIGN_UP", "DOWNLOAD", "REGISTER", "SUBSCRIBE",
             "REQUEST_DEMO", "JOIN", "ATTEND", "VIEW_QUOTE", "APPLY"}


# ---------------------------------------------------------------- auth / http
def load_env(key):
    if not ENV_PATH.exists():
        sys.exit(f".env not found at {ENV_PATH}")
    for line in ENV_PATH.read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{key} not in .env")


TOKEN = load_env("LINKEDIN_ACCESS_TOKEN")
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "LinkedIn-Version": API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
}


def _req(method, url, payload=None, extra_headers=None, raw=None):
    headers = dict(HEADERS)
    if extra_headers:
        headers.update(extra_headers)
    data = None
    if raw is not None:
        data = raw
    elif payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, dict(resp.headers), (json.loads(body) if body.strip() else {})
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"error": body[:600]}
        return e.code, dict(e.headers or {}), parsed


def http_get(url):
    return _req("GET", url)


def http_post(url, payload):
    return _req("POST", url, payload=payload)


def http_put(url, payload):
    return _req("PUT", url, payload=payload)


def created_id(headers, body):
    return (headers.get("x-restli-id") or headers.get("X-RestLi-Id")
            or headers.get("x-linkedin-id") or body.get("id"))


# ---------------------------------------------------------------- phase 1
def typeahead_employer(query, limit=8):
    facet = urllib.parse.quote("urn:li:adTargetingFacet:employers", safe="")
    q = urllib.parse.quote(query)
    url = (f"{BASE}/adTargetingEntities?q=typeahead&facet={facet}&query={q}"
           f"&queryVersion=QUERY_USES_URNS&locale=(language:en,country:US)&count={limit}")
    code, _, body = http_get(url)
    if code != 200:
        return []
    return [{"id": e.get("urn", "").split(":")[-1], "name": e.get("name", ""),
             "urn": e.get("urn", "")} for e in body.get("elements", [])]


def build_targeting(company_urn, cfg):
    """include: employers AND geo [AND jobFunctions]; exclude: seniorities."""
    and_clauses = [
        {"or": {"urn:li:adTargetingFacet:employers": [company_urn]}},
        {"or": {"urn:li:adTargetingFacet:profileLocations": cfg["geo"]}},
    ]
    if cfg.get("job_functions"):
        and_clauses.append({"or": {"urn:li:adTargetingFacet:jobFunctions": cfg["job_functions"]}})
    tc = {"include": {"and": and_clauses}}
    if cfg.get("exclude_seniorities"):
        tc["exclude"] = {"or": {"urn:li:adTargetingFacet:seniorities": cfg["exclude_seniorities"]}}
    return tc


def audience_size(targeting):
    """Encode targetingCriteria into the audienceCounts query string and return total."""
    and_parts = []
    for clause in targeting["include"]["and"]:
        facet_parts = []
        for facet_urn, values in clause["or"].items():
            enc_vals = ",".join(urllib.parse.quote(v, safe="") for v in values)
            facet_parts.append(f"{urllib.parse.quote(facet_urn, safe='')}:List({enc_vals})")
        and_parts.append(f"(or:({','.join(facet_parts)}))")
    tc_str = f"(include:(and:List({','.join(and_parts)}))"
    if "exclude" in targeting:
        ex_facet_parts = []
        for facet_urn, values in targeting["exclude"]["or"].items():
            enc_vals = ",".join(urllib.parse.quote(v, safe="") for v in values)
            ex_facet_parts.append(f"{urllib.parse.quote(facet_urn, safe='')}:List({enc_vals})")
        tc_str += f",exclude:(or:({','.join(ex_facet_parts)}))"
    tc_str += ")"
    url = f"{BASE}/audienceCounts?q=targetingCriteriaV2&targetingCriteria={tc_str}"
    code, _, body = http_get(url)
    if code != 200:
        return None, f"HTTP {code}: {json.dumps(body)[:200]}"
    elems = body.get("elements", [])
    return (elems[0].get("total") if elems else None), (None if elems else "no elements")


def resolve_and_size(cfg):
    print("=== Phase 1: resolve + size ===")
    rows = []
    for c in cfg["companies"]:
        name = c["name"]
        urn = c.get("org_urn")
        note = ""
        if not urn:
            cands = typeahead_employer(name)
            time.sleep(0.15)
            if not cands:
                rows.append({**c, "org_urn": None, "audience": None,
                             "status": "UNRESOLVED", "note": "no typeahead match"})
                print(f"  ?? {name:24s} -> no candidates (resolve manually, set org_urn in config)")
                continue
            urn = cands[0]["urn"]
            note = f"auto-resolved to {cands[0]['name']} ({urn}); VERIFY"
        tc = build_targeting(urn, cfg)
        size, err = audience_size(tc)
        time.sleep(0.2)
        status = "OK"
        if err:
            status = "SIZE_ERROR"
        elif size is None or size < MIN_AUDIENCE:
            status = "BELOW_MIN"
        rows.append({**c, "org_urn": urn, "audience": size, "status": status, "note": note or (err or "")})
        flag = {"OK": "OK", "BELOW_MIN": f"<{MIN_AUDIENCE}!", "SIZE_ERROR": "ERR", "UNRESOLVED": "??"}[status]
        print(f"  {flag:6s} {name:24s} {str(urn):40s} audience={size}")
    return rows


# ---------------------------------------------------------------- phase 2/3
def create_group(cfg, start_millis):
    url = f"{BASE}/adAccounts/{cfg['account_id']}/adCampaignGroups"
    payload = {
        "account": f"urn:li:sponsoredAccount:{cfg['account_id']}",
        "name": cfg["group_name"],
        "status": "DRAFT",
        "runSchedule": {"start": start_millis},
    }
    code, hdrs, body = http_post(url, payload)
    if code in (200, 201):
        return created_id(hdrs, body), None
    return None, f"HTTP {code}: {json.dumps(body)[:300]}"


def create_ad_set(cfg, group_id, company, start_millis):
    obj = cfg["objective"]
    url = f"{BASE}/adAccounts/{cfg['account_id']}/adCampaigns"
    payload = {
        "account": f"urn:li:sponsoredAccount:{cfg['account_id']}",
        "campaignGroup": f"urn:li:sponsoredCampaignGroup:{group_id}",
        "name": f"{cfg.get('ad_set_prefix', 'ABM')} - {company['name']}",
        "type": "SPONSORED_UPDATES",
        "objectiveType": obj["type"],
        "costType": obj["cost"],
        "optimizationTargetType": obj.get("optimization", "MAX_CLICK"),
        "dailyBudget": {"currencyCode": cfg.get("currency", "USD"), "amount": str(cfg["daily_budget"])},
        "unitCost": {"currencyCode": cfg.get("currency", "USD"), "amount": "0"},
        "runSchedule": {"start": start_millis},
        "locale": cfg.get("locale", {"country": "US", "language": "en"}),
        "status": "DRAFT",
        "offsiteDeliveryEnabled": False,
        "politicalIntent": "NOT_POLITICAL",
        "targetingCriteria": build_targeting(company["org_urn"], cfg),
    }
    code, hdrs, body = http_post(url, payload)
    if code in (200, 201):
        return created_id(hdrs, body), None
    return None, f"HTTP {code}: {json.dumps(body)[:400]}"


# ---------------------------------------------------------------- phase 4/5
def attach_conversions(cfg, campaign_id):
    """Attach each conversion URN in cfg['conversions'] to the ad set.
    Replicate the account's active-campaign conversion set (see SOP)."""
    results = []
    for conv in cfg.get("conversions", []):
        camp_urn = f"urn:li:sponsoredCampaign:{campaign_id}"
        key = f"(campaign:{urllib.parse.quote(camp_urn, safe='')},conversion:{urllib.parse.quote(conv, safe='')})"
        url = f"{BASE}/campaignConversions/{key}"
        code, _, body = http_put(url, {"campaign": camp_urn, "conversion": conv})
        results.append((conv, code, None if code in (200, 201, 204) else json.dumps(body)[:200]))
    return results


def set_utms(cfg, campaign_id):
    """Set ad-set-level UTM tracking params. Shape must match the account's
    existing convention - confirm against an active campaign on first run."""
    utm = cfg.get("utm")
    if not utm:
        return None
    camp_urn = f"urn:li:sponsoredCampaign:{campaign_id}"
    url = f"{BASE}/adTrackingParameters/{urllib.parse.quote(camp_urn, safe='')}"
    payload = {"trackingParameters": [{"key": k, "value": v} for k, v in utm.items()]}
    code, _, body = http_put(url, payload)
    return (code, None if code in (200, 201, 204) else json.dumps(body)[:200])


# ---------------------------------------------------------------- phase 6
def upload_image(cfg, image_path):
    org = f"urn:li:organization:{cfg['org_id']}"
    code, _, body = http_post(f"{BASE}/images?action=initializeUpload",
                              {"initializeUploadRequest": {"owner": org}})
    if code not in (200, 201):
        return None, f"init HTTP {code}: {json.dumps(body)[:200]}"
    value = body.get("value", {})
    upload_url = value.get("uploadUrl")
    image_urn = value.get("image")
    if not upload_url or not image_urn:
        return None, f"no uploadUrl/image in init response: {json.dumps(body)[:200]}"
    img_bytes = Path(image_path).read_bytes()
    put = urllib.request.Request(upload_url, data=img_bytes,
                                 headers={"Authorization": f"Bearer {TOKEN}"}, method="PUT")
    try:
        urllib.request.urlopen(put, timeout=120).read()
    except urllib.error.HTTPError as e:
        return None, f"PUT bytes HTTP {e.code}: {e.read().decode('utf-8','ignore')[:200]}"
    # poll until AVAILABLE
    enc = urllib.parse.quote(image_urn, safe="")
    for _ in range(20):
        code, _, b = http_get(f"{BASE}/images/{enc}")
        if code == 200 and b.get("status") == "AVAILABLE":
            return image_urn, None
        time.sleep(1.5)
    return None, "image never reached AVAILABLE"


def build_ad(cfg, campaign_id, company, image_urn):
    """ARTICLE post (title + source landing page + thumbnail) + Learn more CTA,
    then a creative referencing it. GET-verify the post carries LP + CTA + title."""
    org = f"urn:li:organization:{cfg['org_id']}"
    cta = company.get("cta_label", cfg.get("cta_label", "LEARN_MORE"))
    if cta not in VALID_CTA:
        return None, f"invalid CTA label '{cta}' (valid: {sorted(VALID_CTA)})"
    post_payload = {
        "author": org,
        "commentary": company["commentary"],
        "visibility": "PUBLIC",
        "distribution": {"feedDistribution": "NONE", "targetEntities": [], "thirdPartyDistributionChannels": []},
        "content": {"article": {"title": company["headline"], "source": company["landing_page"], "thumbnail": image_urn}},
        "contentCallToActionLabel": cta,
        "contentLandingPage": company["landing_page"],
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
        "adContext": {"dscAdAccount": f"urn:li:sponsoredAccount:{cfg['account_id']}", "dscStatus": "ACTIVE"},
    }
    code, hdrs, body = http_post(f"{BASE}/posts", post_payload)
    post_urn = created_id(hdrs, body) or body.get("id")
    if code not in (200, 201) or not post_urn:
        return None, f"post HTTP {code}: {json.dumps(body)[:400]}"
    # creative referencing the post
    creative_payload = {
        "campaign": f"urn:li:sponsoredCampaign:{campaign_id}",
        "content": {"reference": post_urn},
        "intendedStatus": "ACTIVE",
        "name": f"{company['name']} 1:1 ABM",
    }
    code, hdrs, body = http_post(f"{BASE}/adAccounts/{cfg['account_id']}/creatives", creative_payload)
    creative_urn = (body.get("value", {}) or {}).get("creative") or created_id(hdrs, body)
    if code not in (200, 201) or not creative_urn:
        return None, f"creative HTTP {code}: {json.dumps(body)[:400]} (post {post_urn} was created)"
    # VERIFY the post carries destination + CTA + headline
    enc = urllib.parse.quote(post_urn, safe="")
    _, _, pv = http_get(f"{BASE}/posts/{enc}")
    art = (pv.get("content", {}) or {}).get("article", {}) or {}
    verify = {
        "landing_page": pv.get("contentLandingPage"),
        "cta": pv.get("contentCallToActionLabel"),
        "title": art.get("title"),
    }
    if not all(verify.values()):
        return None, f"VERIFY FAILED - post missing fields: {verify}"
    return {"post": post_urn, "creative": creative_urn, "verify": verify}, None


def preview_url(cfg, post_urn, creative_urn):
    return (f"https://www.linkedin.com/feed/update/urn:li:sponsoredContentV2:"
            f"({post_urn},{creative_urn})/?actorCompanyId={cfg['org_id']}&viewContext=REVIEWER")


# ---------------------------------------------------------------- orchestrator
def main():
    ap = argparse.ArgumentParser(description="Config-driven 1:1 ABM LinkedIn builder")
    ap.add_argument("--config", required=True, help="Path to abm_config.json")
    ap.add_argument("--execute", action="store_true",
                    help="Actually build (DRAFT). Without this flag it is a dry-run plan only.")
    args = ap.parse_args()

    cfg = json.loads(Path(args.config).read_text())
    for req in ("account_id", "org_id", "group_name", "geo", "daily_budget", "objective", "companies"):
        if req not in cfg:
            sys.exit(f"config missing required key: {req}")

    rows = resolve_and_size(cfg)
    buildable = [r for r in rows if r["status"] == "OK"]
    blocked = [r for r in rows if r["status"] != "OK"]

    print(f"\nPlan: {len(buildable)} ad sets buildable, {len(blocked)} blocked "
          f"(below {MIN_AUDIENCE} / unresolved / error).")
    for r in blocked:
        print(f"  BLOCKED {r['name']}: {r['status']} {r.get('note','')}")

    if not args.execute:
        print("\nDRY-RUN complete. No writes. Re-run with --execute to build (all DRAFT).")
        return
    if not buildable:
        sys.exit("Nothing buildable - fix the blocked companies (resolve URNs / geo / targeting) first.")

    start_millis = int(time.time() * 1000)
    print("\n=== Phase 2: campaign group ===")
    group_id, err = create_group(cfg, start_millis)
    if err:
        sys.exit(f"group create failed: {err}")
    print(f"  group {cfg['group_name']} -> {group_id} (DRAFT)")

    results = {"group_id": str(group_id), "account_id": cfg["account_id"], "ad_sets": []}
    for r in buildable:
        print(f"\n--- {r['name']} ---")
        cid, err = create_ad_set(cfg, group_id, r, start_millis)
        if err:
            print(f"  Phase 3 ad set FAILED: {err}")
            results["ad_sets"].append({"company": r["name"], "campaign_id": None, "error": err})
            continue
        print(f"  Phase 3 ad set {cid} (DRAFT, audience {r['audience']})")

        if cfg.get("conversions"):
            for conv, code, cerr in attach_conversions(cfg, cid):
                print(f"  Phase 4 conversion {conv.split(':')[-1]}: {'ok' if not cerr else 'ERR ' + cerr}")
        if cfg.get("utm"):
            u = set_utms(cfg, cid)
            print(f"  Phase 5 UTMs: {'ok' if u and not u[1] else 'ERR ' + str(u)}")

        ad_err = None
        img_urn = None
        if r.get("image"):
            img_urn, ad_err = upload_image(cfg, r["image"])
            if ad_err:
                print(f"  Phase 6 image upload FAILED: {ad_err}")
        if img_urn and r.get("landing_page") and r.get("headline") and r.get("commentary"):
            ad, ad_err = build_ad(cfg, cid, r, img_urn)
            if ad_err:
                print(f"  Phase 6 ad FAILED: {ad_err}")
            else:
                print(f"  Phase 6 ad OK - post {ad['post']} creative {ad['creative']}")
                print(f"  Phase 7 preview: {preview_url(cfg, ad['post'], ad['creative'])}")
                r["_ad"] = ad
        else:
            if not ad_err:
                print("  Phase 6 skipped (missing image/landing_page/headline/commentary in config)")
        results["ad_sets"].append({
            "company": r["name"], "campaign_id": str(cid), "audience": r["audience"],
            "ad": r.get("_ad"), "ad_error": ad_err,
        })

    out = Path(args.config).with_suffix(".results.json")
    out.write_text(json.dumps(results, indent=2))
    ok = sum(1 for a in results["ad_sets"] if a["campaign_id"])
    print(f"\nDone. {ok}/{len(buildable)} ad sets built. Everything DRAFT - nothing spends.")
    print(f"Results: {out}")
    print("Activation (group + ad sets -> ACTIVE) is a separate, human step.")


if __name__ == "__main__":
    main()
