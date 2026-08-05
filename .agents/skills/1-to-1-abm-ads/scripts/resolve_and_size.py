"""
STEP 1 of the 1:1 ABM pipeline - resolve each target company to its LinkedIn
organization URN and pull its addressable audience size (READ-ONLY).

Reads a CSV of accounts, resolves each company to a LinkedIn org (slug -> vanityName
match, most reliable; falls back to name typeahead), sizes it with
`employers + region` (the true 1:1 audience), and flags runnable (>= 300) vs not.

See sops/02-audience-sizing.md for the 300-member floor and sops/03-build-and-launch-sop.md Phase 1.

Input CSV (config/account_list.csv) needs at least ONE of:  name , linkedin_url
  name,linkedin_url
  Robinhood,https://www.linkedin.com/company/robinhood
  Plaid,https://www.linkedin.com/company/plaid-

Usage:
  python3 resolve_and_size.py                         # uses ../config/account_list.csv, NA+EU
  python3 resolve_and_size.py --in path.csv --out results.csv
  python3 resolve_and_size.py --region urn:li:geo:103644278   # e.g. US only

Requires scripts/.env with LINKEDIN_ACCESS_TOKEN (copy scripts/env.example.txt to scripts/.env).
"""
import argparse, csv, json, re, sys, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path

HERE = Path(__file__).parent
ENV_PATH = HERE / ".env"
BASE = "https://api.linkedin.com/rest"
EMP = "urn:li:adTargetingFacet:employers"
GEO = "urn:li:adTargetingFacet:profileLocations"
REGION_NA_EU = ["urn:li:geo:102221843", "urn:li:geo:100506914"]  # North America + Europe
FLOOR = 300


def env(key):
    if not ENV_PATH.exists():
        sys.exit(f".env not found at {ENV_PATH} (copy env.example.txt -> .env and fill it in)")
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


def slug_of(url):
    m = re.search(r"/company/([^/?]+)", str(url or ""))
    return m.group(1).strip().rstrip("/") if m else ""


def typeahead(q, n=8):
    u = (f"{BASE}/adTargetingEntities?q=typeahead&facet={enc(EMP)}&query={enc(q)}"
         f"&queryVersion=QUERY_USES_URNS&locale=(language:en,country:US)&count={n}")
    c, b = get(u)
    return [{"id": e["urn"].split(":")[-1], "urn": e["urn"], "name": e.get("name", "")}
            for e in b.get("elements", [])] if c == 200 else []


def lookup(ids):
    if not ids:
        return {}
    c, b = get(f"{BASE}/organizationsLookup?ids=List({','.join(ids)})")
    if c != 200:
        return {}
    return {k: {"vanity": v.get("vanityName", ""), "name": v.get("localizedName", "")}
            for k, v in (b.get("results") or {}).items()}


def resolve(name, url):
    slug = slug_of(url)
    for q in [x for x in (slug, name) if x]:
        cands = typeahead(q)
        time.sleep(0.12)
        if not cands:
            continue
        enr = lookup([c["id"] for c in cands[:5]]); time.sleep(0.12)
        # 1) vanity == slug  2) official name == name  3) first (flag)
        if slug:
            for c in cands[:5]:
                if (enr.get(c["id"], {}).get("vanity", "") or "").lower() == slug.lower():
                    return c["urn"], c["id"], enr[c["id"]]["vanity"], "vanity_matches_slug"
        for c in cands[:5]:
            if (enr.get(c["id"], {}).get("name", "") or "").lower() == (name or "").lower():
                return c["urn"], c["id"], enr.get(c["id"], {}).get("vanity", ""), "name_exact"
        c = cands[0]
        return c["urn"], c["id"], enr.get(c["id"], {}).get("vanity", ""), "first_unverified"
    return None, None, None, "unresolved"


def size(org_urn, region):
    emp = f"(or:({enc(EMP)}:List({enc(org_urn)})))"
    geo = f"(or:({enc(GEO)}:List({','.join(enc(g) for g in region)})))"
    c, b = get(f"{BASE}/audienceCounts?q=targetingCriteriaV2&targetingCriteria=(include:(and:List({emp},{geo})))")
    if c != 200:
        return None
    el = b.get("elements", [])
    return el[0].get("total") if el else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="infile", default=str(HERE.parent / "config" / "account_list.csv"))
    ap.add_argument("--out", dest="outfile", default=str(HERE.parent / "config" / "account_list_sized.csv"))
    ap.add_argument("--region", nargs="*", default=REGION_NA_EU, help="geo URN(s); default North America + Europe")
    args = ap.parse_args()

    rows = list(csv.DictReader(open(args.infile)))
    print(f"Sizing {len(rows)} accounts (region={args.region})\n")
    out = []
    for i, r in enumerate(rows, 1):
        name = (r.get("name") or "").strip()
        url = (r.get("linkedin_url") or r.get("linkedin") or "").strip()
        urn, oid, vanity, basis = resolve(name, url)
        n = size(urn, args.region) if urn else None
        time.sleep(0.15)
        runnable = "Yes" if isinstance(n, int) and n >= FLOOR else "No"
        out.append({"name": name, "linkedin_url": url, "org_id": oid or "",
                    "resolved_vanity": vanity or "", "audience_size": n if n is not None else "",
                    "can_run_300": runnable, "match_basis": basis})
        flag = "" if runnable == "Yes" else " (under 300)"
        vflag = "  [verify entity]" if basis == "first_unverified" else ""
        print(f"[{i:3d}/{len(rows)}] {name[:28]:28s} -> {str(oid):>10}  size={str(n):>8}{flag}{vflag}")

    with open(args.outfile, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
    runnable = sum(1 for r in out if r["can_run_300"] == "Yes")
    print(f"\nRunnable (>= {FLOOR}): {runnable}/{len(out)}   ->  wrote {args.outfile}")
    print("Next: narrow each runnable account with narrow_audience.py (sops/04-audience-narrowing-sop.md)")


if __name__ == "__main__":
    main()
