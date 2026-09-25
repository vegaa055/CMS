import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Integration tests hit the database in .env.local (the Neon dev branch).
config({ path: ".env.local", quiet: true });

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
