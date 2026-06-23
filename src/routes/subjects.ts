import { Effect } from "effect";
import express from "express";
import { DatabaseLive } from "../features/database/index.js";
import { listSubjects } from "../features/subjects/list-subjects.js";
import { createSubject } from "../features/subjects/create-subject.js";

const router = express.Router();

type HttpResponse = {
  status: 200 | 201 | 400 | 500;
  body: unknown;
};

router.get("/", async (req, res) => {
  const response = await listSubjects(req.query).pipe(
    Effect.provide(DatabaseLive),
    Effect.map(
      (result): HttpResponse => ({
        status: 200,
        body: result,
      }),
    ),
    Effect.catchTags({
      InvalidQuery: (error) =>
        Effect.succeed({
          status: 400,
          body: { error: error.message },
        } satisfies HttpResponse),
      DatabaseError: (error) => {
        console.error("GET /subjects error:", error);
        return Effect.succeed({
          status: 500,
          body: { error: "Failed to get subjects" },
        } satisfies HttpResponse);
      },
    }),
    Effect.runPromise,
  );

  res.status(response.status).json(response.body);
});

router.post("/", async (req, res) => {
  const response = await createSubject(req.body).pipe(
    Effect.provide(DatabaseLive),
    Effect.map((result): HttpResponse => ({ status: 201, body: result })),
    Effect.catchTags({
      InvalidQuery: (error) =>
        Effect.succeed({
          status: 400,
          body: { error: error.message },
        } satisfies HttpResponse),
      DatabaseError: (error) => {
        console.error("POST /subjects error:", error);
        return Effect.succeed({
          status: 500,
          body: { error: "Failed to create subject" },
        } satisfies HttpResponse);
      },
    }),
    Effect.runPromise,
  );

  res.status(response.status).json(response.body);
});

export default router;
