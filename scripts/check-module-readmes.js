#!/usr/bin/env node

/**
 * CI check: verifies every backend module directory under `backend/src/`
 * contains a README.md file.
 *
 * Fails with exit code 1 and a report listing any missing READMEs.
 *
 * Usage:
 *   node scripts/check-module-readmes.js
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'backend', 'src');

// Directories to skip (not modules, no module.ts)
const SKIP = ['types'];

// Existing module directories that have a *.module.ts file or are
// established NestJS modules
function isModuleDir(dirPath) {
  if (SKIP.includes(path.basename(dirPath))) return false;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.some(
    (e) => e.isFile() && e.name.endsWith('.module.ts'),
  );
}

function checkReadmes() {
  const entries = fs.readdirSync(SRC_DIR, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());

  const missing = [];

  for (const dir of dirs) {
    const dirPath = path.join(SRC_DIR, dir.name);
    if (!isModuleDir(dirPath)) continue;

    const readmePath = path.join(dirPath, 'README.md');
    if (!fs.existsSync(readmePath)) {
      missing.push(`backend/src/${dir.name}/README.md`);
    }
  }

  if (missing.length > 0) {
    console.error(
      `❌ Missing README.md files in ${missing.length} backend module(s):`,
    );
    for (const m of missing) {
      console.error(`   - ${m}`);
    }
    console.error(
      '\nEach backend module folder must contain a README.md with:',
    );
    console.error('   purpose, key entities, endpoints, and key files.');
    console.error('See backend/src/users/README.md for a reference.\n');
    process.exit(1);
  }

  console.log('✅ All backend modules have README.md files.');
  process.exit(0);
}

checkReadmes();
