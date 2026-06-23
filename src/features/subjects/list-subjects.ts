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
import { departments, subjects } from "../../database/schema/index.js";
import { Database } from "../database/index.js";
import { DatabaseError, InvalidQuery } from "../errors/index.js";
import { ListSubjectsQuery, normalizeExpressQuery } from "./schemas.js";

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

function buildWhereClause(params: ListSubjectsQuery): WhereClause {
  const filterConditions = [];

  if (params.search) {
    filterConditions.push(
      or(
        ilike(subjects.name, `%${params.search}%`),
        ilike(subjects.code, `%${params.search}%`),
      ),
    );
  }

  if (params.department) {
    filterConditions.push(ilike(departments.name, `%${params.department}%`));
  }

  return filterConditions.length > 0 ? and(...filterConditions) : undefined;
}

const countSubjects = (db: typeof DbClient, whereClause: WhereClause) =>
  tryDb(async () => {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause);

    return countResult[0]?.count ?? 0;
  });

const fetchSubjects = (
  db: typeof DbClient,
  whereClause: WhereClause,
  limit: number,
  offset: number,
) =>
  tryDb(() =>
    db
      .select({
        ...getTableColumns(subjects),
        department: {
          ...getTableColumns(departments),
        },
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause)
      .orderBy(desc(subjects.createdAt))
      .limit(limit)
      .offset(offset),
  );

export const listSubjects = (rawQuery: unknown) =>
  Effect.gen(function* () {
    const params = yield* Schema.decodeUnknown(ListSubjectsQuery)(
      normalizeExpressQuery(rawQuery),
    ).pipe(
      Effect.mapError(
        () => new InvalidQuery({ message: "Invalid query parameters" }),
      ),
    );

    const db = yield* Database;
    const whereClause = buildWhereClause(params);
    const offset = (params.page - 1) * params.limit;

    const [total, data] = yield* Effect.all(
      [
        countSubjects(db, whereClause),
        fetchSubjects(db, whereClause, params.limit, offset),
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
