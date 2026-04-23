export const APP_NAME = 'mutursd-backend';
export const APP_DISPLAY_NAME = 'Mutu RSD Backend';
export const APP_VERSION = '1.0.0';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';
export const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export const JWT_DEFAULT_EXPIRES_IN = '1d';
export const BCRYPT_SALT_ROUNDS = 10;

export const ROLE = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  RUANGAN: 'ruangan'
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const PRIVILEGED_ROLES: readonly Role[] = [ROLE.SUPERADMIN, ROLE.ADMIN] as const;

export const DEFAULT_ROLE: Role = ROLE.RUANGAN;

export const PAGINATION_DEFAULTS = {
  page: DEFAULT_PAGE,
  limit: DEFAULT_LIMIT,
  maxLimit: MAX_LIMIT
} as const;