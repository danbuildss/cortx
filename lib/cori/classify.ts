/**
 * Cori Scout eligibility rules (spec §7). Deterministic and pure — no model,
 * no network. Rules are applied in order; the first failing rule decides the
 * class, and every rule that matched is listed in `reasons` so a reviewer can
 * see why at a glance.
 *
 * "eligible" means eligible for human review and *later* verification.
 * Scout itself never pays.
 */
import { isUsdcAsset, NETWORK_ALIASES } from '../check-runner/x402';

export type Classification =
  | 'pending'            // passes on paper, waiting for its free probe
  | 'blocked'
  | 'already_monitored'
  | 'already_listed'
  | 'already_submitted'
  | 'unreachable'
  | 'not_x402'
  | 'invalid_terms'
  | 'unsupported_network'
  | 'unsupported_asset'
  | 'unsupported_scheme'
  | 'too_expensive'
  | 'needs_input'
  | 'eligible'
  | 'gone';

// Only these reach the admin review queue
export const QUEUEABLE: ReadonlySet<Classification> = new Set(['eligible', 'needs_input']);

export type Terms = {
  network: string;
  asset: string;
  scheme: string;
  transferMethod: string | null;
  priceUsdc: number | null;
  facilitatorPublished: boolean;
};

export type ClassifyInput = {
  blockedReason?: string | null;                      // SSRF / non-https / denylist
  linked?: 'monitored' | 'listed' | 'submitted' | null; // already in CORTX
  gone?: boolean;
  /** null = not probed yet (classify from the listing alone) */
  probe?: 'ok' | 'unreachable' | 'not_x402' | 'invalid_terms' | null;
  /** From the probe when it succeeded, otherwise from the listing */
  terms: Terms | null;
  input: { method: 'GET' | 'POST' | 'OTHER'; hasExample: boolean };
  maxPriceUsdc: number;
};

export type ClassifyResult = { classification: Classification; reasons: string[] };

export function classify(c: ClassifyInput): ClassifyResult {
  const reasons: string[] = [];
  const done = (classification: Classification): ClassifyResult => ({ classification, reasons });

  if (c.blockedReason) { reasons.push(`blocked:${c.blockedReason}`); return done('blocked'); }
  if (c.gone) { reasons.push('gone:not_listed_and_unreachable_7d'); return done('gone'); }
  if (c.linked === 'monitored') { reasons.push('linked:service'); return done('already_monitored'); }
  if (c.linked === 'listed') { reasons.push('linked:registry'); return done('already_listed'); }
  if (c.linked === 'submitted') { reasons.push('linked:submission'); return done('already_submitted'); }

  if (c.probe === 'unreachable') { reasons.push('probe:unreachable'); return done('unreachable'); }
  if (c.probe === 'not_x402') { reasons.push('probe:no_402_terms'); return done('not_x402'); }
  if (c.probe === 'invalid_terms' || !c.terms) { reasons.push('terms:invalid'); return done('invalid_terms'); }

  const t = c.terms;
  if (!NETWORK_ALIASES.mainnet.includes(t.network)) { reasons.push(`network:${t.network || 'none'}`); return done('unsupported_network'); }
  reasons.push('network:base');

  if (!isUsdcAsset(t.asset)) { reasons.push(`asset:${t.asset || 'none'}`); return done('unsupported_asset'); }
  reasons.push('asset:usdc');

  if (t.scheme !== 'exact' || (t.transferMethod != null && t.transferMethod !== 'eip3009')) {
    reasons.push(`scheme:${t.scheme}${t.transferMethod ? `/${t.transferMethod}` : ''}`);
    return done('unsupported_scheme');
  }
  reasons.push('scheme:exact');

  if (t.priceUsdc == null || !(t.priceUsdc > 0)) { reasons.push('price:invalid'); return done('invalid_terms'); }
  if (t.priceUsdc > c.maxPriceUsdc) { reasons.push(`price:${t.priceUsdc}>${c.maxPriceUsdc}`); return done('too_expensive'); }
  reasons.push(`price:${t.priceUsdc}`);

  reasons.push(t.facilitatorPublished ? 'facilitator:published' : 'facilitator:unpublished');

  // Passes on paper — a live probe must confirm before it can be queued
  if (c.probe == null) { reasons.push('probe:pending'); return done('pending'); }
  reasons.push('probe:ok');

  if (!c.input.hasExample) { reasons.push(`input:${c.input.method.toLowerCase()}_without_example`); return done('needs_input'); }
  reasons.push(c.input.method === 'GET' ? 'input:get' : 'input:bazaar_example');

  return done('eligible');
}
