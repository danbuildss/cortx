const SECRET_KEY_PATTERNS = [
  /private[_-]?key/i,
  /privatekey/i,
  /api[_-]?key/i,
  /api[_-]?secret/i,
  /secret/i,
  /authorization/i,
  /bearer/i,
  /auth[_-]?token/i,
  /access[_-]?token/i,
  /password/i,
  /passwd/i,
  /credential/i,
  /mnemonic/i,
  /seed[_-]?phrase/i,
];

const SECRET_VALUE_PATTERNS = [
  // Ethereum private key: 0x followed by 64 hex chars
  /^0x[0-9a-fA-F]{64}$/,
  // Bearer token in a string
  /Bearer [A-Za-z0-9._\-]{20,}/,
  // Base58 strings 44–88 chars (Solana private keys)
  /^[1-9A-HJ-NP-Za-km-z]{44,88}$/,
];

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function containsSecretValue(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

export function redactSecrets(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return containsSecretValue(obj) ? '[REDACTED]' : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(redactSecrets);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        isSecretKey(k) ? '[REDACTED]' : redactSecrets(v),
      ])
    );
  }
  return obj;
}
