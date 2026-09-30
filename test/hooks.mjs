import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STUBS = new URL('./stubs/', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL ?? '';

  if (specifier === 'viem' && parent.endsWith('/lib/check-runner/payment.ts')) {
    return { url: new URL('viem-balance.ts', STUBS).href, shortCircuit: true };
  }

  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]s$/.test(specifier)) {
    const candidate = new URL(`${specifier}.ts`, parent);
    if (existsSync(fileURLToPath(candidate))) {
      if (candidate.pathname.endsWith('/lib/check-runner/ssrf.ts')) {
        return { url: new URL('ssrf.ts', STUBS).href, shortCircuit: true };
      }
      if (candidate.pathname.endsWith('/lib/check-runner/fetch-endpoint.ts')) {
        return { url: new URL('fetch-endpoint.ts', STUBS).href, shortCircuit: true };
      }
      return { url: candidate.href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}
