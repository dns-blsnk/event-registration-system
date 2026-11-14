/** class-transformer helper: trims strings before validation, leaves other values alone. */
export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** For short labels such as tag names: trims and collapses any run of whitespace into one space. */
export function normalizeLabel({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
}
