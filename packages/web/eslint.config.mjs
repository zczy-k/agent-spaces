import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendor files:
    "public/monaco/**",
    "inspect-source-loader.cjs",
  ]),
  // Downgrade strict rules to warnings for MVP
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      // TipTap/shadcn SDK types are incomplete; suppress during MVP
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow underscore-prefixed variables for destructuring exclusion patterns
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "destructuredArrayIgnorePattern": "^_" }],
    },
  },
]);

export default eslintConfig;
