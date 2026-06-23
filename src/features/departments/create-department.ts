import { eq } from "drizzle-orm";
import { Effect, Schedule, Schema } from "effect";
import { departments } from "../../database/schema/index.js";
import { Database } from "../database/index.js";
import { DatabaseError, InvalidQuery } from "../errors/index.js";

const tryDb = <A>(fn: () => Promise<A>) =>
  Effect.tryPromise({
    try: fn,
    catch: (cause) => new DatabaseError({ cause }),
  }).pipe(
    Effect.retry({
      times: 3,
      schedule: Schedule.exponential("200 millis", 2),
    }),
  );

const CreateDepartmentBody = Schema.Struct({
  code: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(12)),
  name: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(100)),
  description: Schema.optional(Schema.String),
});

export const createDepartment = (rawBody: unknown) =>
  Effect.gen(function* () {
    const body = yield* Schema.decodeUnknown(CreateDepartmentBody)(
      rawBody,
    ).pipe(
      Effect.mapError(
        () => new InvalidQuery({ message: "Invalid request body" }),
      ),
    );

    const db = yield* Database;

    const created = yield* tryDb(async () => {
      const [row] = await db
        .insert(departments)
        .values({
          code: body.code.trim().toUpperCase(),
          name: body.name,
          description: body.description,
        })
        .returning();

      if (!row) throw new Error("Insert returned no rows");
      return row;
    });

    return { data: created };
  });
