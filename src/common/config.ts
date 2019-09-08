import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const IGDB_API: string = 'https://api-v3.igdb.com';
export const IGDB_API_KEY: string = process.env.IGDB_API_KEY;
export const GITHUB_API: string = 'https://api.github.com';
export const DB_CONFIG: TypeOrmModuleOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
};
