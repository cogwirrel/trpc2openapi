export default {
  'packages/**/*.{ts,tsx,js,json,md,html,css,scss}': [
    'pnpm nx format:write --uncommitted',
  ],
  '*.{js,mjs,md,json}': ['pnpm nx format:write --uncommitted'],
};
