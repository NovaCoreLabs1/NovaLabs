#!/usr/bin/env node
/**
 * Schema-drift gate (issue #228).
 *
 * Runs `typeorm migration:generate` against a fully migrated database:
 *   - "No changes in database schema were found"  → PASS
 *   - a generated migration with statements        → FAIL (drift)
 *
 * A non-empty diff means an entity changed without an accompanying
 * migration, i.e. the committed migrations no longer reproduce the schema
 * the entities describe. Requires a reachable PostgreSQL instance via the
 * DATABASE_* variables (see backend/src/config/typeorm.config.ts) with all
 * migrations already applied (`npm run typeorm:run-migrations`).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const { mkdtempSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');
const process = require('process');

const backendDir = join(__dirname, '..', 'backend');
const workDir = mkdtempSync(join(tmpdir(), 'schema-drift-'));

let exitCode = 0;
try {
  const result = execFileSync(
    'npm',
    [
      'run',
      'typeorm',
      '--',
      'migration:generate',
      join(workDir, 'DriftCheck'),
      '-d',
      './src/config/typeorm.config.ts',
    ],
    {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    },
  );

  // migration:generate exited 0 — it wrote a migration, which by definition
  // means the entities differ from the migrated schema.
  const generated = fs
    .readdirSync(workDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => fs.readFileSync(join(workDir, f), 'utf8'))
    .join('\n');

  console.error(
    '\n✖ SCHEMA DRIFT DETECTED — entity definitions no longer match the committed migrations.\n' +
      '  Generate a migration for the entity change and commit it together:\n' +
      '    npm run typeorm:generate-migration --name=DescribeChange\n' +
      '  Generated diff:\n\n' +
      generated,
  );
  exitCode = 1;
} catch (error) {
  const output = `${error.stdout || ''}${error.stderr || ''}`;

  if (/No changes in database schema were found/.test(output)) {
    console.log('✔ No schema drift — migrations match entity definitions.');
  } else {
    console.error(
      '\n✖ schema-drift check could not run. Verify the DATABASE_* variables point at a database with all migrations applied.\n' +
        output,
    );
    exitCode = 1;
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

process.exit(exitCode);
