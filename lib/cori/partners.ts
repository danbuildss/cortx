/**
 * Known x402 projects (Q2, approved Oct 10): a frozen copy of the x402.org
 * ecosystem list (partners.json, from coinbase/x402, Apache-2.0). The x402
 * Foundation later removed that page in favour of community directories, so
 * the list is updated by hand, by PR.
 *
 * Their companies go to the top of the review page with an "x402 ecosystem"
 * badge, pass the quality gate like the watch list, and don't need the
 * website check to be proposed. Pure: no network.
 */
import data from './partners.json' with { type: 'json' };
import { companyOf } from './quality';

export type Partner = {
  slug: string;
  name: string;
  category: string;
  websiteUrl: string;
  description: string;
  domain: string;
};

// Paid services first, so a company that's both a service and tooling is shown as a service
const CATEGORY_RANK: Record<string, number> = { 'Services/Endpoints': 0, 'Web3 Application & Infrastructure': 1 };

function domainOf(url: string): string | null {
  try {
    return companyOf(new URL(url).hostname);
  } catch {
    return null;
  }
}

export const PARTNERS: Partner[] = (data.partners as Array<Omit<Partner, 'domain'>>)
  .map((p) => ({ ...p, domain: domainOf(p.websiteUrl) ?? '' }))
  .filter((p) => p.domain !== '');

export const PARTNER_SNAPSHOT: string = data.snapshot;

const BY_DOMAIN = new Map<string, Partner>();
for (const p of [...PARTNERS].sort((a, b) => (CATEGORY_RANK[a.category] ?? 9) - (CATEGORY_RANK[b.category] ?? 9))) {
  if (!BY_DOMAIN.has(p.domain)) BY_DOMAIN.set(p.domain, p);
}

export function partnerFor(domain: string | null | undefined): Partner | null {
  return domain ? BY_DOMAIN.get(domain.toLowerCase()) ?? null : null;
}

export const PARTNER_DOMAINS: string[] = [...BY_DOMAIN.keys()];

/** Projects that sell paid endpoints (shown when Cori hasn't found their endpoint yet) */
export const SERVICE_PARTNERS: Partner[] = PARTNERS.filter((p) => p.category === 'Services/Endpoints');
