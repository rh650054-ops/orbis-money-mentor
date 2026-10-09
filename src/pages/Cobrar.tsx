/* ============================================================
   /cobrar — o Cobrador de Calote.
   Três estados:
     • form  → quem, quanto, do quê  → GERAR PIX E MANDAR NO ZAP
     • viva  → QR + copia e cola + botão do WhatsApp + o que acontece sozinho
     • paga  → o calote já foi abatido
   O Pix é criado NA CONTA DO VENDEDOR pela edge function cobranca-criar.
   O dinheiro nunca passa pela Vant. A mensagem sai do WhatsApp dele.
   09/10: a Vant não oferece mais ligar carteira (Mercado Pago / PagBank).
   Quem já tem a conexão antiga continua cobrando; quem não tem vê só um aviso,
   sem botão pra ligar carteira.
   Todo hook acima do primeiro return. Campos definidos FORA do componente.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Check, Copy, MessageCircle, ShieldCheck,
  AlertTriangle, HandCoins,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { reaisDeTexto, limparDinheiro, textoDeReais, arrumarDinheiro } from "@/shared/lib/dinheiro";
import { toast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  carregarClientesDoDia, carregarCobranca, erroCobranca, fmt, horaBR, iniciais,
  linkZap, mensagemCobranca, soDigitos, telefoneBonito, telefoneServe,
  type ClienteDoDia, type Cobranca,
} from "@/components/cobranca/cobranca-lib";
import {
  carregarPainel, PAINEL_VAZIO, ResumoRecuperado, ListaDevedores, FilaEnvio, BotaoLembrar,
  type PainelCobranca, type CobrancaAberta, type ItemFila,
} from "@/components/cobranca/QuemTeDeve";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const RED = "#F2465A";
const ZAP = "#25D366";

/* ---------- campos: FORA do componente, senão o teclado fecha a cada tecla ---------- */
function Campo({ rotulo, valor, onChange, placeholder, tipo = "text", inputMode, onBlur }: {
  rotulo: string; valor: string; onChange: (v: string) => void;
  placeholder?: string; tipo?: string; inputMode?: "text" | "numeric" | "tel" | "decimal";
  onBlur?: () => void;
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
        onBlur={onBlur}
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
  const [painel, setPainel] = useState<PainelCobranca>(PAINEL_VAZIO);
  const [fila, setFila] = useState<ItemFila[] | null>(null);
  const [falhasFila, setFalhasFila] = useState(0);
  const [criandoTodos, setCriandoTodos] = useState(false);

  /* ---- carga inicial: conexão, nome do vendedor, clientes do dia ---- */
  useEffect(() => {
    if (!user?.id) return;
    let vivo = true;
    (async () => {
      const [st, perfil, cs, pn] = await Promise.all([
        (supabase as any).rpc("mp_status"),
        supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle(),
        carregarClientesDoDia().catch(() => [] as ClienteDoDia[]),
        carregarPainel().catch(() => PAINEL_VAZIO),
      ]);
      if (!vivo) return;
      setConectado(!!((st?.data as any[]) || [])[0]?.conectado);
      setMeuNome(((perfil.data as any)?.nickname as string) ?? null);
      setClientes(cs);
      setPainel(pn);
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
    setValor(textoDeReais(c.valor));
  }, [clienteParam, cobrancaParam, clientes]);

  /* ---- enquanto espera, confere de tempos em tempos se já caiu ---- */
  useEffect(() => {
    if (!cob || cob.status !== "pendente") return;
    const t = setInterval(() => {
      void carregarCobranca(cob.id).then((k) => { if (k && k.status !== cob.status) setCob(k); });
    }, 20000);
    return () => clearInterval(t);
  }, [cob]);

  // `valor` guarda O QUE ELE DIGITOU ("20", "20,50"). Aqui o separador é SEMPRE
  // decimal, nunca milhar: é o que mata de vez o acidente antigo em que digitar
  // 12.50 gerava uma cobrança REAL de R$ 1.250,00 no WhatsApp de um cliente de
  // verdade. Quem cobra R$ 1.250 digita 1250. Ver shared/lib/dinheiro.ts.
  const valorNum = useMemo(() => reaisDeTexto(valor), [valor]);

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

  /* ---- COBRAR OS N DE UMA VEZ: cria todos os Pix e monta a fila de envio ---- */
  const cobrarTodos = useCallback(async (lista: ClienteDoDia[]) => {
    setCriandoTodos(true);
    const itens: ItemFila[] = [];
    let falhas = 0;
    for (const c of lista) {
      const { data, error } = await (supabase as any).functions.invoke("cobranca-criar", {
        body: { client_id: c.client_id, nome: (c.nome || "").trim(), telefone: soDigitos(c.telefone), valor: c.valor, descricao: "" },
      });
      if (error || data?.error || !data?.id) { falhas++; continue; }
      const k = await carregarCobranca(String(data.id));
      itens.push({ id: String(data.id), nome: c.nome, telefone: c.telefone, valor: c.valor, link: k?.link_url ?? null, enviado: false });
    }
    setCriandoTodos(false);
    setFalhasFila(falhas);
    if (itens.length === 0) { toast({ title: "Não rolou", description: erroCobranca(null), variant: "destructive" }); return; }
    setFila(itens);
    setClientes(await carregarClientesDoDia().catch(() => [] as ClienteDoDia[]));
  }, []);

  const mensagemDe = (i: { nome: string | null; valor: number; link: string | null }) =>
    mensagemCobranca({ clienteNome: i.nome, vendedorNome: meuNome, valor: i.valor, descricao: null, link: i.link });

  const mandarDaFila = (i: ItemFila) => {
    void supabase.from("cobrancas" as any).update({ enviada_em: new Date().toISOString() }).eq("id", i.id)
      .then(({ error }: { error: unknown }) => { if (error) avisar.erro("Cobrar: marcar enviada (fila)", error); });
    setFila((f) => (f ?? []).map((x) => (x.id === i.id ? { ...x, enviado: true } : x)));
    window.open(linkZap(i.telefone, mensagemDe(i)), "_blank", "noopener");
  };

  const voltarPraLista = async () => {
    setFila(null); setCob(null); setClientId(null); setNome(""); setTel(""); setValor(""); setOque("");
    navigate("/cobrar", { replace: true });
    setPainel(await carregarPainel().catch(() => PAINEL_VAZIO));
  };

  const abrirAberta = (a: CobrancaAberta) => {
    if (a.status === "expirada") {
      // Pix vencido: monta uma cobrança nova com os mesmos dados
      setClientId(a.client_id); setNome(a.nome || ""); setTel(telefoneBonito(a.telefone)); setValor(textoDeReais(a.valor)); setOque(a.descricao || "");
      return;
    }
    void carregarCobranca(a.id).then((k) => { if (k) setCob(k); });
  };

  const lembrarDaqui2Dias = () => {
    if (!cob) return;
    const quando = new Date(Date.now() + 2 * 86_400_000).toISOString();
    void supabase.from("cobrancas" as any).update({ lembrar_em: quando }).eq("id", cob.id)
      .then(({ error }: { error: unknown }) => {
        if (error) { avisar.erro("Cobrar: lembrar em 2 dias", error); toast({ title: "Não deu pra salvar o lembrete", variant: "destructive" }); return; }
        setCob({ ...cob, lembrar_em: quando });
        toast({ title: "Combinado", description: "Daqui a 2 dias ela aparece no topo de Quem te deve." });
      });
  };

  const copiar = async (t: string) => {
    try { await navigator.clipboard.writeText(t); setCopiado(true); setTimeout(() => setCopiado(false), 2000); toast({ title: "Copiado" }); }
    catch { toast({ title: "Não deu pra copiar", variant: "destructive" }); }
  };

  const mandarZap = () => {
    if (!cob) return;
    void supabase.from("cobrancas" as any).update({ enviada_em: new Date().toISOString() }).eq("id", cob.id)
      .then(({ error }: { error: unknown }) => { if (error) avisar.erro("Cobrar: marcar cobrança como enviada", error); });
    window.open(linkZap(cob.cliente_telefone, texto), "_blank", "noopener");
  };

  if (!user?.id || carregando) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin" style={{ color: GOLD }} /></div>;
  }

  /* ================= SEM PIX AUTOMÁTICO (sem conexão antiga) ================= */
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
          <p className="text-[20px] font-black mt-4 leading-tight">Cobrança com Pix automático<br />indisponível</p>
          <p className="text-[12.5px] mt-2.5 leading-relaxed" style={{ color: "var(--orbis-fg-2)" }}>
            Sua conta não tem onde criar o Pix da cobrança. Na hora da venda, no DEFCON, a mensagem pro cliente já vai com a sua chave Pix.
          </p>
          <button type="button" onClick={() => navigate(-1)} className="orbis-cta w-full mt-4">
            VOLTAR
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
            Caiu na sua conta {cob.paga_em ? `às ${horaBR(cob.paga_em)}` : ""}. A Vant já abateu do seu calote do dia.
          </p>
        </div>
        <div className="mt-3"><ResumoRecuperado p={painel} /></div>
        <button type="button" onClick={() => void voltarPraLista()} className="orbis-cta w-full mt-4">
          <HandCoins className="w-4 h-4" strokeWidth={2.4} /> VER QUEM AINDA DEVE
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
        {!venceu && cob.enviada_em && <BotaoLembrar lembrarEm={cob.lembrar_em ?? null} onLembrar={lembrarDaqui2Dias} />}

        <div className="rounded-[20px] border mt-3 p-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
          <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: "var(--orbis-fg-3)" }}>O QUE ACONTECE SOZINHO</p>
          <div className="mt-2">
            <Passo n={1} feito titulo="Pix criado na sua conta" texto="O dinheiro cai direto pra você. A Vant não toca nele." />
            <Passo n={2} feito={!!cob.enviada_em} titulo="Mensagem no WhatsApp dela" texto={cob.enviada_em ? `Enviado ${horaBR(cob.enviada_em)}.` : "Sai do seu número, com a sua cara."} />
            <Passo n={3} feito={false} titulo="Ela paga" texto="A Vant fica sabendo em segundos." />
            <Passo n={4} feito={false} titulo="Seu calote cai sozinho" texto="Sem você lançar nada, sem conferir extrato." />
          </div>
        </div>
      </div>
    );
  }

  /* ================= FILA: COBRAR TODOS DE UMA VEZ ================= */
  if (fila) {
    return (
      <div className="px-4 pt-4 pb-24">
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={() => void voltarPraLista()} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "var(--orbis-fg-3)" }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: "var(--orbis-fg-3)" }}>COBRAR TODOS</p>
          <span className="w-9" />
        </div>
        <FilaEnvio itens={fila} falhas={falhasFila} onMandar={mandarDaFila}
          onCopiar={(i) => void copiar(mensagemDe(i))} onPronto={() => void voltarPraLista()} />
      </div>
    );
  }

  /* ================= FORMULÁRIO ================= */
  const semCobranca = clientes.filter((c) => !c.cobranca_id && c.valor > 0);
  return (
    <div className="px-4 pt-4 pb-24">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "var(--orbis-fg-3)" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: "var(--orbis-fg-3)" }}>NOVA COBRANÇA</p>
        <span className="w-9" />
      </div>

      {!clientId && (
        <div className="space-y-3 mt-2">
          <ResumoRecuperado p={painel} />
          <ListaDevedores novos={semCobranca} abertas={painel.abertas}
            onNovo={(c) => { setClientId(c.client_id); setNome(c.nome || ""); setTel(telefoneBonito(c.telefone)); setValor(textoDeReais(c.valor)); }}
            onAberta={abrirAberta} />
          {semCobranca.length >= 2 && (
            <>
              <button type="button" onClick={() => void cobrarTodos(semCobranca)} disabled={criandoTodos}
                className="w-full h-[56px] rounded-[16px] inline-flex items-center justify-center gap-2 text-[15px] font-black disabled:opacity-60"
                style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200", boxShadow: "0 5px 0 #8a6a00, 0 16px 34px rgba(255,200,0,.25)" }}>
                {criandoTodos ? <Loader2 className="w-5 h-5 animate-spin" /> : <HandCoins className="w-5 h-5" strokeWidth={2.4} />}
                {criandoTodos ? "CRIANDO OS PIX…" : `COBRAR OS ${semCobranca.length} DE UMA VEZ`}
              </button>
              <p className="text-[11.5px] text-center -mt-1" style={{ color: "var(--orbis-fg-3)" }}>
                A Vant gera o Pix de cada um e abre seu WhatsApp com a mensagem pronta.
              </p>
            </>
          )}
          <p className="text-[9.5px] font-black tracking-[.18em] pt-2 px-1" style={{ color: "var(--orbis-fg-3)" }}>OU COBRE ALGUÉM AGORA</p>
        </div>
      )}

      <div className="flex flex-col gap-2 mt-3">
        <Campo rotulo="QUEM" valor={nome} onChange={setNome} placeholder="Nome do cliente" />
        <Campo rotulo="WHATSAPP" valor={tel} onChange={setTel} placeholder="(11) 9 0000-0000" inputMode="tel" />
        <Campo rotulo="QUANTO" valor={valor} onChange={(v) => setValor(limparDinheiro(v))} onBlur={() => setValor(arrumarDinheiro)} placeholder="0,00" inputMode="decimal" />
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
        O Pix é criado na sua conta. O dinheiro cai direto pra você.
      </p>
    </div>
  );
}
