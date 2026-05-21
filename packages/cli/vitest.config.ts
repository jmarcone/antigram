import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    // Subprocess-spawn tests can be slow; bump timeouts and run sequentially
    // so concurrent reclaim runs don't race on shared exiftool processes.
    testTimeout: 120_000,
    hookTimeout: 60_000,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
