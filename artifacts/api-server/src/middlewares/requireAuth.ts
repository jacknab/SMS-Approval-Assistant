import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export const requireAuth: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to access this resource." });
    return;
  }

  res.locals.userId = userId;
  next();
};
