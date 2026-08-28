import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/db/schema.ts',
    out: './drizzle',
    dbCredentials: {
        host: process.env.HOST ?? 'localhost',
        port: process.env.PORT ? parseInt(process.env.PORT) : 5432,
        user: process.env.DBUSER,
        password: process.env.DBPASS,
        database: process.env.DATABASE ?? 'discord_bot',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    },
    // Keep generated SQL close to how the schema was dumped.
    casing: 'snake_case',
});
