/* ============================================================
   /cobrar — o Cobrador de Calote.
   Três estados:
     • form  → quem, quanto, do quê  → GERAR PIX E MANDAR NO ZAP
     • viva  → QR + copia e cola + botão do WhatsApp + o que acontece sozinho
     • paga  → o calote já foi abatido
   O Pix é criado NA CARTEIRA DO VENDEDOR pela edge function cobranca-criar.
   O dinheiro nunca passa pelo Orbis. A mensagem sai do WhatsApp dele.
   Todo hook acima do primeiro return. Campos definidos FORA do componente.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Check, Copy, MessageCircle, ShieldCheck,
  ChevronRight, AlertTriangle, HandCoins,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { reaisDeDigitos, textoDeDigitos, soDigitosValor } from "@/shared/lib/dinheiro";
import { toast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  carregarClientesDoDia, carregarCobranca, erroCobranca, fmt, horaBR, iniciais,
  linkZap, mensagemCobranca, soDigitos, telefoneBonito, telefoneServe,
  type ClienteDoDia, type Cobranca,
} from "@/components/cobranca/cobranca-lib";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const RED = "#F2465A";
const ZAP = "#25D366";

/* ---------- campos: FORA do componente, senão o teclado fecha a cada tecla ---------- */
function Campo({ rotulo, valor, onChange, placeholder, tipo = "text", inputMode }: {
  rotulo: string; valor: string; onChange: (v: string) => void;
  placeholder?: string; tipo?: string; inputMode?: "text" | "numeric" | "tel" | "decimal";
}) {
  return (
    <label className="block rounded-[14px] px-3.5 py-2.5" style={{ background: "#0e0e10", border: "1px solid #232327" }}>
      <span className="block text-[9.5px] font-black tracking-[.16em]" style={{ color: "var(--orbis-fg-3)" }}>{rotulo}</span>
      <input
        type={tipo}
        inputMode={inputMode}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent outline-none text-[15px] font-extrabold mt-0.5 tracking-[-.02em]"
        style={{ color: "#fff" }}
      />
    </label>
  );
}

function Passo({ n, feito, titulo, texto }: { n: number; feito: boolean; titulo: string; texto: string }) {
  return (
    <div className="flex gap-2.5 items-start py-2">
      <span className="w-[19px] h-[19px] rounded-[6px] shrink-0 inline-flex items-center justify-center text-[10px] font-black mt-0.5"
        style={feito
          ? { background: "rgba(61,214,140,.1)", border: `1px solid ${OK}66`, color: OK }
          : { background: "#1a1a1e", border: "1px solid #2a2a30", color: "var(--orbis-fg-3)" }}>
        {feito ? <Check className="w-2.5 h-2.5" strokeWidth={4} /> : n}
      </span>
      <div>
        <p className="text-[12.5px] font-extrabold leading-tight" style={feito ? undefined : { color: "var(--orbis-fg-2)" }}>{titulo}</p>
        <p className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: "var(--orbis-fg-3)" }}>{texto}</p>
      </div>
    </div>
  );
}

