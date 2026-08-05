import { lookup } from 'dns/promises';
import ipaddr from 'ipaddr.js';

const BLOCKED_PORTS = new Set([22, 25, 465, 587, 3306, 5432, 6379, 27017]);

function isPrivateIP(address: string): boolean {
  try {
    const ip = ipaddr.parse(address);
    const range = ip.range();
    // Allow only unicast public addresses
    const blockedRanges = [
      'private',
      'loopback',
      'linkLocal',
      'uniqueLocal',
      'reserved',
      'benchmarking',
      'carrierGradeNat',
      'broadcast',
      'unspecified',
    ];
    return blockedRanges.includes(range);
  } catch {
    // If we can't parse the IP, treat as blocked
    return true;
  }
}

export class StageError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? code);
    this.name = 'StageError';
  }
}

export async function validateAndResolveUrl(endpointUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(endpointUrl);
  } catch {
    throw new StageError('INVALID_URL', `Cannot parse URL: ${endpointUrl}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new StageError('NON_HTTPS', `URL scheme must be https, got: ${parsed.protocol}`);
  }

  const port = parsed.port ? parseInt(parsed.port, 10) : 443;
  if (BLOCKED_PORTS.has(port)) {
    throw new StageError('BLOCKED_PORT', `Port ${port} is blocked`);
  }

  // Resolve DNS at validation time to prevent DNS rebinding
  let records: { address: string; family: number }[];
  try {
    records = await lookup(parsed.hostname, { all: true });
  } catch (err) {
    throw new StageError('UNREACHABLE', `DNS resolution failed for ${parsed.hostname}: ${err}`);
  }

  if (records.length === 0) {
    throw new StageError('UNREACHABLE', `No DNS records for ${parsed.hostname}`);
  }

  for (const record of records) {
    if (isPrivateIP(record.address)) {
      throw new StageError(
        'SSRF_BLOCKED',
        `Hostname ${parsed.hostname} resolves to private/reserved IP: ${record.address}`
      );
    }
  }

  return parsed;
}
