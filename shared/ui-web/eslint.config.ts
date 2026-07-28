import { defineConfig } from "eslint/config";

import { baseConfig } from "@night-shift/eslint-config/base";
import { reactConfig } from "@night-shift/eslint-config/react";
import { createStrictSyntax } from "@night-shift/eslint-config/syntax";

export default defineConfig(
  baseConfig,
  reactConfig,
  createStrictSyntax({ ts: true, react: true, web: true }),
);
