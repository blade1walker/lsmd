import "dotenv/config";
import { defineConfig } from "prisma/config";
import { databaseFile } from "./src/lib/paths";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // For the Prisma CLI (`migrate deploy` during deploys); the app opens the
    // same file through src/lib/prisma.ts.
    url: `file:${databaseFile()}`,
  },
});
