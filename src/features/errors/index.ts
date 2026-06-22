import { Schema } from "effect";

export class DatabaseError extends Schema.TaggedError<DatabaseError>()(
  "DatabaseError",
  { cause: Schema.Unknown },
) {}

export class InvalidQuery extends Schema.TaggedError<InvalidQuery>()(
  "InvalidQuery",
  { message: Schema.String },
) {}
