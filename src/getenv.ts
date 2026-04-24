import path from "path";
import dotenv from "dotenv";
import { AppError } from "./errors";

const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "..", ".env"),
];

for (const envPath of envPaths) {
  dotenv.config({
    path: envPath,
    override: true,
  });
}

export type RequiredEnvKey =
  | 'DB_HOST'
  | 'DB_PORT'
  | 'DB_USERNAME'
  | 'DB_PASSWORD'
  | 'DB_NAME'
  | 'JWT_SECRET'
  | 'JWT_EXPIRES_IN'
  | 'NODE_ENV'
  | 'APP_PORT';

export interface AppEnv {
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  NODE_ENV: string;
  APP_PORT: number;
}

const requiredKeys: readonly RequiredEnvKey[] = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'NODE_ENV',
  'APP_PORT'
] as const;

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

export function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
  const value = process.env[key];
  if (isEmpty(value)) {
    return defaultValue;
  }

  return String(value).trim();
}

export function getEnv(key: RequiredEnvKey): string {
  const value = process.env[key];
  if (isEmpty(value)) {
    throw new AppError(`Missing required environment variable: ${key}`, {
      statusCode: 500,
      code: 'MISSING_ENV'
    });
  }

  return String(value).trim();
}

function getRequiredNumberEnv(key: 'DB_PORT' | 'APP_PORT'): number {
  const rawValue = getEnv(key);
  const parsedValue = Number.parseInt(rawValue, 10);

  if (Number.isNaN(parsedValue)) {
    throw new AppError(`Environment variable ${key} must be a valid integer`, {
      statusCode: 500,
      code: 'INVALID_ENV',
      details: { key, value: rawValue }
    });
  }

  return parsedValue;
}

export const env: AppEnv = {
  DB_HOST: getEnv('DB_HOST'),
  DB_PORT: getRequiredNumberEnv('DB_PORT'),
  DB_USERNAME: getEnv('DB_USERNAME'),
  DB_PASSWORD: getEnv('DB_PASSWORD') || '',
  DB_NAME: getEnv('DB_NAME'),
  JWT_SECRET: getEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN'),
  NODE_ENV: getEnv('NODE_ENV'),
  APP_PORT: getRequiredNumberEnv('APP_PORT')
};

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

export function assertRequiredEnv(): AppEnv {
  return env;
}

export function getRequiredEnvKeys(): readonly RequiredEnvKey[] {
  return requiredKeys;
}
