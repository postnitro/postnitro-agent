import { PostNitroApiError } from "./client.js";

/** Prints a successful result as JSON on stdout. */
export function printResult(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

/** Prints an error as JSON on stderr and exits non-zero — keeps stdout clean JSON-only for agents. */
export function failWith(error: unknown): never {
  const payload = error instanceof PostNitroApiError
    ? { success: false, error: { message: error.message, statusCode: error.statusCode } }
    : { success: false, error: { message: error instanceof Error ? error.message : String(error) } };

  process.stderr.write(JSON.stringify(payload, null, 2) + "\n");
  process.exit(1);
}

/** Wraps a command action so thrown errors produce the standard JSON error output instead of a stack trace. */
export function action<Args extends unknown[]>(fn: (...args: Args) => Promise<void>): (...args: Args) => Promise<void> {
  return async (...args: Args) => {
    try {
      await fn(...args);
    } catch (error) {
      failWith(error);
    }
  };
}
