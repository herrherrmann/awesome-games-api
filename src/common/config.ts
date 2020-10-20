import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const IGDB_API: string = 'https://api.igdb.com/v4';
export const TWITCH_CLIENT_ID: string = process.env.TWITCH_CLIENT_ID;
export const TWITCH_CLIENT_SECRET: string = process.env.TWITCH_CLIENT_SECRET;
export const GITHUB_API: string = 'https://api.github.com';
export const DB_CONFIG: TypeOrmModuleOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
};
