import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { createRequire } from 'module';

var require = createRequire(import.meta.url);
var module = { exports: {} };

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
    // Third party agent skills, not app code.
    ".claude/**",
    // react-email preview build.
    ".react-email/**",
  ]),
]);

export default eslintConfig;
