/**
 * Node.js ESM custom loader — maps @/ imports to src/
 *
 * Usage:
 *   node --experimental-loader ./scripts/alias-loader.mjs scripts/run-scrapers.mjs
 *
 * Required for running Next.js modules (which use @/ path aliases)
 * outside the Next.js build system — e.g., in GitHub Actions.
 */

import { fileURLToPath } from 'node:url';
import { resolve as pathResolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = pathResolve(__dirname, '../src');

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const filePath = pathResolve(SRC_ROOT, specifier.slice(2));
    return nextResolve(filePath, context);
  }
  return nextResolve(specifier, context);
}
