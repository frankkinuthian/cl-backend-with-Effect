import { slidingWindow } from "@arcjet/node";
import type { ArcjetNodeRequest } from "@arcjet/node";
import type { NextFunction, Request, Response } from "express";
import { Effect } from "effect";

import aj from "../config/arcjet.js";
import {
  ArcjetBotError,
  ArcjetError,
  ArcjetRateLimitError,
  ArcjetShieldError,
} from "../features/errors/index.js";

type HttpResponse = {
  status: 403 | 429 | 500;
  body: { error: string; message: string };
};

const getRateLimitConfig = (
  role: RateLimitRole,
): { limit: number; message: string } => {
  switch (role) {
    case "admin":
      return {
        limit: 20,
        message: "Admin request limit exceeded (20 per minute). Slow down!",
      };
    case "teacher":
    case "student":
      return {
        limit: 10,
        message: "User request limit exceeded (10 per minute). Please wait.",
      };
    default:
      return {
        limit: 25,
        message:
          "Guest request limit exceeded (5 per minute). Please sign up for higher limits.",
      };
  }
};

const runArcjet = (req: Request) =>
  Effect.gen(function* () {
    const role: RateLimitRole = req.user?.role ?? "guest";
    const { limit, message } = getRateLimitConfig(role);

    const client = aj.withRule(
      slidingWindow({ mode: "LIVE", interval: "1m", max: limit }),
    );

    const arcjetRequest: ArcjetNodeRequest = {
      headers: req.headers,
      method: req.method,
      url: req.originalUrl ?? req.url,
      socket: {
        remoteAddress: req.ip ?? req.socket.remoteAddress ?? "0.0.0.0",
      },
    };

    const decision = yield* Effect.tryPromise({
      try: () => client.protect(arcjetRequest),
      catch: (cause) => new ArcjetError({ cause }),
    });

    if (decision.isDenied() && decision.reason.isBot()) {
      return yield* Effect.fail(new ArcjetBotError());
    }

    if (decision.isDenied() && decision.reason.isShield()) {
      return yield* Effect.fail(new ArcjetShieldError());
    }

    if (decision.isDenied() && decision.reason.isRateLimit()) {
      return yield* Effect.fail(new ArcjetRateLimitError({ message }));
    }
  });

const securityMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (process.env.NODE_ENV === "test") {
    return next();
  }

  const response = await runArcjet(req).pipe(
    Effect.map(() => null),
    Effect.catchTags({
      ArcjetBotError: () =>
        Effect.succeed({
          status: 403,
          body: {
            error: "Forbidden",
            message: "Automated requests are not allowed",
          },
        } satisfies HttpResponse),
      ArcjetShieldError: () =>
        Effect.succeed({
          status: 403,
          body: {
            error: "Forbidden",
            message: "Request blocked by security policy",
          },
        } satisfies HttpResponse),
      ArcjetRateLimitError: (error) =>
        Effect.succeed({
          status: 429,
          body: { error: "Too Many Requests", message: error.message },
        } satisfies HttpResponse),
      ArcjetError: (error) => {
        console.error("Arcjet middleware error:", error.cause);
        return Effect.succeed({
          status: 500,
          body: {
            error: "Internal Server Error",
            message: "Something went wrong with the security middleware.",
          },
        } satisfies HttpResponse);
      },
    }),
    Effect.runPromise,
  );

  if (response !== null) {
    return res.status(response.status).json(response.body);
  }

  next();
};

export default securityMiddleware;
