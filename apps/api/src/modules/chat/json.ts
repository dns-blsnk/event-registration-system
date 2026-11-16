/** A plain object, not null or an array, whose fields can be read by name. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The value of a JSON text, or undefined when the text is not JSON. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Recovered on purpose: callers treat text that is not JSON as carrying nothing.
    return undefined;
  }
}
