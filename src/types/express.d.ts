import type { AuthUserContext } from "../jwt.util";

declare module "express-serve-static-core" {
  interface Request {
    authUser?: AuthUserContext;
  }
}

export {};
