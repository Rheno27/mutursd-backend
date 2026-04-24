import jwt from 'jsonwebtoken';
import { env } from './getenv';
import { DEFAULT_ROLE, JWT_DEFAULT_EXPIRES_IN, ROLE, type Role } from './constant';
import { UnauthorizedError } from './errors';

export interface JwtUserSeed {
  idUser: string;
  username: string;
  idRuangan?: string | number | null;
  namaRuangan?: string | null;
  role?: Role | string | null;
}

export interface AccessTokenPayload {
  idUser: string;
  username: string;
  idRuangan: string;
  namaRuangan: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface AuthUserContext extends AccessTokenPayload {
  token?: string;
}

function normalizeRole(role?: Role | string | null, username?: string, idRuangan?: string): Role {
  const normalizedRole = typeof role === 'string' ? role.toLowerCase().trim() : '';

  if (normalizedRole === ROLE.ADMIN || normalizedRole === ROLE.SUPERADMIN || normalizedRole === ROLE.RUANGAN) {
    return normalizedRole as Role;
  }

  if (typeof username === 'string' && username.trim().toLowerCase() === 'superadmin') {
    return ROLE.SUPERADMIN;
  }

  if (!idRuangan || idRuangan === '0' || idRuangan.toUpperCase() === 'SP00') {
    return ROLE.SUPERADMIN;
  }

  return DEFAULT_ROLE;
}

export function buildAccessTokenPayload(user: JwtUserSeed): AccessTokenPayload {
  const idRuangan = user.idRuangan === undefined || user.idRuangan === null ? '' : String(user.idRuangan);
  const namaRuangan = user.namaRuangan === undefined || user.namaRuangan === null ? '' : String(user.namaRuangan);
  const role = normalizeRole(user.role, user.username, idRuangan);

  return {
    idUser: String(user.idUser),
    username: String(user.username),
    idRuangan,
    namaRuangan,
    role
  };
}

export function toAuthUserContext(payload: AccessTokenPayload, token?: string): AuthUserContext {
  return {
    ...payload,
    token
  };
}

export function signAccessToken(payload: JwtUserSeed | AccessTokenPayload, expiresIn: string = env.JWT_EXPIRES_IN || JWT_DEFAULT_EXPIRES_IN): string {
  const tokenPayload = 'iat' in payload || 'exp' in payload ? payload : buildAccessTokenPayload(payload);
  return jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string' || decoded === null) {
      throw new UnauthorizedError('Invalid access token');
    }

    const payload = decoded as Partial<AccessTokenPayload>;
    if (!payload.idUser || !payload.username) {
      throw new UnauthorizedError('Invalid access token payload');
    }

    const idRuangan = payload.idRuangan === undefined || payload.idRuangan === null ? '' : String(payload.idRuangan);

    return {
      idUser: String(payload.idUser),
      username: String(payload.username),
      idRuangan,
      namaRuangan: payload.namaRuangan === undefined || payload.namaRuangan === null ? '' : String(payload.namaRuangan),
      role: normalizeRole(payload.role, payload.username, idRuangan),
      iat: payload.iat,
      exp: payload.exp
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export function decodeAccessToken(token: string): AccessTokenPayload | null {
  const decoded = jwt.decode(token);
  if (typeof decoded === 'string' || decoded === null) {
    return null;
  }

  const payload = decoded as Partial<AccessTokenPayload>;
  if (!payload.idUser || !payload.username) {
    return null;
  }

  const idRuangan = payload.idRuangan === undefined || payload.idRuangan === null ? '' : String(payload.idRuangan);

  return {
    idUser: String(payload.idUser),
    username: String(payload.username),
    idRuangan,
    namaRuangan: payload.namaRuangan === undefined || payload.namaRuangan === null ? '' : String(payload.namaRuangan),
    role: normalizeRole(payload.role, payload.username, idRuangan),
    iat: payload.iat,
    exp: payload.exp
  };
}

export function isPrivilegedJwtRole(role: Role | string | undefined | null): boolean {
  const normalized = typeof role === 'string' ? role.toLowerCase().trim() : '';
  return normalized === ROLE.ADMIN || normalized === ROLE.SUPERADMIN;
}

export function resolveRoleFromUser(user: JwtUserSeed): Role {
  return buildAccessTokenPayload(user).role;
}
