import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './getenv';

const baseDir = __dirname.replace(/\\/g, '/');
const entityGlobs = [`${baseDir}/entities/*.entity.ts`, `${baseDir}/entities/*.entity.js`];

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  entities: entityGlobs,
  migrations: [],
  subscribers: [],
  synchronize: false,
  logging: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  extra: {
    max: 10,
    connectionTimeoutMillis: 10000,
  }
});

export default AppDataSource;