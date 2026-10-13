import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Generated Next artifacts only; application source stays in the canonical checkout.
const root = path.resolve(import.meta.dirname, '..');
const directory = path.join(root, '.tmp/auth-navigation-2026-10-14');
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, 'next-adapter.mjs'), `export default { name: 'isolated-auth-navigation', modifyConfig(config) {
  return { ...config, distDir: '../../.tmp/auth-navigation-2026-10-14/next', typescript: { ...config.typescript, tsconfigPath: '../../.tmp/auth-navigation-2026-10-14/tsconfig.json' } };
} };
`);
await writeFile(path.join(directory, 'tsconfig.json'), JSON.stringify({
  extends: '../../apps/web/tsconfig.json', compilerOptions: { tsBuildInfoFile: './web.tsbuildinfo' },
  include: ['../../apps/web/**/*.ts', '../../apps/web/**/*.tsx', './next/types/**/*.ts'],
  exclude: ['../../node_modules', '../../apps/web/.next'],
}) + '\n');
console.log('Prepared isolated auth-navigation Next adapter and TypeScript configuration.');
