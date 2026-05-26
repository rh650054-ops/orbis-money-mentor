import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const restrictedImports = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["@/integrations/supabase/client"],
          message:
            "Direct Supabase imports are banned outside @/shared/api/** and @/features/*/api/**. Use @/shared/api.",
        },
        {
          group: ["@/features/*/*", "!@/features/*/index"],
          message:
            "Cross-feature internal imports are banned. Import only via @/features/<name> (the feature's root index.ts).",
        },
      ],
    },
  ],
};

export default tseslint.config(
  { ignores: ["dist", "tailwind.config.ts", "supabase/functions/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      ...restrictedImports,
    },
  },
  // Allowed Supabase importers: the @/shared/api facade itself + per-feature api/ folders.
  {
    files: ["src/shared/api/**/*.{ts,tsx}", "src/features/*/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Legacy escape hatch: pre-Phase-1 files still import Supabase directly and use `any`.
  // Each Phase 1 feature migration deletes the legacy file, so the exemption disappears
  // file-by-file. Phase 2.1 confirms this block is unreachable and removes it.
  // src/shared/lib/** and src/app/layout.tsx are transition holdovers cleaned up by Phase 1.
  {
    files: [
      "src/pages/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/utils/**/*.{ts,tsx}",
      "src/shared/lib/**/*.{ts,tsx}",
      "src/app/layout.tsx",
    ],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Test setup and msw-server need to import Node globals.
  {
    files: ["src/test/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "vitest.config.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
);
