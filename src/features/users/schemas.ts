import { Schema } from "effect";

export const ListUsersQuery = Schema.Struct({
  search: Schema.optional(Schema.String),
  role: Schema.optional(Schema.String),
  page: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
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

export type ListUsersQuery = Schema.Schema.Type<typeof ListUsersQuery>;
