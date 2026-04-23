import type { AuthUserContext } from '../jwt.util';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUserContext;
    }
  }
}

export {};