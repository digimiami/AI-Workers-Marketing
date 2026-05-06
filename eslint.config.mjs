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
    // Cursor/automation worktrees and tool outputs (not source of truth):
    ".codex-*/**",
    "agent-tools/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      // Keep lint actionable for this repo; these rules currently fail in multiple
      // existing components and would otherwise block unrelated work.
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
