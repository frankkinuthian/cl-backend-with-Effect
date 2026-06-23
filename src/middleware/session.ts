import type { NextFunction, Request, Response } from "express";
import { auth } from "../lib/auth.js";
import { toNodeHandler } from "better-auth/node";

/**
 * Resolves the Better Auth session from the incoming request and attaches
 * the user role to req.user so downstream middleware (e.g. Arcjet rate
 * limiting) can apply the correct per-role limits.
 *
 * Unauthenticated requests pass through with req.user left undefined.
 */
const sessionMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await auth.api.getSession({
      headers: new Headers(req.headers as Record<string, string>),
    });

    if (session?.user) {
      const role = session.user.role as UserRoles | undefined;
      req.user = role ? { role } : {};
    }
  } catch {
    // Session resolution failure is non-fatal — treat as guest.
  }

  next();
};

export default sessionMiddleware;
