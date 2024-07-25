import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: ["**/node_modules", "**/dist"]
}, ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended"
), {
    plugins: {
        "@typescript-eslint": typescriptEslint
    },

    languageOptions: {
        parser: tsParser
    },

    rules: {
        "arrow-spacing": ["warn", {
            before: true,
            after: true
        }],
        "comma-dangle": ["error", "never"],
        "comma-spacing": "error",
        "comma-style": "error",
        curly: ["error", "multi-line", "consistent"],
        "dot-location": ["error", "property"],
        "handle-callback-err": "off",
        indent: ["error", 4, { SwitchCase: 1 }],
        "keyword-spacing": "error",
        "max-nested-callbacks": ["error", {
            max: 4
        }],
        "max-statements-per-line": ["error", {
            max: 2
        }],
        "no-console": "off",
        "no-case-declarations": "off",
        "@typescript-eslint/no-duplicate-enum-values": "off",
        "no-empty-function": "error",
        "no-fallthrough": "off",
        "no-floating-decimal": "error",
        "no-lonely-if": "error",
        "no-multi-spaces": "error",
        "no-multiple-empty-lines": ["error", {
            max: 2,
            maxEOF: 1,
            maxBOF: 0
        }],
        "@typescript-eslint/no-shadow": "error",
        "no-trailing-spaces": ["error"],
        "no-var": "error",
        "object-curly-spacing": ["error", "always"],
        "prefer-const": "error",
        quotes: ["error", "double"],
        semi: ["error", "always"],
        "space-before-blocks": "error",
        "space-before-function-paren": ["error", {
            anonymous: "never",
            named: "never",
            asyncArrow: "always"
        }],
        "space-in-parens": "error",
        "space-infix-ops": "error",
        "space-unary-ops": "error",
        yoda: "error"
    }
}];