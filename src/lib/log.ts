/**
 * The server's log: one line per event, `level=… msg="…" key=value …`, so it
 * reads plainly in `journalctl -u lsmd` and can be searched by field
 * (`journalctl -u lsmd | grep level=error`, `… | grep code=P2002`).
 *
 * An error's message and code become fields; an unexpected error (no code —
 * a bug rather than a known database refusal) also gets its stack trace on the
 * lines that follow.
 */

type Fields = Record<string, unknown>;
type Level = "info" | "warn" | "error";

function format(value: unknown): string {
  const text = typeof value === "string" ? value : value instanceof Date ? value.toISOString() : JSON.stringify(value);
  return text === "" || /[\s"=]/.test(text) ? JSON.stringify(text) : text;
}

function codeOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}

function errorFields(error: unknown): Fields {
  if (error instanceof Error) {
    return { error: error.message.replace(/\s+/g, " ").trim().slice(0, 300), code: codeOf(error) };
  }
  return { error: String(error).slice(0, 300) };
}

function write(level: Level, message: string, fields: Fields) {
  const parts = [`level=${level}`, `msg=${format(message)}`];
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) parts.push(`${key}=${format(value)}`);
  }
  const line = parts.join(" ");
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (message: string, fields: Fields = {}) => write("info", message, fields),
  warn: (message: string, fields: Fields = {}) => write("warn", message, fields),
  /** `error` is what was caught; its message and code are logged with it. */
  error: (message: string, error?: unknown, fields: Fields = {}) => {
    write("error", message, error === undefined ? fields : { ...fields, ...errorFields(error) });
    if (error instanceof Error && error.stack && !codeOf(error)) console.error(error.stack);
  },
};
