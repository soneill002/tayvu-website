// .eslintrc.cjs  (project root)
module.exports = {
  env: { browser: true, es2022: true },
  extends: ['eslint:recommended', 'plugin:import/recommended', 'prettier'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['import', 'prettier'],

  /* ➜ add this ↓ just before 'rules' */
  settings: {
    'import/resolver': {
      alias: {
        map: [['@', './src/js']], // @/ → src/js alias
        extensions: ['.js']
      }
    }
  },

  rules: {
    'prettier/prettier': 'error',
    'import/order': ['warn', { 'newlines-between': 'always' }],
    'import/no-unresolved': [
      'error',
      { ignore: ['^https?://'] } // ignore CDN URL in supabaseClient.js
    ]
  }
};
