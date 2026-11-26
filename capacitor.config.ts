import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'mz.fintrack.app',
  appName: 'FinTrack',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
