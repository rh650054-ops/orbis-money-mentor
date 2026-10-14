/* Botão "voltar" do Android no app da loja: volta uma tela; na primeira tela,
   fecha o app (sem isso o Android fecha o app em qualquer tela). */
import { useEffect } from "react";
import { plataforma } from "@/shared/lib/platform";
import { avisar } from "@/shared/lib/avisar";

export function useBotaoVoltarAndroid() {
  useEffect(() => {
    if (plataforma() !== "android") return;
    let tirar: (() => void) | undefined;
    void import("@capacitor/app").then(({ App }) =>
      App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void App.exitApp();
      }).then((h) => { tirar = () => void h.remove(); }),
    ).catch((e) => avisar.silencioso("android: botão voltar", e));
    return () => tirar?.();
  }, []);
}
