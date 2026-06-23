import { Effect } from "effect";
import express from "express";
import { DatabaseLive } from "../features/database/index.js";
import { listSubjects } from "../features/subjects/list-subjects.js";

const router = express.Router();

type HttpResponse = {
  status: 200 | 400 | 500;
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

export default router;
