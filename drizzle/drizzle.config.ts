import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/database/schemas/*',
  out: './drizzle/migrations/',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URI
  }
} satisfies Config;
