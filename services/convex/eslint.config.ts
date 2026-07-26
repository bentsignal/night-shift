import { defineConfig } from "eslint/config";

import { baseConfig } from "@code/eslint-config/base";

export default defineConfig(
  {
    ignores: ["src/_generated/**"],
  },
  baseConfig,
);
