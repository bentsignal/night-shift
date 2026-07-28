/** @type {import("prettier").Config} */
const config = {
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
  ],
  importOrder: [
    "<TYPES>",
    "^(react(.*)$)",
    "^(@tanstack/(.*)$)",
    "<THIRD_PARTY_MODULES>",
    "",
    "<TYPES>^@night-shift",
    "^@night-shift/(.*)$",
    "",
    "<TYPES>^[.|..|~]",
    "^~/",
    "^[../]",
    "^[./]",
  ],
  importOrderParserPlugins: ["typescript", "jsx"],
};

export default config;
