import AppErrorBoundary from "@/shared/components/app-error-boundary";
import SplashScreen from "@/app/splash-screen";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";

export default function Root() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <SplashScreen />
        <AppRouter />
      </AppProviders>
    </AppErrorBoundary>
  );
}
