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
    limitsNavigationsToAppBoundDomains: true,
    appendUserAgent: 'Archivo-iOS',
    scrollEnabled: true,
    allowsLinkPreview: true,
    webkitSettings: {
      allowsBackForwardNavigationGestures: true,
      allowsInlineMediaPlayback: true,
      mediaTypesRequiringUserActionForPlayback: ['none']
    }
  },
  android: {
    backgroundColor: '#ffffff'
  }
};

export default config;