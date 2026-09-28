/**
 * Canonical URLs for Cori Scout deduplication (spec §5).
 * Pure — shared by the Cori agent and the CORTX app.
 */

// Query params that never change what a resource is
const TRACKING_PARAMS = /^(utm_[a-z_]+|fbclid|gclid|mc_cid|mc_eid|ref|ref_src)$/i;

/**
 * Returns the canonical form of an endpoint URL, or null if it isn't a usable
 * https URL. Rules: lowercase scheme/host (punycode via URL), drop default port,
 * fragment, credentials and tracking params, collapse duplicate slashes, strip
 * one trailing slash (not the root), sort remaining query params. Path case is
 * preserved (paths are case-sensitive).
 */
export function canonicalUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  url.username = '';
  url.password = '';
  url.hash = '';
  if (url.port === '443') url.port = '';

  let path = url.pathname.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  url.pathname = path;

  const params = [...url.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.test(k))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  url.search = '';
  for (const [k, v] of params) url.searchParams.append(k, v);

  return url.toString();
}

export function hostOf(canonical: string): string {
  return new URL(canonical).hostname;
}

// Groups related resources (same host + path, different query) without merging them.
export function groupKey(canonical: string): string {
  const u = new URL(canonical);
  return `${u.hostname}${u.pathname}`;
}
