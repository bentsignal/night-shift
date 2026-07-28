import { defineConfig } from "eslint/config";

import { baseConfig } from "@code/eslint-config/base";
import { reactConfig } from "@code/eslint-config/react";
import { createStrictSyntax } from "@code/eslint-config/syntax";

export default defineConfig(
  { ignores: [".expo/**", "expo-plugins/**"] },
  baseConfig,
  reactConfig,
  createStrictSyntax({ ts: true, react: true, mobile: true }),
);
