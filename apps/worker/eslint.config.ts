import { defineConfig } from "eslint/config";

import { baseConfig } from "@code/eslint-config/base";
import { createStrictSyntax } from "@code/eslint-config/syntax";

export default defineConfig(baseConfig, createStrictSyntax({ ts: true }));
