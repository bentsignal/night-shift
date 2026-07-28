import { defineConfig } from "eslint/config";

import { baseConfig } from "@night-shift/eslint-config/base";
import { createStrictSyntax } from "@night-shift/eslint-config/syntax";

export default defineConfig(baseConfig, createStrictSyntax({ ts: true }));
