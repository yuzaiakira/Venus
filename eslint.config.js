import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  {
    ignores: [
      ".output/**",
      ".output-beta/**",
      ".output-release/**",
      ".wxt/**",
      "node_modules/**",
      "contracts/**",
      "evidence/**",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}", "entrypoints/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXSpreadAttribute",
          message: "Do not spread untrusted props into rendered elements.",
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Render untrusted content as text; raw HTML is prohibited.",
        },
        {
          selector:
            "MemberExpression[property.name=/^(innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML)$/]",
          message: "Raw HTML sinks are prohibited in application code.",
        },
        {
          selector: "Property[key.name='dangerouslySetInnerHTML']",
          message: "Raw HTML props are prohibited.",
        },
        {
          selector:
            "Literal[value=/^(innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML)$/]",
          message: "Computed raw HTML sinks are prohibited.",
        },
      ],
    },
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
      },
    },
  },
);
