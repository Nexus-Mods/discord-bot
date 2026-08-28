import { spawnSync } from 'node:child_process';

// Runs the same config with the two async rules promoted to errors, so the Phase 2
// worklist has an exit code.
//
// This cannot be done with `eslint --rule`: in a flat config, a rule supplied on the
// command line is applied at the top level, where the @typescript-eslint plugin is
// not defined, and eslint refuses it. An env var read by the config works instead.
const result = spawnSync('npx', ['eslint', '.'], {
    stdio: 'inherit',
    env: { ...process.env, LINT_STRICT_ASYNC: 'true' },
    shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
