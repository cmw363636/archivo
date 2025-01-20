import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.archivo.app',
  appName: 'Archivo',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'],
    cleartext: true,
    hostname: 'app',
    iosScheme: 'archivo'
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: false,
    appendUserAgent: 'Archivo-iOS',
    scrollEnabled: true,
    allowsLinkPreview: true,
    backgroundColor: '#ffffff',
    scheme: 'archivo',
    webkitConfiguration: {
      allowsInlineMediaPlayback: true,
      allowsAirPlayForMediaPlayback: true,
      mediaTypesRequiringUserActionForPlayback: ['none'],
      allowsBackForwardNavigationGestures: true
    }
  },
  android: {
    backgroundColor: '#ffffff'
  }
};

export default config;