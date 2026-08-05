"""
1:1 ABM audience narrowing tool (READ-ONLY).

Implements ABM_AUDIENCE_NARROWING_SOP.md: takes one ABM account, sizes it through the
narrowing levers, prints the seniority mix + entry-level %, and outputs the recommended
targetingCriteria JSON for the ad set. It NEVER writes to the API - it only calls
audienceCounts. Hand the recommended targeting to ABM_1TO1_SOP.md Phase 3.

Usage:
  python3 abm_narrow_audience.py --org 3254263
  python3 abm_narrow_audience.py --slug robinhood --geo-mode light
  python3 abm_narrow_audience.py --org 3254263 --config narrow_config.json

Config JSON (all optional - sensible Acme SaaS defaults applied):
{
  "region":            ["urn:li:geo:102221843","urn:li:geo:100506914"],   # NA + Europe
  "buyer_functions":   ["urn:li:function:4","urn:li:function:15","urn:li:function:16","urn:li:function:18","urn:li:function:25"],
  "junior_seniorities":["urn:li:seniority:1","urn:li:seniority:2","urn:li:seniority:3"],
  "exclude_orgs":      ["urn:li:organization:75550113"],                   # advertiser's own org
  "light_geo_exclude": ["urn:li:country:il", ...],   # clearly-irrelevant countries (light-geo step)
  "primary_country":   ["urn:li:geo:103644278"],     # US - the final-geo / strict-geo target
  "buyer_titles":      ["urn:li:title:100","urn:li:title:200"],  # optional titles lever
  "yoe_include":       ["urn:li:yearsOfExperience:5","urn:li:yearsOfExperience:12"],  # optional YoE range
  "locale":            "urn:li:locale:en_US",
  "band":              {"min":300,"ideal_max":1000,"hard_max":1200}
}
"""
import argparse, json, sys, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path

ENV_PATH = Path(__file__).parent / ".env"
BASE = "https://api.linkedin.com/rest"
EMP = "urn:li:adTargetingFacet:employers"
GEO = "urn:li:adTargetingFacet:profileLocations"
FUN = "urn:li:adTargetingFacet:jobFunctions"
SEN = "urn:li:adTargetingFacet:seniorities"
TIT = "urn:li:adTargetingFacet:titles"
YOE = "urn:li:adTargetingFacet:yearsOfExperienceRanges"
LOC = "urn:li:adTargetingFacet:interfaceLocales"

SENIORITY_NAME = {1: "Unpaid", 2: "Training", 3: "Entry", 4: "Senior", 5: "Manager",
                  6: "Director", 7: "VP", 8: "CXO", 9: "Partner", 10: "Owner"}
ENTRY_TIER = [1, 2, 3]
DECISION_CLUSTER = [4, 5, 6, 7, 8]

DEFAULTS = {
    "region": ["urn:li:geo:102221843", "urn:li:geo:100506914"],
    "buyer_functions": ["urn:li:function:4", "urn:li:function:15", "urn:li:function:16",
                        "urn:li:function:18", "urn:li:function:25"],
    "junior_seniorities": ["urn:li:seniority:1", "urn:li:seniority:2", "urn:li:seniority:3"],
    "exclude_orgs": [],
    "light_geo_exclude": [],
    "primary_country": [],
    "buyer_titles": [],
    "yoe_include": [],
    "locale": "urn:li:locale:en_US",
    "band": {"min": 300, "ideal_max": 1000, "hard_max": 1200},
}


def env(key):
    for line in ENV_PATH.read_text().splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{key} not in .env")


TOKEN = env("LINKEDIN_ACCESS_TOKEN")
H = {"Authorization": f"Bearer {TOKEN}", "LinkedIn-Version": "202601", "X-Restli-Protocol-Version": "2.0.0"}
enc = lambda v: urllib.parse.quote(v, safe="")


def get(url):
    for a in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=30) as r:
                return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and a < 2:
                time.sleep(1.3); continue
            return e.code, e.read().decode()[:200]
        except Exception:
            if a < 2:
                time.sleep(1); continue
            return 0, "err"


