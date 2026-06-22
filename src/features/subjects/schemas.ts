import { Schema } from "effect";

export const ListSubjectsQuery = Schema.Struct({
  search: Schema.optional(Schema.String),
  department: Schema.optional(Schema.String),
  page: Schema.optionalWith(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(1),
    ),
    { default: () => 1 },
  ),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(1),
      Schema.lessThanOrEqualTo(100),
    ),
    { default: () => 10 },
  ),
});

export type ListSubjectsQuery = Schema.Schema.Type<typeof ListSubjectsQuery>;

// Express may send string[] for repeated query keys; keep the first string value.
export function normalizeExpressQuery(query: unknown): Record<string, string> {
  if (typeof query !== "object" || query === null || Array.isArray(query)) {
    return {};
  }

  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      normalized[key] = value;
    } else if (Array.isArray(value) && typeof value[0] === "string") {
      normalized[key] = value[0];
    }
  }

  return normalized;
}
