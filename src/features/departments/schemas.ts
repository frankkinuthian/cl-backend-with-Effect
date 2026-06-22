import { Schema } from "effect";

export const ListDepartmentsQuery = Schema.Struct({
  search: Schema.optional(Schema.String),
  page: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int()), {
    default: () => 1,
  }),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(1),
      Schema.lessThanOrEqualTo(100),
    ),
    {
      default: () => 10,
    },
  ),
});

export type ListDepartmentsQuery = Schema.Schema.Type<
  typeof ListDepartmentsQuery
>;
