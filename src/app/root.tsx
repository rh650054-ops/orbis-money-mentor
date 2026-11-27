import AppErrorBoundary from "@/shared/components/app-error-boundary";
import SplashScreen from "@/app/splash-screen";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import { OuvinteAssinaturaLoja } from "@/shared/components/assinatura-loja";
import { useBotaoVoltarAndroid } from "@/app/botao-voltar-android";
import { lazy, Suspense } from "react";
import { assinaPelaApple } from "@/shared/lib/cobranca-loja";

// iPhone with native billing: recovers paid purchases the server has not confirmed yet
const RecuperadorApple = lazy(() => import("@/features/assinatura-apple").then((m) => ({ default: m.RecuperadorApple })));

export default function Root() {
  useBotaoVoltarAndroid();
  return (
    <AppErrorBoundary>
      <AppProviders>
        <SplashScreen />
        <AppRouter />
        <OuvinteAssinaturaLoja />
        {assinaPelaApple() && <Suspense fallback={null}><RecuperadorApple /></Suspense>}
      </AppProviders>
    </AppErrorBoundary>
  );
}
