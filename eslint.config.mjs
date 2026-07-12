import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "bin/**"],
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: "error",
      "no-eval": "error",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  }
);
