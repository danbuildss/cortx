// Structured JSON logs (one line each) → journald on the VPS. Never log secrets.
export type LogFields = Record<string, unknown>;
export type Logger = {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
};

export function createLogger(base: LogFields = {}, sink: (line: string) => void = (l) => process.stdout.write(l + '\n')): Logger {
  const emit = (level: string, event: string, fields?: LogFields) =>
    sink(JSON.stringify({ ts: new Date().toISOString(), level, event, ...base, ...fields }));
  return {
    info: (e, f) => emit('info', e, f),
    warn: (e, f) => emit('warn', e, f),
    error: (e, f) => emit('error', e, f),
    child: (f) => createLogger({ ...base, ...f }, sink),
  };
}

export const silentLogger: Logger = { info() {}, warn() {}, error() {}, child: () => silentLogger };
