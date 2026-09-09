/* ============================================================
   O PULSO DO ORBIS — o sensor de retenção.

   Pedido do Rick: "preciso que o Orbis saiba o momento de conversar com base
   na retenção dele no app... o que faz o usuário ficar mais, quanto tempo ele
   ficou por causa daquela função, o que ele viu que fez ele sair, o momento
   certo que mandou algo e ele saiu, mas também algo que mandou e ele ficou."

   Este arquivo NÃO decide nada e NÃO gasta IA. Ele só anota por onde o
   vendedor andou, quanto tempo ficou e o que o Orbis falou antes. É a
   fundação: sem histórico acumulado, nenhuma inteligência de "hora certa"
   tem em que se apoiar — e dia que não grava é dia que não volta.

   Três regras que o vendedor de rua impõe:

   1) NUNCA atrapalhar. Tudo é try/catch mudo, nada é esperado (await) no
      caminho de uma venda, e falha de rede simplesmente descarta o evento.
      Perder um registro de tela é irrelevante; travar uma venda não é.

   2) BARATO no 3G ruim. Os eventos ficam numa fila em memória e vão em lote
      a cada 45s, ou quando o app é escondido. Não é uma requisição por tela.

   3) SEM CONTEÚDO. Só nome de tela, nome de aviso e duração. Nenhum valor de
      venda, nenhum nome de cliente, nenhum texto digitado. É o mapa do passo
      dele dentro do app, não o que ele escreveu.
   ============================================================ */
import { supabase } from "@/integrations/supabase/client";

type Tipo = "abriu" | "tela" | "fala" | "fechou";

interface Evento {
  sessao: string;
  tipo: Tipo;
  tela: string | null;
  detalhe: string | null;
  segundos: number | null;
  em: string;
}

const INTERVALO_ENVIO = 45_000;   // manda o lote a cada 45s
const LOTE_MAXIMO = 40;           // se encher antes, manda na hora
const TELA_MINIMA_SEG = 2;        // tela que ele só atravessou não é sinal
const TELA_MAXIMA_SEG = 7200;     // celular no bolso a tarde inteira não é "uso"

const novaId = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* segue */ }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
};

let sessao = novaId();
let fila: Evento[] = [];
let relogio: ReturnType<typeof setInterval> | null = null;
let ligado = false;

/** tela em que ele está agora e desde quando */
let telaAtual: string | null = null;
let telaDesde = 0;

const agora = () => new Date().toISOString();

function enfileirar(tipo: Tipo, tela: string | null, detalhe: string | null, segundos: number | null) {
  if (!ligado) return;
  try {
    fila.push({ sessao, tipo, tela, detalhe, segundos, em: agora() });
    if (fila.length >= LOTE_MAXIMO) void enviar();
  } catch { /* sensor nunca atrapalha */ }
}

/** Manda o que está na fila. Erro de rede = descarta e segue a vida. */
async function enviar() {
  if (fila.length === 0) return;
  const lote = fila;
  fila = [];
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id;
    if (!uid) return; // sem login não existe pulso
    await supabase.from("orbis_pulso" as never).insert(
      lote.map((e) => ({
        user_id: uid,
        sessao: e.sessao,
        tipo: e.tipo,
        tela: e.tela,
        detalhe: e.detalhe,
        segundos: e.segundos,
        em: e.em,
      })) as never,
    );
  } catch {
    /* Sem internet no farol é o normal, não a exceção. O evento morre aqui
       de propósito: guardar fila pra sempre encheria a memória do celular
       e o que interessa é o padrão, não cada linha. */
  }
}

/** fecha a contagem da tela em que ele estava */
function fecharTela() {
  if (!telaAtual || !telaDesde) return;
  const seg = Math.round((Date.now() - telaDesde) / 1000);
  if (seg >= TELA_MINIMA_SEG && seg <= TELA_MAXIMA_SEG) {
    enfileirar("tela", telaAtual, null, seg);
  }
  telaAtual = null;
  telaDesde = 0;
}

/* ---------- o que o resto do app usa ---------- */

/** Começa a sentir. Chamado uma vez, quando o app monta. */
export function pulsoLigar() {
  if (ligado || typeof window === "undefined") return;
  ligado = true;
  enfileirar("abriu", null, null, null);

  relogio = setInterval(() => { void enviar(); }, INTERVALO_ENVIO);

  // App escondido (trocou de app, apagou a tela, fechou a aba) = ele saiu.
  // visibilitychange é o único evento confiável no celular; 'beforeunload'
  // não dispara em PWA no iOS.
  document.addEventListener("visibilitychange", () => {
    try {
      if (document.visibilityState === "hidden") {
        fecharTela();
        enfileirar("fechou", null, null, null);
        void enviar();
      } else {
        // voltou: se demorou, é outra sessão — senão a conta de "ficou"
        // ia somar o tempo que o celular passou no bolso.
        sessao = novaId();
        enfileirar("abriu", null, null, null);
        telaDesde = Date.now();
      }
    } catch { /* nunca atrapalha */ }
  });

  window.addEventListener("pagehide", () => {
    try { fecharTela(); enfileirar("fechou", null, null, null); void enviar(); } catch { /* nada */ }
  });
}

export function pulsoDesligar() {
  if (relogio) clearInterval(relogio);
  relogio = null;
  ligado = false;
}

/** Ele entrou numa tela. Fecha a anterior e começa a contar esta. */
export function pulsoTela(nome: string) {
  if (!ligado) return;
  if (nome === telaAtual) return;
  fecharTela();
  telaAtual = nome;
  telaDesde = Date.now();
}

/** O Orbis falou alguma coisa com ele (pop-up, coach, alerta de ranking). */
export function pulsoFala(qual: string) {
  enfileirar("fala", telaAtual, qual, null);
}

/* ---------- nomes de tela ----------
   A URL crua não serve: /admin/competitions e um id no caminho viram telas
   diferentes e o relatório vira picadinho. Aqui vira nome de gente. */
export function nomeDaTela(caminho: string): string {
  const p = (caminho || "/").split("?")[0]!.replace(/\/+$/, "") || "/";
  if (p === "/") return "dashboard";
  if (p.startsWith("/admin")) return "admin";
  if (p.startsWith("/defcon")) return "defcon";
  if (p.startsWith("/daily-goals")) return "foco";
  if (p.startsWith("/insights")) return "relatorio";
  if (p.startsWith("/finances")) return "financeiro";
  if (p.startsWith("/verificar")) return "vender";
  if (p.startsWith("/cobrar")) return "cobrador";
  if (p.startsWith("/ranking")) return "ranking";
  if (p.startsWith("/x1")) return "x1";
  if (p.startsWith("/profile")) return "perfil";
  if (p.startsWith("/chat")) return "chat";
  if (p.startsWith("/caca") || p.startsWith("/spot")) return "caca-sinal";
  if (p.startsWith("/estudio")) return "estudio";
  if (p.startsWith("/transactions")) return "lancamentos";
  if (p.startsWith("/auth") || p.startsWith("/onboarding")) return "entrada";
  return p.slice(1).split("/")[0] || "outra";
}
