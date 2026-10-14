import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Cache the postgres client on globalThis so it survives Next.js dev HMR.
// Without this, every code reload leaks a connection until the pooler maxes out.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    max: 10,
    // Neon's pooled URL runs PgBouncer in transaction mode, which does not
    // support prepared statements across pooled connections.
    prepare: false,
    connect_timeout: 15,
    idle_timeout: 20,
    connection: {
      statement_timeout: 30000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
