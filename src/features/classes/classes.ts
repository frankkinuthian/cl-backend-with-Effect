import {
  and,
  desc,
  eq,
  getTableColumns,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { Effect, Schedule, Schema } from "effect";
import { db as DbClient } from "../../database/index.js";
import {
  classes,
  departments,
  enrollments,
  subjects,
  user,
} from "../../database/schema/index.js";
import { Database } from "../database/index.js";
import { DatabaseError, InvalidQuery, NotFound } from "../errors/index.js";
import { normalizeExpressQuery } from "../subjects/schemas.js";
import {
  ClassIdParam,
  ClassUsersQuery,
  CreateClassBody,
  ListClassesQuery,
} from "./schemas.js";

type WhereClause = SQL | undefined;

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

function buildListWhereClause(params: ListClassesQuery): WhereClause {
  const conditions: SQL[] = [];

  if (params.search) {
    conditions.push(
      or(
        ilike(classes.name, `%${params.search}%`),
        ilike(classes.inviteCode, `%${params.search}%`),
      ) as SQL,
    );
  }

  if (params.subject) {
    conditions.push(ilike(subjects.name, `%${params.subject}%`));
  }

  if (params.teacher) {
    conditions.push(ilike(user.name, `%${params.teacher}%`));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

// ---------------------------------------------------------------------------
// List classes
// ---------------------------------------------------------------------------

const countClasses = (db: typeof DbClient, whereClause: WhereClause) =>
  tryDb(async () => {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(classes)
      .leftJoin(subjects, eq(classes.subjectId, subjects.id))
      .leftJoin(user, eq(classes.teacherId, user.id))
      .where(whereClause);
    return result[0]?.count ?? 0;
  });

const fetchClasses = (
  db: typeof DbClient,
  whereClause: WhereClause,
  limit: number,
  offset: number,
) =>
  tryDb(() =>
    db
      .select({
        ...getTableColumns(classes),
        subject: { ...getTableColumns(subjects) },
        teacher: { ...getTableColumns(user) },
      })
      .from(classes)
      .leftJoin(subjects, eq(classes.subjectId, subjects.id))
      .leftJoin(user, eq(classes.teacherId, user.id))
      .where(whereClause)
      .orderBy(desc(classes.createdAt))
      .limit(limit)
      .offset(offset),
  );

export const listClasses = (rawQuery: unknown) =>
  Effect.gen(function* () {
    const params = yield* Schema.decodeUnknown(ListClassesQuery)(
      normalizeExpressQuery(rawQuery),
    ).pipe(
      Effect.mapError(
        () => new InvalidQuery({ message: "Invalid query parameters" }),
      ),
    );

    const db = yield* Database;
    const whereClause = buildListWhereClause(params);
    const offset = (params.page - 1) * params.limit;

    const [total, data] = yield* Effect.all(
      [
        countClasses(db, whereClause),
        fetchClasses(db, whereClause, params.limit, offset),
      ],
      { concurrency: 2 },
    );

    return {
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  });

// ---------------------------------------------------------------------------
// Create class
// ---------------------------------------------------------------------------

export const createClass = (rawBody: unknown) =>
  Effect.gen(function* () {
    const body = yield* Schema.decodeUnknown(CreateClassBody)(rawBody).pipe(
      Effect.mapError(
        () => new InvalidQuery({ message: "Invalid request body" }),
      ),
    );

    const db = yield* Database;

    const inviteCode = Math.random().toString(36).substring(2, 9);

    const created = yield* tryDb(async () => {
      const [row] = await db
        .insert(classes)
        .values({
          name: body.name,
          teacherId: body.teacherId,
          subjectId: body.subjectId,
          inviteCode,
          bannerCldPubId: body.bannerCldPubId,
          bannerUrl: body.bannerUrl,
          capacity: body.capacity ?? 50,
          description: body.description,
          schedules: [],
          status: body.status ?? "active",
        })
        .returning({ id: classes.id });

      if (!row) throw new Error("Insert returned no rows");
      return row;
    });

    return created;
  });

// ---------------------------------------------------------------------------
// Get class by id
// ---------------------------------------------------------------------------

export const getClass = (rawParams: unknown) =>
  Effect.gen(function* () {
    const { id } = yield* Schema.decodeUnknown(ClassIdParam)(rawParams).pipe(
      Effect.mapError(() => new InvalidQuery({ message: "Invalid class id" })),
    );

    const db = yield* Database;

    const row = yield* tryDb(async () => {
      const [result] = await db
        .select({
          ...getTableColumns(classes),
          subject: { ...getTableColumns(subjects) },
          department: { ...getTableColumns(departments) },
          teacher: { ...getTableColumns(user) },
        })
        .from(classes)
        .leftJoin(subjects, eq(classes.subjectId, subjects.id))
        .leftJoin(departments, eq(subjects.departmentId, departments.id))
        .leftJoin(user, eq(classes.teacherId, user.id))
        .where(eq(classes.id, id));
      return result ?? null;
    });

    if (!row) {
      return yield* Effect.fail(
        new NotFound({ message: `Class ${id} not found` }),
      );
    }

    return row;
  });

// ---------------------------------------------------------------------------
// List users in a class by role
// ---------------------------------------------------------------------------

const baseUserSelect = {
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  image: user.image,
  role: user.role,
  imageCldPubId: user.imageCldPubId,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
};

const groupByFields = [
  user.id,
  user.name,
  user.email,
  user.emailVerified,
  user.image,
  user.role,
  user.imageCldPubId,
  user.createdAt,
  user.updatedAt,
] as const;

export const listClassUsers = (rawParams: unknown, rawQuery: unknown) =>
  Effect.gen(function* () {
    const { id: classId } = yield* Schema.decodeUnknown(ClassIdParam)(
      rawParams,
    ).pipe(
      Effect.mapError(() => new InvalidQuery({ message: "Invalid class id" })),
    );

    const params = yield* Schema.decodeUnknown(ClassUsersQuery)(
      normalizeExpressQuery(rawQuery),
    ).pipe(
      Effect.mapError(
        () => new InvalidQuery({ message: "Invalid query parameters" }),
      ),
    );

    const db = yield* Database;
    const offset = (params.page - 1) * params.limit;
    const isTeacher = params.role === "teacher";

    const [total, data] = yield* Effect.all(
      [
        tryDb(async () => {
          const result = isTeacher
            ? await db
                .select({ count: sql<number>`count(distinct ${user.id})` })
                .from(user)
                .leftJoin(classes, eq(user.id, classes.teacherId))
                .where(and(eq(user.role, params.role), eq(classes.id, classId)))
            : await db
                .select({ count: sql<number>`count(distinct ${user.id})` })
                .from(user)
                .leftJoin(enrollments, eq(user.id, enrollments.studentId))
                .where(
                  and(
                    eq(user.role, params.role),
                    eq(enrollments.classId, classId),
                  ),
                );
          return result[0]?.count ?? 0;
        }),
        tryDb(async () => {
          return isTeacher
            ? await db
                .select(baseUserSelect)
                .from(user)
                .leftJoin(classes, eq(user.id, classes.teacherId))
                .where(and(eq(user.role, params.role), eq(classes.id, classId)))
                .groupBy(...groupByFields)
                .orderBy(desc(user.createdAt))
                .limit(params.limit)
                .offset(offset)
            : await db
                .select(baseUserSelect)
                .from(user)
                .leftJoin(enrollments, eq(user.id, enrollments.studentId))
                .where(
                  and(
                    eq(user.role, params.role),
                    eq(enrollments.classId, classId),
                  ),
                )
                .groupBy(...groupByFields)
                .orderBy(desc(user.createdAt))
                .limit(params.limit)
                .offset(offset);
        }),
      ],
      { concurrency: 2 },
    );

    return {
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  });
