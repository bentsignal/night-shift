import type { Linter } from "eslint";
import convexPlugin from "@convex-dev/eslint-plugin";
import { defineConfig } from "eslint/config";

import { baseConfig } from "@code/eslint-config/base";
import { convexConfig } from "@code/eslint-config/convex";
import { createStrictSyntax } from "@code/eslint-config/syntax";

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
