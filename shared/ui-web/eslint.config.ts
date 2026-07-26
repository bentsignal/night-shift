import { defineConfig } from "eslint/config";

import { baseConfig } from "@code/eslint-config/base";
import { reactConfig } from "@code/eslint-config/react";

export default defineConfig(baseConfig, reactConfig);
