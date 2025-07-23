module.exports = {
  env: { browser: true, es2022: true },
  extends: ["eslint:recommended", "plugin:import/recommended", "prettier"],
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["import", "prettier"],
  rules: {
    "prettier/prettier": "error",
    "import/order": ["warn", { "newlines-between": "always" }]
  }
};
