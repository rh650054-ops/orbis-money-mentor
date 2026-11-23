/* What goes to the AI and to whom: the same text in the first-login sheet, the "IA desligada"
   sheet and Minha Conta, so the vendor always reads the same promise. */
import { Link } from "react-router-dom";
import { COR } from "@/shared/components/vant-ui";

export function TextoIa() {
  return (
    <div className="flex flex-col gap-2.5 text-[13.5px] leading-snug" style={{ color: COR.suave }}>
      <p>
        Algumas funções da VANT usam inteligência artificial de outras empresas: <b style={{ color: COR.texto }}>Anthropic (Claude)</b>,{" "}
        <b style={{ color: COR.texto }}>OpenAI</b> e <b style={{ color: COR.texto }}>Google (Gemini)</b>.
      </p>
      <p>Pra elas funcionarem, a VANT envia a essas empresas só o necessário:</p>
      <ul className="flex flex-col gap-1">
        <li>• suas vendas, metas, produtos, custos e gastos (dicas, relatórios e mentor);</li>
        <li>• o que você escreve ou fala pro mentor;</li>
        <li>• fotos que você escolhe (nota fiscal, comprovante, Estúdio de Marca);</li>
        <li>• o extrato do banco, se você conectar um;</li>
        <li>• a cidade do seu ponto (dica do clima).</li>
      </ul>
      <p>Seu CPF e sua senha nunca são enviados.</p>
      <p>
        Você pode mudar isso quando quiser em <b style={{ color: COR.texto }}>Minha Conta</b>. Detalhes na{" "}
        <Link to="/privacidade" className="underline underline-offset-2">Política de Privacidade</Link>.
      </p>
    </div>
  );
}
