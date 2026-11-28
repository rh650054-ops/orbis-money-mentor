import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { plataforma } from "@/shared/lib/platform";
import type { Acao, Atividade, EstadoAcao, Painel } from "../types";

/* The native side of VANT Quick (ios/App/App/VantQuickPlugin.swift): App Group storage, widget
   reloads and the DEFCON Live Activity. iPhone only; everywhere else every call is a no-op.
   Never throws: a widget problem must never break a sale in the app. */
interface PluginQuick {
  definirConta(o: { conta: string | null }): Promise<void>;
  salvarConfig(o: { valor: number; rotulo: string } | { valor: null; rotulo: null }): Promise<void>;
  salvarPainel(o: { painel: Painel }): Promise<void>;
  pendentes(): Promise<{ acoes: unknown[] }>;
  concluir(o: { id: string; estado: EstadoAcao; texto?: string }): Promise<void>;
  atividade(o: { acao: "atualizar"; dados: Atividade } | { acao: "encerrar" }): Promise<void>;
  limpar(): Promise<void>;
  estado(): Promise<EstadoQuick>;
  addListener(evento: "acao", f: () => void): Promise<PluginListenerHandle>;
}

/** Diagnosis of the widget channel (Minha Conta). */
export interface EstadoQuick {
  /** the App Group container exists in the app */
  grupo: boolean;
  temConta: boolean;
  painelData?: string;
  painelEm?: number;
  /** when the widget last built its timeline, and whether it saw this account */
  widgetLeuEm?: number;
  widgetViuConta?: boolean;
  widgetPainelData?: string;
}

const nativo = registerPlugin<PluginQuick>("VantQuick");
export const temQuick = () => plataforma() === "ios";
/** the native side is really there (false = the plugin was not registered in this build) */
export const pluginCarregado = () => temQuick() && Capacitor.isPluginAvailable("VantQuick");

async function seguro<T>(f: () => Promise<T>, padrao: T): Promise<T> {
  if (!temQuick()) return padrao;
  try { return await f(); } catch (e) { console.warn("[vant-quick]", e instanceof Error ? e.message : e); return padrao; }
}

export const quick = {
  definirConta: (conta: string | null) => seguro(() => nativo.definirConta({ conta }), undefined),
  salvarConfig: (valor: number | null, rotulo: string | null) =>
    seguro(() => nativo.salvarConfig(valor === null || rotulo === null ? { valor: null, rotulo: null } : { valor, rotulo }), undefined),
  salvarPainel: (painel: Painel) => seguro(() => nativo.salvarPainel({ painel }), undefined),
  pendentes: async (): Promise<unknown[]> => (await seguro(() => nativo.pendentes(), { acoes: [] as unknown[] })).acoes ?? [],
  concluir: (id: string, estado: EstadoAcao, texto?: string) => seguro(() => nativo.concluir({ id, estado, ...(texto ? { texto } : {}) }), undefined),
  atualizarAtividade: (dados: Atividade) => seguro(() => nativo.atividade({ acao: "atualizar", dados }), undefined),
  encerrarAtividade: () => seguro(() => nativo.atividade({ acao: "encerrar" }), undefined),
  limpar: () => seguro(() => nativo.limpar(), undefined),
  estado: () => seguro<EstadoQuick | null>(() => nativo.estado(), null),
  aoTocarNoWidget: (f: () => void) => seguro(() => nativo.addListener("acao", f), null),
};
export type { Acao };
