import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const IGDB_API: string = 'https://api-v3.igdb.com';
export const IGDB_API_KEY: string = 'REPLACE_ME';
export const GITHUB_API: string = 'https://api.github.com';
export const DB_CONFIG: TypeOrmModuleOptions = {
  type: 'postgres',
  host: '',
  port: 1234,
  database: '',
  username: '',
  password: '',
};
