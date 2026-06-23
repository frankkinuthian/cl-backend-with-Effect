import { Effect } from "effect";
import express from "express";
import { DatabaseLive } from "../features/database/index.js";
import { listUsers } from "../features/users/list-users.js";
import {
  getUserDepartments,
  getUserSubjects,
  getUser,
} from "../features/users/get-user-resources.js";

const router = express.Router();

type HttpResponse = { status: 200 | 400 | 404 | 500; body: unknown };

// GET /api/users
router.get("/", async (req, res) => {
  const response = await listUsers(req.query).pipe(
    Effect.provide(DatabaseLive),
    Effect.map((result): HttpResponse => ({ status: 200, body: result })),
    Effect.catchTags({
      InvalidQuery: (error) =>
        Effect.succeed({
          status: 400,
          body: { error: error.message },
        } satisfies HttpResponse),
      DatabaseError: (error) => {
        console.error("GET /users error:", error);
        return Effect.succeed({
          status: 500,
          body: { error: "Failed to get users" },
        } satisfies HttpResponse);
      },
    }),
    Effect.runPromise,
  );

  res.status(response.status).json(response.body);
});

// GET /api/users/:id
router.get("/:id", async (req, res) => {
  const response = await getUser(req.params).pipe(
    Effect.provide(DatabaseLive),
    Effect.map((result): HttpResponse => ({ status: 200, body: result })),
    Effect.catchTags({
      InvalidQuery: (error) =>
        Effect.succeed({
          status: 400,
          body: { error: error.message },
        } satisfies HttpResponse),
      NotFound: (error) =>
        Effect.succeed({
          status: 404,
          body: { error: error.message },
        } satisfies HttpResponse),
      DatabaseError: (error) => {
        console.error("GET /users/:id error:", error);
        return Effect.succeed({
          status: 500,
          body: { error: "Failed to get user" },
        } satisfies HttpResponse);
      },
    }),
    Effect.runPromise,
  );

  res.status(response.status).json(response.body);
});

// GET /api/users/:id/departments
router.get("/:id/departments", async (req, res) => {
  const response = await getUserDepartments(req.params, req.query).pipe(
    Effect.provide(DatabaseLive),
    Effect.map((result): HttpResponse => ({ status: 200, body: result })),
    Effect.catchTags({
      InvalidQuery: (error) =>
        Effect.succeed({
          status: 400,
          body: { error: error.message },
        } satisfies HttpResponse),
      DatabaseError: (error) => {
        console.error("GET /users/:id/departments error:", error);
        return Effect.succeed({
          status: 500,
          body: { error: "Failed to get user departments" },
        } satisfies HttpResponse);
      },
    }),
    Effect.runPromise,
  );

  res.status(response.status).json(response.body);
});

// GET /api/users/:id/subjects
router.get("/:id/subjects", async (req, res) => {
  const response = await getUserSubjects(req.params, req.query).pipe(
    Effect.provide(DatabaseLive),
    Effect.map((result): HttpResponse => ({ status: 200, body: result })),
    Effect.catchTags({
      InvalidQuery: (error) =>
        Effect.succeed({
          status: 400,
          body: { error: error.message },
        } satisfies HttpResponse),
      DatabaseError: (error) => {
        console.error("GET /users/:id/subjects error:", error);
        return Effect.succeed({
          status: 500,
          body: { error: "Failed to get user subjects" },
        } satisfies HttpResponse);
      },
    }),
    Effect.runPromise,
  );

  res.status(response.status).json(response.body);
});

export default router;
