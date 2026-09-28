// Test stub for lib/check-runner/ssrf.ts: same API, but allows localhost so
// tests can run the real check runner against a local fake service.
export class StageError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'StageError';
  }
}

export async function validateAndResolveUrl(raw: string): Promise<URL> {
  return new URL(raw);
}
