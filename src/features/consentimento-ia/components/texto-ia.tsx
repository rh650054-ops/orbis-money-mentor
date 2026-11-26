/* What goes to the AI and to whom (26/11/2026, App Store 5.1.1(i) / 5.1.2(i)): one row per
   feature, naming the companies that receive it. The same text in the Terms screen ("O que é
   enviado e pra quem"), the AI sheet and Minha Conta, so the vendor always reads the same promise.
   Keep in sync with the edge functions gated by _shared/consentimento-ia.ts and with Privacidade. */
import { Link } from "react-router-dom";

const LINHAS: { funcao: string; dados: string; quem: string }[] = [
  { funcao: "Mentor (chat e voz)", dados: "o que você escreve ou fala, seu apelido e, quando você pergunta, suas vendas, estoque, finanças e ranking", quem: "Google (Gemini), Anthropic (Claude), OpenAI (voz)" },
  { funcao: "Dicas e relatórios do dia", dados: "vendas, meta, horários, produtos, custos e gastos", quem: "Anthropic, Google, Cerebras" },
  { funcao: "Mensagem do DEFCON", dados: "números da sua meta e das vendas do bloco", quem: "Google, Cerebras" },
  { funcao: "Dica do clima", dados: "cidade, meta, vendas do dia, melhores horários e contas a vencer (nome e valor)", quem: "Anthropic, Google, Cerebras" },
  { funcao: "Objetivo de lucro", dados: "vendas, produtos, custos, gastos e saídas do banco por categoria (se o banco estiver conectado) dos últimos 60 dias", quem: "Cerebras, Google" },
  { funcao: "Ler nota fiscal", dados: "a foto da nota que você escolhe", quem: "Anthropic" },
  { funcao: "Raio-X e conferência de extrato", dados: "o extrato que você envia (pode ter seu nome, banco e transações) e seu apelido", quem: "Anthropic, Google" },
  { funcao: "Comprovante do X1", dados: "a foto do comprovante Pix (valor, data, nomes e banco)", quem: "Anthropic" },
  { funcao: "Estúdio de Marca", dados: "o estilo que você descreve, o nome da banca e a foto de referência, se você enviar", quem: "Google, OpenAI" },
];

export function TextoIa() {
  return (
    <div className="flex flex-col gap-3 text-[13.5px] leading-snug" style={{ color: "#b9b3a6" }}>
      <p>
        Algumas funções da VANT usam inteligência artificial de outras empresas, nos EUA:{" "}
        <b style={{ color: "#F4F1EA" }}>Anthropic (Claude)</b>, <b style={{ color: "#F4F1EA" }}>OpenAI</b>,{" "}
        <b style={{ color: "#F4F1EA" }}>Google (Gemini)</b> e <b style={{ color: "#F4F1EA" }}>Cerebras</b>.
        Só com a sua autorização a VANT envia a elas o necessário pra cada função:
      </p>
      <ul className="flex flex-col gap-2">
        {LINHAS.map((l) => (
          <li key={l.funcao} className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,.04)", border: "1px solid #2a2722" }}>
            <b style={{ color: "#F4F1EA" }}>{l.funcao}</b>
            <span className="block">Envia: {l.dados}.</span>
            <span className="block" style={{ color: "#F5B800" }}>Pra: {l.quem}.</span>
          </li>
        ))}
      </ul>
      <p>Nunca enviamos seu CPF nem sua senha. As empresas recebem os dados só pra gerar a resposta; como cada uma trata e guarda os dados está na Política de Privacidade.</p>
      <p>
        Sem autorização, nada disso é enviado: vendas, DEFCON, produtos, estoque, finanças e relatórios continuam funcionando, só sem as funções de IA.
        Você muda quando quiser em <b style={{ color: "#F4F1EA" }}>Minha Conta › Inteligência artificial</b>. Detalhes na{" "}
        <Link to="/privacidade" className="underline underline-offset-2">Política de Privacidade</Link>.
      </p>
    </div>
  );
}