def resolve_org(slug):
    """slug -> org urn via typeahead + vanity match (same as the sizing script)."""
    u = (f"{BASE}/adTargetingEntities?q=typeahead&facet={enc(EMP)}&query={enc(slug)}"
         f"&queryVersion=QUERY_USES_URNS&locale=(language:en,country:US)&count=8")
    c, b = get(u)
    if c != 200 or not b.get("elements"):
        return None
    ids = [e["urn"].split(":")[-1] for e in b["elements"][:5]]
    c2, b2 = get(f"{BASE}/organizationsLookup?ids=List({','.join(ids)})")
    results = (b2.get("results") or {}) if c2 == 200 else {}
    for e in b["elements"][:5]:
        oid = e["urn"].split(":")[-1]
        v = (results.get(oid, {}) or {}).get("vanityName", "")
        if v and v.lower() == slug.lower():
            return e["urn"]
    return b["elements"][0]["urn"]  # fallback (flag for manual verify)


def size(include_clauses, exclude_map=None):
    """include_clauses: list of (facet, [values]); exclude_map: {facet: [values]}."""
    inc = ",".join(
        f"(or:({enc(facet)}:List({','.join(enc(v) for v in vals)})))"
        for facet, vals in include_clauses if vals
    )
    crit = f"(include:(and:List({inc}))"
    if exclude_map:
        parts = ",".join(f"{enc(f)}:List({','.join(enc(v) for v in vs)})"
                         for f, vs in exclude_map.items() if vs)
        if parts:
            crit += f",exclude:(or:({parts}))"
    crit += ")"
    c, b = get(f"{BASE}/audienceCounts?q=targetingCriteriaV2&targetingCriteria={crit}")
    if c != 200:
        return None
    el = b.get("elements", [])
    return el[0].get("total") if el else None


def seniority_distribution(org, region):
    """Size per seniority 1-10 -> distribution + entry-level %."""
    base = [(EMP, [org]), (GEO, region)]
    total = size(base) or 0
    dist = {}
    for sid in range(1, 11):
        n = size(base + [(SEN, [f"urn:li:seniority:{sid}"])])
        dist[sid] = n or 0
        time.sleep(0.12)
    entry = sum(dist[s] for s in ENTRY_TIER)
    return total, dist, (entry / total * 100 if total else 0)


def narrow(org, cfg):
    region, band = cfg["region"], cfg["band"]
    geo_mode = cfg["geo_mode"]
    steps = []

    def record(label, inc, exc):
        n = size(inc, exc); time.sleep(0.12)
        steps.append({"step": label, "size": n, "include": inc, "exclude": exc or {}})
        return n

    # base
    inc = [(EMP, [org]), (GEO, region)]
    exc = {}
    if cfg["exclude_orgs"]:
        exc = {EMP: cfg["exclude_orgs"]}
    base_n = record("base (employers + region)", inc, exc)

    # ordered lever list per geo mode
    def lever_geo_strict():
        nonlocal inc
        if cfg["primary_country"]:
            inc = [(EMP, [org]), (GEO, cfg["primary_country"])]
            return record("strict geo (primary country)", inc, exc)
        return None

    def lever_geo_light():
        nonlocal exc
        if cfg["light_geo_exclude"]:
            exc = {**exc, GEO: cfg["light_geo_exclude"]}
            return record("light geo (exclude irrelevant countries)", inc, exc)
        return None

    def lever_function():
        nonlocal inc, exc
        inc = inc + [(FUN, cfg["buyer_functions"]), (LOC, [cfg["locale"]])]
        exc = {**exc, SEN: cfg["junior_seniorities"]}
        return record("job function + exclude junior seniority", inc, exc)

    def lever_titles():
        nonlocal inc, exc
        if not cfg["buyer_titles"]:
            return None
        # titles cannot AND with function/seniority in include -> titles in include, both in exclude
        geo_clause = [c for c in inc if c[0] == GEO]
        inc = [(EMP, [org]), (TIT, cfg["buyer_titles"])] + geo_clause + [(LOC, [cfg["locale"]])]
        exc = {**exc, SEN: cfg["junior_seniorities"], FUN: []}  # function-exclude optional; junior seniority kept
        exc = {k: v for k, v in exc.items() if v}
        return record("job titles (exclude junior seniority)", inc, exc)

    def lever_yoe():
        nonlocal inc
        if not cfg["yoe_include"]:
            return None
        inc = inc + [(YOE, cfg["yoe_include"])]
        return record("years-of-experience trim", inc, exc)

    def lever_final_geo():
        nonlocal inc
        if cfg["primary_country"]:
            inc = [(c[0], cfg["primary_country"]) if c[0] == GEO else c for c in inc]
            return record("final geo (narrow to primary country)", inc, exc)
        return None

    if geo_mode == "strict":
        sequence = [lever_geo_strict, lever_function, lever_titles, lever_yoe]
    else:
        sequence = [lever_geo_light, lever_function, lever_titles, lever_yoe, lever_final_geo]

    # walk: apply next lever only while still above ideal_max; back off if a lever drops below min
    last_ok_inc, last_ok_exc, last_ok_n = inc, dict(exc), base_n
    for lever in sequence:
        cur_n = size(last_ok_inc, last_ok_exc)
        if cur_n is not None and cur_n <= band["ideal_max"]:
            break
        prev_inc, prev_exc = [c for c in inc], dict(exc)
        n = lever()
        if n is None:  # lever not configured / no-op
            inc, exc = prev_inc, prev_exc
            continue
        if n >= band["min"]:
            last_ok_inc, last_ok_exc, last_ok_n = [c for c in inc], dict(exc), n
            if n <= band["ideal_max"]:
                break
        else:
            # too aggressive - revert this lever, keep the last in-band config, try next lever
            steps[-1]["reverted_below_min"] = True
            inc, exc = prev_inc, prev_exc

    return base_n, steps, (last_ok_inc, last_ok_exc, last_ok_n)


