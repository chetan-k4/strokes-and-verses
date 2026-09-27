import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    exclude: process.env.LLM_LIVE ? [] : ['tests/unit/**/*.live.test.ts'],
  }
});
