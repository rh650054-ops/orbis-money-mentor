import AppErrorBoundary from "@/shared/components/app-error-boundary";
import SplashScreen from "@/app/splash-screen";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import { OuvinteAssinaturaLoja } from "@/shared/components/assinatura-loja";
import { useBotaoVoltarAndroid } from "@/app/botao-voltar-android";

export default function Root() {
  useBotaoVoltarAndroid();
  return (
    <AppErrorBoundary>
      <AppProviders>
        <SplashScreen />
        <AppRouter />
        <OuvinteAssinaturaLoja />
      </AppProviders>
    </AppErrorBoundary>
  );
}
