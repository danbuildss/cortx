/**
 * Cori quality gate (Q1, approved Oct 8): quality over noise. Pure and
 * deterministic — no model, no network.
 *
 * Cori still reads the whole Bazaar, but only keeps, checks and shows
 * services that look like a real product from a real company:
 *   - an own domain, not free app hosting (*.railway.app, *.vercel.app, …)
 *   - a real name and description, not test/demo/blank listings
 *   - (company level, in the pipeline) a website that answers, a passing free
 *     payment check, and at most a few services per company, so hundreds of
 *     near-identical listings count as one product
 * Companies on the founder's watch list always pass.
 */

// Free app hosting: each subdomain is a different (usually hobby/test) project
export const FREE_HOSTING_SUFFIXES = [
  'railway.app', 'up.railway.app', 'vercel.app', 'vercel.sh', 'netlify.app', 'onrender.com', 'herokuapp.com',
  'fly.dev', 'workers.dev', 'pages.dev', 'trycloudflare.com', 'ngrok.io', 'ngrok.app', 'ngrok-free.app', 'ngrok.dev',
  'replit.app', 'repl.co', 'replit.dev', 'glitch.me', 'deno.dev', 'github.io', 'gitlab.io', 'web.app',
  'firebaseapp.com', 'azurewebsites.net', 'cloudfunctions.net', 'run.app', 'amplifyapp.com', 'supabase.co',
  'lovable.app', 'loca.lt', 'surge.sh', 'koyeb.app', 'modal.run', 'hf.space', 'streamlit.app', 'bolt.new',
  'val.run', 'web.val.run', 'pipedream.net', 'appspot.com', 'elasticbeanstalk.com', 'cloudfront.net',
];

// Second-level public suffixes, so example.co.uk → example.co.uk (not co.uk)
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'co.kr',
  'co.in', 'co.za', 'com.br', 'com.cn', 'com.mx', 'com.sg', 'com.tr', 'com.hk', 'com.tw', 'com.ar', 'co.id',
]);

// Names and descriptions that mark a listing as a test, demo or placeholder
const JUNK_WORDS = /\b(test|testing|demo|example|sample|hello|hello[- ]?world|placeholder|todo|foo|bar|dummy|lorem|my[- ]?api|untitled)\b/i;

const MIN_NAME = 3;
const MIN_DESCRIPTION = 20;

export function isFreeHosting(host: string): boolean {
  const h = host.toLowerCase();
  return FREE_HOSTING_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

/**
 * The company a host belongs to: its registrable domain
 * (intel.rallylive.ca and dns.intel.rallylive.ca → rallylive.ca). On free
 * hosting the full host is the "company", since every subdomain is someone else.
 */
export function companyOf(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (isFreeHosting(h)) return h;
  const parts = h.split('.');
  if (parts.length <= 2) return h;
  const lastTwo = parts.slice(-2).join('.');
  return MULTI_PART_SUFFIXES.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
}

export type QualityInput = {
  host: string;
  name: string | null;
  description: string | null;
  watched: boolean;
};

export type QualityResult = { ok: boolean; reasons: string[] };

/** Listing-level gate: decides whether Cori keeps a listing at all */
export function listingQuality(q: QualityInput): QualityResult {
  if (q.watched) return { ok: true, reasons: ['quality:watch_list'] };
  const reasons: string[] = [];
  if (isFreeHosting(q.host)) reasons.push('quality:free_hosting');
  const name = (q.name ?? '').trim();
  const description = (q.description ?? '').trim();
  if (name.length < MIN_NAME) reasons.push('quality:no_name');
  else if (JUNK_WORDS.test(name)) reasons.push('quality:test_name');
  if (description.length < MIN_DESCRIPTION) reasons.push('quality:no_description');
  else if (JUNK_WORDS.test(description) && description.length < 80) reasons.push('quality:test_description');
  return reasons.length === 0 ? { ok: true, reasons: ['quality:ok'] } : { ok: false, reasons };
}
