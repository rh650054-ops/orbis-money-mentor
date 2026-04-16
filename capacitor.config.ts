import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.orbs.moneymentor',
  appName: 'ORBS',
  webDir: 'dist',
  server: {
    // Durante o desenvolvimento com `npm run dev`, use live reload apontando pro vite
    // Comente as duas linhas abaixo para build de produção
    url: 'http://10.0.2.2:8080', // 10.0.2.2 = localhost no emulador Android
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#000000',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
