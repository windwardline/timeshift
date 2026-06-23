import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Generated / non-source artifacts — not part of the codebase to lint.
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      ".remember/**",
    ],
  },
];

export default eslintConfig;
