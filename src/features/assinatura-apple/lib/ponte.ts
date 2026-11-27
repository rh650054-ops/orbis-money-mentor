/* The app's side of VANT's StoreKit bridge (plugins/vant-storekit, Swift). Only on the iPhone app:
   on the site and on Android `ponteApple()` is null and nothing here is ever called. */
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { plataforma } from "@/shared/lib/platform";
import type { ProdutoApple, RespostaDaLoja, TransacaoApple } from "../types";

export interface Ponte {
  podePagar(): Promise<{ pode: boolean }>;
  produtos(o: { ids: string[] }): Promise<{ produtos: ProdutoApple[] }>;
  /** Opens Apple's purchase sheet. `conta` (the VANT account id) is signed into the purchase. */
  comprar(o: { produto: string; conta: string }): Promise<RespostaDaLoja>;
  /** Finishes ONE transaction. Only after the server stored it. */
  concluir(o: { transacao: string }): Promise<{ concluida: boolean }>;
  /** Paid transactions not finished yet. */
  pendentes(): Promise<{ transacoes: TransacaoApple[] }>;
  /** What this Apple account is entitled to now. */
  direitos(): Promise<{ transacoes: TransacaoApple[] }>;
  sincronizar(): Promise<void>;
  gerenciar(): Promise<void>;
  addListener(evento: "transacao", f: (t: TransacaoApple) => void): Promise<PluginListenerHandle>;
}

let ponte: Ponte | null | undefined;
export function ponteApple(): Ponte | null {
  if (ponte === undefined) ponte = plataforma() === "ios" ? registerPlugin<Ponte>("VantStorekit") : null;
  return ponte;
}

/** The short code the bridge rejects with (see LojaApple.codigo in Swift). */
export function codigoDoErro(e: unknown): string {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" && c ? c : "falha_na_loja";
}
