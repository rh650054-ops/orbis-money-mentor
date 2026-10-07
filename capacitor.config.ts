import type { CapacitorConfig } from '@capacitor/cli';

/*
 * Native shell for the Play Store / App Store builds.
 *
 * The store app ships the built web bundle (dist/) inside the binary. It does NOT
 * load app.orbis.inf.br remotely: Apple rejects "website wrappers" (guideline 4.2)
 * and a remote URL would also pull the Hotmart checkout into the store build.
 *
 * Live reload is opt-in for development only:
 *   CAP_DEV_SERVER=http://192.168.0.10:8080 npx cap run android
 * Without that variable the build is production-safe. (Before 07/10/2026 the
 * dev URL was hardcoded here, which would have shipped a blank app.)
 *
 * appId is PERMANENT once the first build is uploaded to either store.
 * Confirm it before the first upload.
 */
const devServer = process.env.CAP_DEV_SERVER;

const config: CapacitorConfig = {
  appId: 'app.vant.vendas',
  appName: 'VANT',
  webDir: 'dist',
  ...(devServer
    ? { server: { url: devServer, cleartext: true } }
    : {}),
  android: {
    backgroundColor: '#000000',
  },
  ios: {
    backgroundColor: '#000000',
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#000000',
      showSpinner: false,
    },
  },
};

export default config;
