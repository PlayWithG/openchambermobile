import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.openchamber.mobile',
  appName: 'OpenChamber',
  webDir: '../ui/dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    StatusBar: {
      style: 'DARK',
    },
  },
  android: {
    minSdkVersion: 26,
    targetSdkVersion: 34,
    allowMixedContent: true,
  },
};

export default config;