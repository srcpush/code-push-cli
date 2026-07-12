import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "bin/**", "tests/helpers/superagent-mock-config.js"],
  },
  {
    files: ["tests/**/*.ts", "tests/**/*.js"],
    rules: {
      "no-var": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      eqeqeq: "off",
      "no-empty": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "no-case-declarations": "off",
      "no-useless-catch": "off",
      "prefer-rest-params": "off",
      "@typescript-eslint/no-namespace": "off",
      "preserve-caught-error": "off",
    },
  },
);
