import { desc, eq, getTableColumns, sql } from "drizzle-orm";
import { Effect, Schedule, Schema } from "effect";
import { db as DbClient } from "../../database/index.js";
import { classes, departments, subjects } from "../../database/schema/index.js";
import { user } from "../../database/schema/index.js";
import { Database } from "../database/index.js";
import { DatabaseError, InvalidQuery, NotFound } from "../errors/index.js";
import { normalizeExpressQuery } from "../subjects/schemas.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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

const PaginationQuery = Schema.Struct({
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

const UserIdParam = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
});

// ---------------------------------------------------------------------------
// GET /users/:id/departments
// Distinct departments reached via: user → classes (teacherId) → subjects → departments
// ---------------------------------------------------------------------------

export const getUserDepartments = (rawParams: unknown, rawQuery: unknown) =>
  Effect.gen(function* () {
    const { id: userId } = yield* Schema.decodeUnknown(UserIdParam)(
      rawParams,
    ).pipe(
      Effect.mapError(() => new InvalidQuery({ message: "Invalid user id" })),
    );

    const params = yield* Schema.decodeUnknown(PaginationQuery)(
      normalizeExpressQuery(rawQuery),
    ).pipe(
      Effect.mapError(
        () => new InvalidQuery({ message: "Invalid query parameters" }),
      ),
    );

    const db = yield* Database;
    const offset = (params.page - 1) * params.limit;

    // Subquery: department ids that this user teaches through
    const taughtDepartmentIds = db
      .selectDistinct({ departmentId: subjects.departmentId })
      .from(classes)
      .innerJoin(subjects, eq(classes.subjectId, subjects.id))
      .where(eq(classes.teacherId, userId))
      .as("taught_dept_ids");

    const [total, data] = yield* Effect.all(
      [
        tryDb(async () => {
          const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(departments)
            .innerJoin(
              taughtDepartmentIds,
              eq(departments.id, taughtDepartmentIds.departmentId),
            );
          return result[0]?.count ?? 0;
        }),
        tryDb(() =>
          db
            .select({ ...getTableColumns(departments) })
            .from(departments)
            .innerJoin(
              taughtDepartmentIds,
              eq(departments.id, taughtDepartmentIds.departmentId),
            )
            .orderBy(desc(departments.createdAt))
            .limit(params.limit)
            .offset(offset),
        ),
      ],
      { concurrency: 2 },
    );

    return {
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(Number(total) / params.limit),
      },
    };
  });

// ---------------------------------------------------------------------------
// GET /users/:id/subjects
// Distinct subjects reached via: user → classes (teacherId) → subjects → departments
// ---------------------------------------------------------------------------

export const getUserSubjects = (rawParams: unknown, rawQuery: unknown) =>
  Effect.gen(function* () {
    const { id: userId } = yield* Schema.decodeUnknown(UserIdParam)(
      rawParams,
    ).pipe(
      Effect.mapError(() => new InvalidQuery({ message: "Invalid user id" })),
    );

    const params = yield* Schema.decodeUnknown(PaginationQuery)(
      normalizeExpressQuery(rawQuery),
    ).pipe(
      Effect.mapError(
        () => new InvalidQuery({ message: "Invalid query parameters" }),
      ),
    );

    const db = yield* Database;
    const offset = (params.page - 1) * params.limit;

    // Subquery: distinct subject ids this user teaches
    const taughtSubjectIds = db
      .selectDistinct({ subjectId: classes.subjectId })
      .from(classes)
      .where(eq(classes.teacherId, userId))
      .as("taught_subject_ids");

    const [total, data] = yield* Effect.all(
      [
        tryDb(async () => {
          const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(subjects)
            .innerJoin(
              taughtSubjectIds,
              eq(subjects.id, taughtSubjectIds.subjectId),
            );
          return result[0]?.count ?? 0;
        }),
        tryDb(() =>
          db
            .select({
              ...getTableColumns(subjects),
              department: { ...getTableColumns(departments) },
            })
            .from(subjects)
            .innerJoin(
              taughtSubjectIds,
              eq(subjects.id, taughtSubjectIds.subjectId),
            )
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .orderBy(desc(subjects.createdAt))
            .limit(params.limit)
            .offset(offset),
        ),
      ],
      { concurrency: 2 },
    );

    return {
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(Number(total) / params.limit),
      },
    };
  });

// ---------------------------------------------------------------------------
// GET /users/:id
// ---------------------------------------------------------------------------

export const getUser = (rawParams: unknown) =>
  Effect.gen(function* () {
    const { id: userId } = yield* Schema.decodeUnknown(UserIdParam)(
      rawParams,
    ).pipe(
      Effect.mapError(() => new InvalidQuery({ message: "Invalid user id" })),
    );

    const db = yield* Database;

    const row = yield* tryDb(async () => {
      const [result] = await db.select().from(user).where(eq(user.id, userId));
      return result ?? null;
    });

    if (!row) {
      return yield* Effect.fail(
        new NotFound({ message: `User ${userId} not found` }),
      );
    }

    return { data: row };
  });
