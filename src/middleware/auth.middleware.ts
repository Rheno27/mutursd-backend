import type { NextFunction, Request, Response, RequestHandler } from "express";
import { UnauthorizedError } from "../errors";
import { toAuthUserContext, verifyAccessToken } from "../jwt.util";

function extractToken(req: Request): string | undefined {
  const authorization = req.headers.authorization;
  if (typeof authorization === "string" && authorization.trim().length > 0) {
    const [scheme, value] = authorization.split(" ");
    if (scheme?.toLowerCase() === "bearer" && value) {
      return value.trim();
    }
  }

  const headerToken = req.headers["x-access-token"];
  if (typeof headerToken === "string" && headerToken.trim().length > 0) {
    return headerToken.trim();
  }

  if (Array.isArray(headerToken)) {
    const firstToken = headerToken[0];
    if (typeof firstToken === "string" && firstToken.trim().length > 0) {
      return firstToken.trim();
    }
  }

  return undefined;
}

export const authMiddleware: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedError("Access token is required");
    }

    const payload = verifyAccessToken(token);
    req.authUser = toAuthUserContext(payload, token);
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }

    next(new UnauthorizedError("Invalid or expired access token"));
  }
};

export function getAuthTokenFromRequest(req: Request): string | undefined {
  return extractToken(req);
}
