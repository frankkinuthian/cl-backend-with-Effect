import { desc, ilike, sql, type SQL } from "drizzle-orm";
import { Effect, Schedule, Schema } from "effect";
import { db as DbClient } from "../../database";
import { departments } from "../../database/schema";
import { Database } from "../database";
import { DatabaseError, InvalidQuery } from "../errors";
import { ListDepartmentsQuery } from "./schemas";
import { normalizeExpressQuery } from "../subjects/schemas"; // reuse

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

export const listDepartments = (rawQuery: unknown) =>
  Effect.gen(function* () {
    const params = yield* Schema.decodeUnknown(ListDepartmentsQuery)(
      normalizeExpressQuery(rawQuery),
    ).pipe(
      Effect.mapError(
        () => new InvalidQuery({ message: "Invalid query parameters" }),
      ),
    );

    const db = yield* Database;
    const offset = (params.page - 1) * params.limit;

    const where: WhereClause = params.search
      ? ilike(departments.name, `%${params.search}%`)
      : undefined;

    const [total, data] = yield* Effect.all(
      [
        tryDb(async () => {
          const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(departments)
            .where(where);
          return result[0]?.count ?? 0;
        }),
        tryDb(() =>
          db
            .select()
            .from(departments)
            .where(where)
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
        totalPages: Math.ceil(total / params.limit),
      },
    };
  });
