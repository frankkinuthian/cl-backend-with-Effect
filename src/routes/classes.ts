import { Effect } from "effect";
import express from "express";
import { DatabaseLive } from "../features/database/index.js";
import {
  createClass,
  getClass,
  listClassUsers,
  listClasses,
} from "../features/classes/classes.js";

const router = express.Router();

type HttpResponse = {
  status: 200 | 201 | 400 | 404 | 500;
  body: unknown;
};

// GET /api/classes
router.get("/", async (req, res) => {
  const response = await listClasses(req.query).pipe(
    Effect.provide(DatabaseLive),
    Effect.map((result): HttpResponse => ({ status: 200, body: result })),
    Effect.catchTags({
      InvalidQuery: (error) =>
        Effect.succeed({
          status: 400,
          body: { error: error.message },
        } satisfies HttpResponse),
      DatabaseError: (error) => {
        console.error("GET /classes error:", error);
        return Effect.succeed({
          status: 500,
          body: { error: "Failed to fetch classes" },
        } satisfies HttpResponse);
      },
    }),
    Effect.runPromise,
  );

  res.status(response.status).json(response.body);
});

// POST /api/classes
router.post("/", async (req, res) => {
  const response = await createClass(req.body).pipe(
    Effect.provide(DatabaseLive),
    Effect.map(
      (result): HttpResponse => ({ status: 201, body: { data: result } }),
    ),
    Effect.catchTags({
      InvalidQuery: (error) =>
        Effect.succeed({
          status: 400,
          body: { error: error.message },
        } satisfies HttpResponse),
      DatabaseError: (error) => {
        console.error("POST /classes error:", error);
        return Effect.succeed({
          status: 500,
          body: { error: "Failed to create class" },
        } satisfies HttpResponse);
      },
    }),
    Effect.runPromise,
  );

  res.status(response.status).json(response.body);
});

// GET /api/classes/:id
router.get("/:id", async (req, res) => {
  const response = await getClass(req.params).pipe(
    Effect.provide(DatabaseLive),
    Effect.map(
      (result): HttpResponse => ({ status: 200, body: { data: result } }),
    ),
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
        console.error("GET /classes/:id error:", error);
        return Effect.succeed({
          status: 500,
          body: { error: "Failed to fetch class details" },
        } satisfies HttpResponse);
      },
    }),
    Effect.runPromise,
  );

  res.status(response.status).json(response.body);
});

// GET /api/classes/:id/users
router.get("/:id/users", async (req, res) => {
  const response = await listClassUsers(req.params, req.query).pipe(
    Effect.provide(DatabaseLive),
    Effect.map((result): HttpResponse => ({ status: 200, body: result })),
    Effect.catchTags({
      InvalidQuery: (error) =>
        Effect.succeed({
          status: 400,
          body: { error: error.message },
        } satisfies HttpResponse),
      DatabaseError: (error) => {
        console.error("GET /classes/:id/users error:", error);
        return Effect.succeed({
          status: 500,
          body: { error: "Failed to fetch class users" },
        } satisfies HttpResponse);
      },
    }),
    Effect.runPromise,
  );

  res.status(response.status).json(response.body);
});

export default router;
