import bcrypt from 'bcrypt';
import moment from 'moment';
import { Response } from 'express';
import { BCRYPT_SALT_ROUNDS, DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from './constant';

export interface ApiEnvelope<T = any> {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown;
}

export interface PaginationInput {
  page?: unknown;
  limit?: unknown;
}

export interface PaginationResult {
  page: number;
  limit: number;
  offset: number;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseIntSafe(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  return fallback;
}

export function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

export function parsePagination(input: PaginationInput = {}): PaginationResult {
  const page = Math.max(1, parseIntSafe(input.page, DEFAULT_PAGE));
  const requestedLimit = parseIntSafe(input.limit, DEFAULT_LIMIT);
  const limit = Math.min(MAX_LIMIT, Math.max(1, requestedLimit));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function normalizeDate(value: unknown, format = 'YYYY-MM-DD'): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = moment(value as moment.MomentInput);
  if (!parsed.isValid()) {
    return undefined;
  }

  return parsed.format(format);
}

export function normalizeDateTime(value: unknown, format = 'YYYY-MM-DD HH:mm:ss'): string | undefined {
  return normalizeDate(value, format);
}

export function buildEnvelope<T = any>(success: boolean, message: string, data: T, errors?: unknown): ApiEnvelope<T> {
  const envelope: ApiEnvelope<T> = { success, message, data };
  if (errors !== undefined) {
    envelope.errors = errors;
  }
  return envelope;
}

export function sendEnvelope<T = any>(
  res: Response,
  statusCode: number,
  success: boolean,
  message: string,
  data: T,
  errors?: unknown
): Response {
  return res.status(statusCode).json(buildEnvelope(success, message, data, errors));
}

export function sendSuccess<T = any>(res: Response, message: string, data: T = null as T, statusCode = 200): Response {
  return sendEnvelope(res, statusCode, true, message, data);
}

export function sendError(res: Response, statusCode: number, message: string, errors?: unknown): Response {
  return sendEnvelope(res, statusCode, false, message, null, errors);
}

export function omitFields<T extends Record<string, any>, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const clone = { ...value } as Record<string, any>;
  for (const key of keys) {
    delete clone[key as string];
  }
  return clone as Omit<T, K>;
}

export function pickFields<T extends Record<string, any>, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  const picked = {} as Pick<T, K>;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      picked[key] = value[key];
    }
  }
  return picked;
}

export function compactObject<T extends Record<string, any>>(value: T): Partial<T> {
  const result: Partial<T> = {};
  (Object.keys(value) as Array<keyof T>).forEach((key) => {
    const current = value[key];
    if (current !== undefined && current !== null && current !== '') {
      result[key] = current;
    }
  });
  return result;
}

export function isBcryptHash(value: unknown): value is string {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

export async function hashPassword(password: string, rounds = BCRYPT_SALT_ROUNDS): Promise<string> {
  return bcrypt.hash(password, rounds);
}

export async function comparePassword(candidate: string, stored: string): Promise<boolean> {
  if (isBcryptHash(stored)) {
    return bcrypt.compare(candidate, stored);
  }

  return candidate === stored;
}

export function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value];
}