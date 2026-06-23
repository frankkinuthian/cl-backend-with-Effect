import { Effect } from "effect";
import express from "express";
import { DatabaseLive } from "../features/database/index.js";
import { listDepartments } from "../features/departments/list-departments.js";
import { createDepartment } from "../features/departments/create-department.js";

const router = express.Router();

type HttpResponse = { status: 200 | 201 | 400 | 500; body: unknown };

router.get("/", async (req, res) => {
  const response = await listDepartments(req.query).pipe(
    Effect.provide(DatabaseLive),
    Effect.map((result): HttpResponse => ({ status: 200, body: result })),
    Effect.catchTags({
      InvalidQuery: (error) =>
        Effect.succeed({
          status: 400,
          body: { error: error.message },
        } satisfies HttpResponse),
      DatabaseError: (error) => {
        console.error("GET /departments error:", error);
        return Effect.succeed({
          status: 500,
          body: { error: "Failed to get departments" },
        } satisfies HttpResponse);
      },
    }),
    Effect.runPromise,
  );

  res.status(response.status).json(response.body);
});

router.post("/", async (req, res) => {
  const response = await createDepartment(req.body).pipe(
    Effect.provide(DatabaseLive),
    Effect.map((result): HttpResponse => ({ status: 201, body: result })),
    Effect.catchTags({
      InvalidQuery: (error) =>
        Effect.succeed({
          status: 400,
          body: { error: error.message },
        } satisfies HttpResponse),
      DatabaseError: (error) => {
        console.error("POST /departments error:", error);
        return Effect.succeed({
          status: 500,
          body: { error: "Failed to create department" },
        } satisfies HttpResponse);
      },
    }),
    Effect.runPromise,
  );

  res.status(response.status).json(response.body);
});

export default router;