def verdict(n, band):
    if n is None:
        return "UNKNOWN"
    if n < band["min"]:
        return f"BELOW 300 - not runnable ({n})"
    if n <= band["ideal_max"]:
        return f"IN BAND (sweet spot) - {n}"
    if n <= band["hard_max"]:
        return f"IN BAND (fine) - {n}"
    if n < 2000:
        return f"ABOVE BAND - trim toward 1000 ({n})"
    return f"TOO BROAD - trim hard ({n})"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--org", help="LinkedIn organization id (numeric)")
    ap.add_argument("--slug", help="LinkedIn company slug (resolved to org)")
    ap.add_argument("--geo-mode", choices=["light", "strict"], default="light")
    ap.add_argument("--config", help="path to JSON config (optional)")
    ap.add_argument("--no-distribution", action="store_true", help="skip the per-seniority distribution (10 fewer calls)")
    args = ap.parse_args()

    cfg = dict(DEFAULTS)
    if args.config:
        cfg.update(json.load(open(args.config)))
    cfg["geo_mode"] = args.geo_mode

    if args.org:
        org = f"urn:li:organization:{args.org}"
    elif args.slug:
        org = resolve_org(args.slug)
        if not org:
            sys.exit(f"could not resolve slug '{args.slug}'")
    else:
        sys.exit("provide --org or --slug")

    print(f"Account: {org}   geo-mode: {cfg['geo_mode']}")
    print("=" * 72)

    if not args.no_distribution:
        total, dist, entry_pct = seniority_distribution(org, cfg["region"])
        print(f"Base audience (employers + region): {total:,}" if total else "Base audience: 0 / below threshold")
        print("Seniority mix:")
        for sid in sorted(dist, key=lambda s: -dist[s]):
            tag = " [ENTRY]" if sid in ENTRY_TIER else (" [decision]" if sid in DECISION_CLUSTER else "")
            print(f"  {SENIORITY_NAME[sid]:9s} {dist[sid]:>7,}{tag}")
        print(f"Entry-level share: {entry_pct:.1f}%  (target <=5%, ideally 0%)")
        print("-" * 72)

    base_n, steps, (final_inc, final_exc, final_n) = narrow(org, cfg)
    print("Narrowing walk:")
    for s in steps:
        flag = "  <-- dropped below 300, reverted" if s.get("reverted_below_min") else ""
        print(f"  {s['step']:48s} -> {str(s['size']):>8}{flag}")
    print("-" * 72)
    print(f"RECOMMENDATION: {verdict(final_n, cfg['band'])}")
    targeting = {"include": {"and": [{"or": {f: v}} for f, v in final_inc]}}
    if final_exc:
        targeting["exclude"] = {"or": {f: v for f, v in final_exc.items()}}
    print("targetingCriteria:")
    print(json.dumps(targeting, indent=2))


if __name__ == "__main__":
    main()
