import type { Linter } from "eslint";
import convexPlugin from "@convex-dev/eslint-plugin";
import { defineConfig } from "eslint/config";

import { baseConfig } from "@night-shift/eslint-config/base";
import { convexConfig } from "@night-shift/eslint-config/convex";
import { createStrictSyntax } from "@night-shift/eslint-config/syntax";

const convexRecommendedConfig = convexPlugin.configs.recommended.map(
  (config: Linter.Config) => ({
    ...config,
    files: ["src/**/*.ts"],
  }),
);

export default defineConfig(
  {
    ignores: ["src/_generated/**"],
  },
  baseConfig,
  convexConfig,
  createStrictSyntax({ ts: true }),
  ...convexRecommendedConfig,
);
