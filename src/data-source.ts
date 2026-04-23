import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './getenv';

const baseDir = __dirname.replace(/\\/g, '/');
const entityGlobs = [`${baseDir}/entities/*.entity.ts`, `${baseDir}/entities/*.entity.js`];

export const AppDataSource = new DataSource({
  type: 'mysql',
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
  charset: 'utf8mb4',
  connectTimeout: 10000,
  extra: {
    connectionLimit: 10
  }
});

export default AppDataSource;