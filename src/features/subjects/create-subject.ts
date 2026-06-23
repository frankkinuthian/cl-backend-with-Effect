import { Effect, Schedule, Schema } from "effect";
import { subjects } from "../../database/schema/index.js";
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

const CreateSubjectBody = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(3)),
  code: Schema.String.pipe(Schema.minLength(5)),
  description: Schema.optional(Schema.String),
  departmentId: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1),
  ),
});

export const createSubject = (rawBody: unknown) =>
  Effect.gen(function* () {
    const body = yield* Schema.decodeUnknown(CreateSubjectBody)(rawBody).pipe(
      Effect.mapError(
        () => new InvalidQuery({ message: "Invalid request body" }),
      ),
    );

    const db = yield* Database;

    const created = yield* tryDb(async () => {
      const [row] = await db
        .insert(subjects)
        .values({
          name: body.name,
          code: body.code,
          description: body.description,
          departmentId: body.departmentId,
        })
        .returning();

      if (!row) throw new Error("Insert returned no rows");
      return row;
    });

    return { data: created };
  });
