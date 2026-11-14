/** class-transformer helper: trims strings before validation, leaves other values alone. */
export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
