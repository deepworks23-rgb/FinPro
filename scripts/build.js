import { spawnSync } from 'node:child_process';

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const res = spawnSync(npxCmd, ['vite', 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    RAYON_NUM_THREADS: '1',
  },
});

process.exit(res.status ?? 0);
