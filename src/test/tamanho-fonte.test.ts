/* GUARDA DE TAMANHO (Rick, 27/10/2026: "tem tela com o tamanho certo e tela que não").
   O app segue a escala do Relatório/Financeiro: número principal até 28–32 px, títulos
   15–24, apoio 11–14, sempre em px fixo. Este teste falha se alguém voltar a pôr fonte
   gigante (> 32 px) ou fonte que cresce com a tela (vw / clamp com vw) — foi isso que
   deixava o Clima enorme em uns celulares e normal em outros. Exceções ficam na lista
   abaixo, com o motivo. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");
const MAX_PX = 32;
/** Telas onde o número grande é a peça, de propósito — fora da varredura de 27/10 (Rick
 *  citou Clima, Produtos, Perfil e Caça-Sinal). Cada uma fica aqui com o motivo até o Rick
 *  decidir se encolhe. Arquivo novo NÃO entra aqui sem conversa. Caminho relativo a src/. */
const EXCECOES = new Map<string, string>([
  ["components/clima/tela/HeroClima.tsx", "temperatura 64 px fina, como o Clima do iPhone (aprovado 27/10)"],
  ["components/RankingShareCard.tsx", "arte de compartilhar desenhada em 1080 px"],
  ["components/defcon/DefconRunning.tsx", "cronômetro do Foco: leitura de longe, na rua"],
  ["components/defcon/DefconBreak.tsx", "pausa do Foco: contagem grande"],
  ["components/defcon/DefconLunchPause.tsx", "almoço do Foco: contagem grande"],
  ["components/defcon/DefconEndScreen.tsx", "fim do Foco: número do dia"],
  ["components/defcon/DefconFechamento.tsx", "fechamento do Foco: número do dia"],
  ["components/defcon/DefconBlockReport.tsx", "relatório do bloco do Foco"],
  ["components/defcon/DefconCargaDoDia.tsx", "carga do dia antes do Foco"],
  ["components/defcon/DefconStartScreen.tsx", "abertura do Foco"],
  ["components/defcon/foco/foco-hero.tsx", "meta do Foco"],
  ["pages/DefconChallenge.tsx", "Foco (tela antiga)"],
  ["features/objetivo-lucro/components/veredito-hero.tsx", "Objetivo de Lucro: veredito (27/10)"],
  ["features/objetivo-lucro/components/passo-meta.tsx", "Objetivo de Lucro: meta (27/10)"],
  ["features/objetivo-lucro/components/painel-missao.tsx", "Objetivo de Lucro: missão (27/10)"],
  ["features/objetivo-lucro/components/desafio-card.tsx", "Objetivo de Lucro: desafio (27/10)"],
  ["features/objetivo-lucro/components/lendo-corre.tsx", "Objetivo de Lucro: leitura (27/10)"],
  ["components/x1/VitoriaScreen.tsx", "vitória do X1"],
  ["pages/X1Escolher.tsx", "X1"],
  ["pages/X1Luta.tsx", "X1"],
  ["pages/X1Carteira.tsx", "X1"],
  ["pages/onboarding/OnboardingNovo.tsx", "revelação do onboarding"],
  ["components/onboarding/mission/MissionWelcome.tsx", "boas-vindas do onboarding (emoji)"],
  ["components/onboarding/mission/MissionPwaInstall.tsx", "instalar o app (emoji)"],
  ["components/DayStartPopup.tsx", "popup do começo do dia — próxima rodada"],
  ["components/MotivationalCard.tsx", "card motivacional — próxima rodada"],
  ["components/PublicProfileModal.tsx", "perfil público — próxima rodada"],
  ["components/metas/MetaDoDiaCard.tsx", "meta do dia — próxima rodada"],
  ["components/financas/raiox/RaioXEnviar.tsx", "Raio-X — próxima rodada"],
  ["components/ranking/RankingChase.tsx", "ranking — próxima rodada"],
  ["pages/Benefits.tsx", "benefícios (emoji) — próxima rodada"],
  ["pages/Competitions.tsx", "competições — próxima rodada"],
  ["pages/History.tsx", "histórico — próxima rodada"],
  ["pages/ModoOffline.tsx", "modo offline — próxima rodada"],
  ["pages/NotFound.tsx", "página não encontrada"],
  ["components/dashboard/Dashboard.tsx", "faturamento do mês na Dashboard (encolhe até 33–37 px) — próxima rodada"],
  ["components/competitions/GoldenTicket.tsx", "bilhete dourado da competição"],
]);

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "test" ? [] : arquivos(p);
    return /\.tsx$/.test(n) && !/\.test\.tsx$/.test(n) ? [p] : [];
  });
}

function violacoes(): string[] {
  const out: string[] = [];
  for (const f of arquivos(RAIZ)) {
    const rel = f.slice(RAIZ.length + 1);
    if (EXCECOES.has(rel)) continue;
    readFileSync(f, "utf8").split("\n").forEach((linha, i) => {
      for (const m of linha.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) if (Number(m[1]) > MAX_PX) out.push(`${rel}:${i + 1} text-[${m[1]}px]`);
      for (const m of linha.matchAll(/\btext-([5-9])xl\b|\btext-4xl\b/g)) out.push(`${rel}:${i + 1} ${m[0]}`);
      for (const m of linha.matchAll(/fontSize:\s*["'`]?(\d+(?:\.\d+)?)(?:px)?["'`]?/g)) if (Number(m[1]) > MAX_PX) out.push(`${rel}:${i + 1} fontSize ${m[1]}`);
      // vw/clamp is fine when it only shrinks text on narrow phones (max ≤ 32 px); a size that
      // grows with the screen past that (Clima 27/10: 46→74 px) is what broke the "DPI".
      for (const m of linha.matchAll(/clamp\(([^)]*vw[^)]*)\)/g)) {
        const max = m[1]!.split(",").pop()!.trim();
        const px = max.endsWith("rem") ? parseFloat(max) * 16 : parseFloat(max);
        if (!(px <= MAX_PX)) out.push(`${rel}:${i + 1} fonte cresce com a tela até ${max}`);
      }
      if (/fontSize:\s*["'`]\s*[\d.]+vw/.test(linha) || /text-\[[\d.]+vw\]/.test(linha)) out.push(`${rel}:${i + 1} fonte em vw sem limite`);
    });
  }
  return out;
}

describe("escala de fonte do app", () => {
  it(`nenhuma tela usa fonte acima de ${MAX_PX}px nem fonte que cresce com a largura da tela`, () => {
    expect(violacoes()).toEqual([]);
  });
});