export default function Cobrar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const clienteParam = params.get("cliente");
  const cobrancaParam = params.get("id");

  const [carregando, setCarregando] = useState(true);
  const [conectado, setConectado] = useState(false);
  const [carteira, setCarteira] = useState<string>("Mercado Pago");
  const [meuNome, setMeuNome] = useState<string | null>(null);
  const [clientes, setClientes] = useState<ClienteDoDia[]>([]);

  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [valor, setValor] = useState("");
  const [oque, setOque] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);

  const [gerando, setGerando] = useState(false);
  const [cob, setCob] = useState<Cobranca | null>(null);
  const [copiado, setCopiado] = useState(false);

  /* ---- carga inicial: conexão, nome do vendedor, clientes do dia ---- */
  useEffect(() => {
    if (!user?.id) return;
    let vivo = true;
    (async () => {
      const [st, perfil, cs] = await Promise.all([
        (supabase as any).rpc("mp_status"),
        supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle(),
        carregarClientesDoDia().catch(() => [] as ClienteDoDia[]),
      ]);
      if (!vivo) return;
      const s = ((st?.data as any[]) || [])[0];
      setConectado(!!s?.conectado);
      const provs = (s?.provedores as string[] | null) ?? [];
      setCarteira(provs.includes("pagbank") && !provs.includes("mercadopago") ? "PagBank" : "Mercado Pago");
      setMeuNome(((perfil.data as any)?.nickname as string) ?? null);
      setClientes(cs);
      setCarregando(false);
    })().catch(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [user?.id]);

  /* ---- veio de um cliente do dia ou de uma cobrança já criada ---- */
  useEffect(() => {
    if (cobrancaParam) {
      void carregarCobranca(cobrancaParam).then((c) => { if (c) setCob(c); });
      return;
    }
    if (!clienteParam || clientes.length === 0) return;
    const c = clientes.find((x) => x.client_id === clienteParam);
    if (!c) return;
    if (c.cobranca_id) { void carregarCobranca(c.cobranca_id).then((k) => { if (k) setCob(k); }); return; }
    setClientId(c.client_id);
    setNome(c.nome || "");
    setTel(telefoneBonito(c.telefone));
    setValor(c.valor > 0 ? String(c.valor).replace(".", ",") : "");
  }, [clienteParam, cobrancaParam, clientes]);

  /* ---- enquanto espera, confere de tempos em tempos se já caiu ---- */
  useEffect(() => {
    if (!cob || cob.status !== "pendente") return;
    const t = setInterval(() => {
      void carregarCobranca(cob.id).then((k) => { if (k && k.status !== cob.status) setCob(k); });
    }, 20000);
    return () => clearInterval(t);
  }, [cob]);

  // `valor` guarda SÓ DÍGITOS ("1250"); os dois últimos são os centavos.
  // Antes isso apagava todo ponto achando que era separador de milhar: quem
  // digitasse 12.50 gerava uma cobrança REAL de R$ 1.250,00 no WhatsApp de um
  // cliente de verdade. Agora não tem como digitar ponto nem vírgula.
  const valorNum = useMemo(() => reaisDeDigitos(valor), [valor]);

  const texto = useMemo(() => mensagemCobranca({
    clienteNome: cob?.cliente_nome ?? nome,
    vendedorNome: meuNome,
    valor: cob?.valor ?? valorNum,
    descricao: cob?.descricao ?? oque,
    link: cob?.link_url ?? null,
  }), [cob, nome, meuNome, valorNum, oque]);

  const gerar = useCallback(async () => {
    if (valorNum <= 0) { toast({ title: "Digite o valor", variant: "destructive" }); return; }
    setGerando(true);
    const { data, error } = await (supabase as any).functions.invoke("cobranca-criar", {
      body: {
        client_id: clientId,
        nome: nome.trim(),
        telefone: soDigitos(tel),
        valor: valorNum,
        descricao: oque.trim(),
      },
    });
    setGerando(false);
    if (error || data?.error) {
      toast({ title: "Não rolou", description: erroCobranca(data?.error), variant: "destructive" });
      return;
    }
    const k = await carregarCobranca(String(data?.id));
    if (k) setCob(k);
  }, [valorNum, clientId, nome, tel, oque]);

  const copiar = async (t: string) => {
    try { await navigator.clipboard.writeText(t); setCopiado(true); setTimeout(() => setCopiado(false), 2000); toast({ title: "Copiado" }); }
    catch { toast({ title: "Não deu pra copiar", variant: "destructive" }); }
  };

  const mandarZap = () => {
    if (!cob) return;
    void supabase.from("cobrancas" as any).update({ enviada_em: new Date().toISOString() }).eq("id", cob.id);
    window.open(linkZap(cob.cliente_telefone, texto), "_blank", "noopener");
  };

  if (!user?.id || carregando) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin" style={{ color: GOLD }} /></div>;
  }

  /* ================= SEM CARTEIRA LIGADA ================= */
  if (!conectado && !cob) {
    return (
      <div className="px-4 pt-4 pb-24">
        <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "var(--orbis-fg-3)" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="rounded-[24px] border p-5 mt-2 text-center"
          style={{ borderColor: "rgba(63,169,255,.26)", background: "radial-gradient(120% 80% at 50% -10%,#123f5e 0%,#0a2033 38%,#08090b 78%)" }}>
          <span className="w-14 h-14 rounded-full inline-flex items-center justify-center" style={{ background: "rgba(63,169,255,.12)", border: "1px solid rgba(63,169,255,.45)" }}>
            <ShieldCheck className="w-7 h-7" style={{ color: "#7FD3FF" }} strokeWidth={2.2} />
          </span>
          <p className="text-[20px] font-black mt-4 leading-tight">Ligue onde você recebe<br />pra poder cobrar</p>
          <p className="text-[12.5px] mt-2.5 leading-relaxed" style={{ color: "var(--orbis-fg-2)" }}>
            O Pix da cobrança é criado na sua conta e o dinheiro cai direto pra você. Sem carteira ligada, o Orbis não tem onde criar.
          </p>
          <button type="button" onClick={() => navigate("/verificar")} className="orbis-cta w-full mt-4">
            LIGAR MINHA CARTEIRA <ChevronRight className="w-4 h-4" strokeWidth={3} />
          </button>
        </div>
      </div>
    );
  }

  /* ================= COBRANÇA PAGA ================= */
  if (cob && cob.status === "paga") {
    return (
      <div className="px-4 pt-4 pb-24">
        <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "var(--orbis-fg-3)" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="rounded-[26px] border p-6 mt-2 text-center relative overflow-hidden"
          style={{ borderColor: `${OK}47`, background: "radial-gradient(120% 80% at 50% -10%,#0d4a2c 0%,#062017 40%,#08090b 80%)", boxShadow: `0 24px 60px -30px ${OK}73` }}>
          <span className="w-[70px] h-[70px] rounded-full inline-flex items-center justify-center" style={{ background: "rgba(61,214,140,.1)", border: `2px solid ${OK}`, boxShadow: `0 0 44px ${OK}59` }}>
            <Check className="w-8 h-8" style={{ color: OK }} strokeWidth={3} />
          </span>
          <p className="text-[10px] font-black tracking-[.2em] mt-4" style={{ color: "#5fd98a" }}>CALOTE RECUPERADO</p>
          <p className="text-[27px] font-black tracking-[-.035em] leading-[1.1] mt-2">
            {cob.cliente_nome ? `${cob.cliente_nome.split(/\s+/)[0]} pagou` : "Pagou"}<br />
            <span style={{ color: OK }}>{fmt(cob.valor_pago ?? cob.valor)}</span>
          </p>
          <p className="text-[12.5px] mt-3 leading-relaxed" style={{ color: "var(--orbis-fg-2)" }}>
            Caiu na sua conta {cob.paga_em ? `às ${horaBR(cob.paga_em)}` : ""}. O Orbis já abateu do seu calote do dia.
          </p>
        </div>
        <button type="button" onClick={() => navigate("/cobrar")} className="orbis-cta w-full mt-4">
          <HandCoins className="w-4 h-4" strokeWidth={2.4} /> COBRAR OUTRA PESSOA
        </button>
      </div>
    );
  }

  /* ================= COBRANÇA VIVA ================= */
  if (cob) {
    const venceu = cob.status === "expirada";
    return (
      <div className="px-4 pt-4 pb-24">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "var(--orbis-fg-3)" }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: "var(--orbis-fg-3)" }}>
            COBRANÇA{cob.cliente_nome ? ` · ${cob.cliente_nome.toUpperCase()}` : ""}
          </p>
          <span className="w-9" />
        </div>

        <div className="rounded-[22px] border mt-2 p-4 text-center" style={{ borderColor: "var(--orbis-line)", background: "linear-gradient(180deg,#101013,#0b0b0d)" }}>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9.5px] font-black tracking-[.1em]"
            style={venceu
              ? { background: "rgba(242,70,90,.08)", border: `1px solid ${RED}59`, color: "#ff8a97" }
              : { background: "rgba(245,184,0,.08)", border: `1px solid ${GOLD}52`, color: GOLD }}>
            {venceu ? <AlertTriangle className="w-3 h-3" strokeWidth={2.6} /> : <Loader2 className="w-3 h-3 animate-spin" />}
            {venceu ? "VENCEU · GERE OUTRA" : "ESPERANDO PAGAR"}
          </span>

          {cob.qr_base64 && !venceu && (
            <img src={`data:image/png;base64,${cob.qr_base64}`} alt="QR code do Pix"
              className="mx-auto mt-3.5 rounded-[14px]" style={{ width: 190, height: 190, background: "#fff", padding: 9 }} />
          )}

          <p className="orbis-num text-[28px] font-black tracking-[-.035em] mt-3.5">{fmt(cob.valor)}</p>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--orbis-fg-2)" }}>
            {cob.descricao || "Cobrança"}{cob.enviada_em ? ` · enviado ${horaBR(cob.enviada_em)}` : ""}
          </p>

          {cob.pix_copia_cola && !venceu && (
            <button type="button" onClick={() => copiar(cob.pix_copia_cola as string)}
              className="w-full h-[46px] rounded-[13px] mt-3.5 inline-flex items-center justify-center gap-2 text-[12.5px] font-extrabold"
              style={{ background: "#131316", border: "1px solid #232327", color: "#d9d4cc" }}>
              {copiado ? <Check className="w-4 h-4" strokeWidth={3} style={{ color: OK }} /> : <Copy className="w-4 h-4" />}
              {copiado ? "copiado" : "copiar o Pix copia e cola"}
            </button>
          )}
        </div>

        {!venceu && (
          <button type="button" onClick={mandarZap}
            className="w-full h-[54px] rounded-[16px] mt-3 inline-flex items-center justify-center gap-2 text-[14px] font-black"
            style={{ background: "linear-gradient(180deg,#4CE585,#25D366 55%,#17A94E)", color: "#04220f", boxShadow: `0 1px 0 rgba(255,255,255,.4) inset, 0 5px 0 #0d6b31, 0 16px 34px ${ZAP}40` }}>
            <MessageCircle className="w-[18px] h-[18px]" strokeWidth={2.4} />
            {cob.enviada_em ? "MANDAR DE NOVO NO ZAP" : "MANDAR NO ZAP"}
          </button>
        )}

        <div className="rounded-[20px] border mt-3 p-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
          <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: "var(--orbis-fg-3)" }}>O QUE ACONTECE SOZINHO</p>
          <div className="mt-2">
            <Passo n={1} feito titulo={`Pix criado na sua conta do ${carteira}`} texto="O dinheiro cai direto pra você. O Orbis não toca nele." />
            <Passo n={2} feito={!!cob.enviada_em} titulo="Mensagem no WhatsApp dela" texto={cob.enviada_em ? `Enviado ${horaBR(cob.enviada_em)}.` : "Sai do seu número, com a sua cara."} />
            <Passo n={3} feito={false} titulo="Ela paga" texto={`O ${carteira} avisa o Orbis em segundos.`} />
            <Passo n={4} feito={false} titulo="Seu calote cai sozinho" texto="Sem você lançar nada, sem conferir extrato." />
          </div>
        </div>
      </div>
    );
  }

  /* ================= FORMULÁRIO ================= */
  const semCobranca = clientes.filter((c) => !c.cobranca_id);
  return (
    <div className="px-4 pt-4 pb-24">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "var(--orbis-fg-3)" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: "var(--orbis-fg-3)" }}>NOVA COBRANÇA</p>
        <span className="w-9" />
      </div>

      {semCobranca.length > 0 && !clientId && (
        <div className="rounded-[20px] border mt-2 px-4 pb-3 pt-3.5" style={{ borderColor: "var(--orbis-line)", background: "linear-gradient(180deg,#101013,#0b0b0d)" }}>
          <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: "var(--orbis-fg-3)" }}>CLIENTES DE HOJE</p>
          {semCobranca.slice(0, 5).map((c) => (
            <button key={c.client_id} type="button"
              onClick={() => { setClientId(c.client_id); setNome(c.nome || ""); setTel(telefoneBonito(c.telefone)); setValor(c.valor > 0 ? String(c.valor).replace(".", ",") : ""); }}
              className="w-full text-left flex items-center gap-3 py-2.5 active:opacity-70" style={{ borderTop: "1px solid var(--orbis-line)" }}>
              <span className="w-[34px] h-[34px] rounded-[11px] shrink-0 flex items-center justify-center text-[11.5px] font-black"
                style={{ background: "#16151a", border: "1px solid #2a2823", color: "#d9d4cc" }}>{iniciais(c.nome)}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-extrabold truncate">{c.nome || "Cliente"}</span>
                <span className="block text-[11px] truncate" style={{ color: "var(--orbis-fg-3)" }}>
                  {c.hora ? horaBR(c.hora) : "hoje"}{telefoneServe(c.telefone) ? ` · ${telefoneBonito(c.telefone)}` : " · sem telefone"}
                </span>
              </span>
              <span className="orbis-num text-[13.5px] font-extrabold shrink-0" style={{ color: GOLD }}>{fmt(c.valor)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 mt-3">
        <Campo rotulo="QUEM" valor={nome} onChange={setNome} placeholder="Nome do cliente" />
        <Campo rotulo="WHATSAPP" valor={tel} onChange={setTel} placeholder="(11) 9 0000-0000" inputMode="tel" />
        <Campo rotulo="QUANTO" valor={textoDeDigitos(valor)} onChange={(v) => setValor(soDigitosValor(v))} placeholder="0,00" inputMode="numeric" />
        <Campo rotulo="DO QUÊ" valor={oque} onChange={setOque} placeholder="2 camisetas" />
      </div>

      {!telefoneServe(tel) && tel.length > 0 && (
        <p className="text-[11.5px] mt-2 px-1" style={{ color: "#ff8a97" }}>Confere o número — falta dígito.</p>
      )}
      {!tel && (
        <p className="text-[11.5px] mt-2 px-1" style={{ color: "var(--orbis-fg-3)" }}>
          Sem WhatsApp dá pra criar mesmo assim: você copia o link e manda do jeito que quiser.
        </p>
      )}

      {valorNum > 0 && (
        <div className="rounded-[20px] border mt-3 p-4" style={{ borderColor: "rgba(37,211,102,.22)", background: "linear-gradient(180deg,#0b1a14,#08110d)" }}>
          <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: "#5fd98a" }}>A MENSAGEM QUE VAI</p>
          <div className="rounded-[16px] rounded-bl-[5px] mt-2.5 px-3.5 py-3 text-[12.5px] leading-[1.55] whitespace-pre-line"
            style={{ background: "#0d2b21", border: "1px solid rgba(37,211,102,.28)", color: "#e6efe9" }}>
            {texto.replace("\n\n\n", "\n\n")}
          </div>
          <p className="text-[11.5px] mt-2.5" style={{ color: "var(--orbis-fg-3)" }}>
            O link entra aqui depois de gerar. Você ainda pode editar no WhatsApp antes de enviar.
          </p>
        </div>
      )}

      <button type="button" onClick={gerar} disabled={gerando || valorNum <= 0}
        className="w-full h-[54px] rounded-[16px] mt-3 inline-flex items-center justify-center gap-2 text-[14px] font-black disabled:opacity-45"
        style={{ background: "linear-gradient(180deg,#4CE585,#25D366 55%,#17A94E)", color: "#04220f", boxShadow: `0 1px 0 rgba(255,255,255,.4) inset, 0 5px 0 #0d6b31, 0 16px 34px ${ZAP}40` }}>
        {gerando ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <MessageCircle className="w-[18px] h-[18px]" strokeWidth={2.4} />}
        {gerando ? "CRIANDO O PIX…" : "GERAR PIX E MANDAR NO ZAP"}
      </button>
      <p className="text-[11.5px] mt-2.5 text-center" style={{ color: "var(--orbis-fg-3)" }}>
        O Pix é criado na sua conta do {carteira}. O dinheiro cai direto pra você.
      </p>
    </div>
  );
}
