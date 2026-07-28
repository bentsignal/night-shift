import * as path from "node:path";
import type { Rule } from "eslint";
import { defineConfig } from "eslint/config";

const noHyphenatedFilesRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow hyphenated Convex source filenames.",
    },
    messages: {
      noHyphenatedFiles:
        "Convex files cannot use hyphens. Replace hyphens with underscores.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const filename = context.filename;
        const basename = path.basename(filename, path.extname(filename));
        if (!basename.includes("-")) return;

        context.report({
          node,
          messageId: "noHyphenatedFiles",
        });
      },
    };
  },
} satisfies Rule.RuleModule;

export const convexConfig = defineConfig({
  files: ["src/**/*.{ts,tsx,js,jsx}"],
  plugins: {
    convexLocal: {
      rules: {
        "no-hyphenated-files": noHyphenatedFilesRule,
      },
    },
  },
  rules: {
    "convexLocal/no-hyphenated-files": "error",
  },
});
