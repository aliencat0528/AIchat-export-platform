/* ESLint 設定 - AIchat Export Platform
 * 繼承根目錄程式風格：JS/TS 單引號、2 spaces、行寬 100
 * 目標：抓真錯（未用變數、未定義、Vue 模板錯誤），風格只enforce高信號規則
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
    webextensions: true,
  },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-essential',
  ],
  rules: {
    // 對齊根 CLAUDE.md 風格（高信號、與現有程式一致）
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    // 放寬：既有程式碼可能有 any / _ 前綴參數，降為警告避免噪音但仍提醒
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    'vue/multi-word-component-names': 'off',
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.config.ts',
    '*.config.js',
    'vite.config.*',
  ],
};
