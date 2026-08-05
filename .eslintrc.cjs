/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  env: { browser: true, node: true, es2022: true },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  ignorePatterns: [
    "node_modules/",
    ".next/",
    ".turbo/",
    "dist/",
    "docs/referencia/",
    "*.cjs",
    "*.config.js",
    // Gerado pelo Next a cada build; não é código nosso.
    "apps/web/next-env.d.ts",
    // Preset do Tailwind consumido por ferramentas CommonJS.
    "packages/config/index.js",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
};
