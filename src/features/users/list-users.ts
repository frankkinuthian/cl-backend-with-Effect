import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { Effect, Schedule, Schema } from "effect";
import { db as DbClient } from "../../database/index.js";
import { user } from "../../database/schema/index.js";
import { Database } from "../database/index.js";
import { DatabaseError, InvalidQuery } from "../errors/index.js";
import { normalizeExpressQuery } from "../subjects/schemas.js";
import { ListUsersQuery } from "./schemas.js";

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

function buildWhereClause(params: ListUsersQuery): WhereClause {
  const conditions: SQL[] = [];

  if (params.search) {
    conditions.push(
      or(
        ilike(user.name, `%${params.search}%`),
        ilike(user.email, `%${params.search}%`),
      ) as SQL,
    );
  }

  if (params.role) {
    conditions.push(eq(user.role, params.role as typeof user.role._.data));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export const listUsers = (rawQuery: unknown) =>
  Effect.gen(function* () {
    const params = yield* Schema.decodeUnknown(ListUsersQuery)(
      normalizeExpressQuery(rawQuery),
    ).pipe(
      Effect.mapError(
        () => new InvalidQuery({ message: "Invalid query parameters" }),
      ),
    );

    const db = yield* Database;
    const where = buildWhereClause(params);
    const offset = (params.page - 1) * params.limit;

    const [total, data] = yield* Effect.all(
      [
        tryDb(async () => {
          const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(user)
            .where(where);
          return result[0]?.count ?? 0;
        }),
        tryDb(() =>
          db
            .select()
            .from(user)
            .where(where)
            .orderBy(desc(user.createdAt))
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
