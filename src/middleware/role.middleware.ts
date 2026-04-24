import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors';
import { ROLE, type Role } from '../constant';

export type AllowedRole = Role;

export function hasRoleAccess(userRole: Role | undefined, allowedRoles: readonly AllowedRole[]): boolean {
  if (!userRole) {
    return false;
  }

  if (userRole === ROLE.SUPERADMIN) {
    return true;
  }

  if (allowedRoles.length === 0) {
    return true;
  }

  return allowedRoles.includes(userRole);
}

export function roleMiddleware(...allowedRoles: AllowedRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.authUser) {
        throw new UnauthorizedError('Authentication is required');
      }

      if (!hasRoleAccess(req.authUser.role, allowedRoles)) {
        throw new ForbiddenError('You do not have permission to access this resource');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function isPrivilegedRole(role: Role | undefined): boolean {
  return role === ROLE.SUPERADMIN;
}
