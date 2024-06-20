import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schemas';

dotenv.config();

export const client = postgres(process.env.DATABASE_URI, { prepare: false });
export const db = drizzle(client, { schema });
