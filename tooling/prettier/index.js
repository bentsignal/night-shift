/** @type {import("prettier").Config} */
const config = {
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
  importOrder: [
    "<TYPES>",
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
