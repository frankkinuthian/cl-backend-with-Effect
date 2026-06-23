import { Schema } from "effect";

export const ListClassesQuery = Schema.Struct({
  search: Schema.optional(Schema.String),
  subject: Schema.optional(Schema.String),
  teacher: Schema.optional(Schema.String),
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

export type ListClassesQuery = Schema.Schema.Type<typeof ListClassesQuery>;

export const ClassIdParam = Schema.Struct({
  id: Schema.NumberFromString.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1),
  ),
});

export type ClassIdParam = Schema.Schema.Type<typeof ClassIdParam>;

export const ClassUsersQuery = Schema.Struct({
  role: Schema.Literal("teacher", "student"),
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

export type ClassUsersQuery = Schema.Schema.Type<typeof ClassUsersQuery>;

export const CreateClassBody = Schema.Struct({
  name: Schema.String,
  teacherId: Schema.String,
  subjectId: Schema.Number,
  capacity: Schema.optional(Schema.Number),
  description: Schema.optional(Schema.String),
  status: Schema.optional(Schema.Literal("active", "inactive", "archived")),
  bannerUrl: Schema.optional(Schema.String),
  bannerCldPubId: Schema.optional(Schema.String),
});

export type CreateClassBody = Schema.Schema.Type<typeof CreateClassBody>;
