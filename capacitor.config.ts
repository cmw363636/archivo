import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.archivo.app',
  appName: 'Archivo',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'],
    cleartext: true
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: false,
    appendUserAgent: 'Archivo-iOS',
    scrollEnabled: true,
    allowsLinkPreview: true,
    backgroundColor: '#ffffff',
    scheme: 'archivo'
  },
  android: {
    backgroundColor: '#ffffff'
  }
};

export default config;