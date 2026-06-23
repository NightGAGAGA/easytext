import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rymond.easytext',
  appName: 'EasyText',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
