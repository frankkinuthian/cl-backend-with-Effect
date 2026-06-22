import { Schema } from "effect";

export class DatabaseError extends Schema.TaggedError<DatabaseError>()(
  "DatabaseError",
  { cause: Schema.Unknown },
) {}

export class InvalidQuery extends Schema.TaggedError<InvalidQuery>()(
  "InvalidQuery",
  { message: Schema.String },
) {}

export class ArcjetBotError extends Schema.TaggedError<ArcjetBotError>()(
  "ArcjetBotError",
  {},
) {}

export class ArcjetShieldError extends Schema.TaggedError<ArcjetShieldError>()(
  "ArcjetShieldError",
  {},
) {}

export class ArcjetRateLimitError extends Schema.TaggedError<ArcjetRateLimitError>()(
  "ArcjetRateLimitError",
  { message: Schema.String },
) {}

export class ArcjetError extends Schema.TaggedError<ArcjetError>()(
  "ArcjetError",
  { cause: Schema.Unknown },
) {}
