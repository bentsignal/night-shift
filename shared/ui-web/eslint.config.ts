import { defineConfig } from "eslint/config";

import { baseConfig } from "@code/eslint-config/base";
import { reactConfig } from "@code/eslint-config/react";
import { createStrictSyntax } from "@code/eslint-config/syntax";

export default defineConfig(
  baseConfig,
  reactConfig,
  createStrictSyntax({ ts: true, react: true, web: true }),
);
