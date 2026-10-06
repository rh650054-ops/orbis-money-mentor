/* ============================================================
   VERIFICAR (/verificar) — a tela do VANT PRO (Rick, 09/09/2026).

   A regra do selo mudou e esta tela é onde ela vive:
     • carteira (Mercado Pago / PagBank) = GRÁTIS. Serve pra conciliar e cobrar.
       NÃO dá selo.
     • banco pelo Open Finance = dá o VERIFICADO. Vem no Vant Pro (1 banco; 2 no anual) ou como banco avulso de R$ 12,90 no Essencial.
   Ou seja: ninguém compra o selo. Compra o acesso ao Open Finance; o selo vem
   de ter uma conta bancária conferida de verdade.

   Três estados:
     A) não é Pro   → a oferta: todos os bancos, selo, conciliação completa
     B) é Pro, 0 banco → "ligue seu banco", abre o widget da Pluggy
     C) é Pro, com banco → selo conquistado + saúde de cada banco

   A senha do banco é digitada DENTRO da tela da Pluggy, nunca numa tela do
   Vant. O app não vê, não recebe e não guarda senha de banco.
   Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, Landmark, Banknote, ReceiptText,
  Check, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConciliacaoMes } from "@/components/financas/MercadoPagoConciliacao";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { LogoCarteira, CARTEIRAS, type Carteira } from "@/components/conectar/Selo";
import { ConviteBanco } from "@/components/conectar/ConviteBanco";
import { SeloVerificado } from "@/components/ranking/AvatarRanking";
import { HeroVerificado, ComprovadoHoje, OndeRecebe, carregarProHoje, type ProHoje } from "@/components/conectar/ProConectado";
import { GerenciarConexoes } from "@/components/conectar/GerenciarConexoes";
import { BancoExtra, ContasDeVenda } from "@/components/conectar/PapelContas";
import { ComprovanteRenda } from "@/components/conectar/ComprovanteRenda";
import {
  ligarBanco, salvarBanco, carregarBancos, carregarPro,
  type BancoLigado, type StatusPro, carregarContasVenda, type ContaVenda } from "@/components/conectar/pluggy";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const MUTE = "#7b766e";

interface StatusCarteira { conectado: boolean; provedores: string[]; recebido_hoje: number }
interface Perfil { nome: string; avatar: string | null }

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase() || "V";

/* ---------- peças visuais (fora do componente, sempre) ---------- */

function Cartao({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-[20px] border p-[15px] ${className}`}
      style={{ background: "linear-gradient(180deg,#101013,#0b0b0d)", borderColor: "#1e1d21", boxShadow: "inset 0 1px 0 rgba(255,255,255,.045)", ...style }}>
      {children}
    </div>
  );
}

function LinhaVantagem({ icone, titulo, texto, primeiro }: { icone: React.ReactNode; titulo: string; texto: string; primeiro?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderTop: primeiro ? "none" : "1px solid #1e1d21" }}>
      <span className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: "#1a1a19" }}>{icone}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-extrabold leading-tight">{titulo}</p>
        <p className="text-[10.5px] font-bold mt-0.5" style={{ color: MUTE }}>{texto}</p>
      </div>
    </div>
  );
}

function BotaoOuro({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="relative overflow-hidden w-full h-[50px] rounded-[14px] inline-flex items-center justify-center gap-2 text-[14px] font-black active:translate-y-[1px] transition-transform disabled:opacity-60"
      style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200", boxShadow: "0 10px 24px -12px rgba(255,200,0,.8)" }}>
      {children}
    </button>
  );
}

/* ---------- a tela ---------- */

export default function Verificar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pro, setPro] = useState<StatusPro | null>(null);
  const [bancos, setBancos] = useState<BancoLigado[]>([]);
  const [cart, setCart] = useState<StatusCarteira | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ligando, setLigando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [proHoje, setProHoje] = useState<ProHoje | null>(null);
  const [gerenciar, setGerenciar] = useState(false);
  const [bancoExtra, setBancoExtra] = useState(false);
  const [contasVenda, setContasVenda] = useState<ContaVenda[]>([]);

  const recarregar = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [p, b, s, pf, px, cv] = await Promise.all([
        carregarPro(),
        carregarBancos().catch(() => [] as BancoLigado[]),
        Promise.resolve((supabase as any).rpc("mp_status")).catch(() => ({ data: null })),
        Promise.resolve(supabase.from("public_profiles").select("nickname, avatar_url").eq("user_id", user.id).maybeSingle()).catch(() => ({ data: null })),
        carregarProHoje().catch(() => null),
        carregarContasVenda().catch(() => [] as ContaVenda[]),
      ]);
      setPro(p);
      setBancos(b);
      setContasVenda(cv);
      const linha = (pf as { data: { nickname?: string | null; avatar_url?: string | null } | null }).data;
      setPerfil({ nome: (linha?.nickname ?? "").trim(), avatar: linha?.avatar_url ?? null });
      setProHoje(px);
      const r = ((s?.data as any[]) || [])[0];
      setCart({
        conectado: !!r?.conectado,
        provedores: (r?.provedores as string[] | null) ?? [],
        recebido_hoje: Number(r?.recebido_hoje) || 0,
      });
    } catch {
      // sem resposta nenhuma: mostra a oferta em vez de girar pra sempre
      setPro((atual) => atual ?? { pro: false, origem: null, ate: null, bancos: 0, verificado: false });
    } finally {
      setCarregando(false);
    }
  }, [user?.id]);

  useEffect(() => { void recarregar(); }, [recarregar]);

  // Voltou pro app (fechou a aba do banco, destravou o celular): confere de novo.
  // No celular o OAuth do banco abre em outra aba e o widget pode nunca avisar o
  // Vant — mas o servidor (webhook da Pluggy) já criou a conexão sozinho.
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === "visible") void recarregar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [recarregar]);

  const abrirBanco = useCallback(async () => {
    setLigando(true);
    let r: Awaited<ReturnType<typeof ligarBanco>>;
    try {
      // quando a tela da Pluggy aparece, o botão da Vant volta ao normal
      r = await ligarBanco(() => setLigando(false));
    } catch {
      r = { erro: "erro" };
    } finally {
      setLigando(false);
    }
    if ("erro" in r) {
      if (r.erro === "cancelou") { void recarregar(); return; }
      if (r.erro === "precisa_banco_extra") { setBancoExtra(true); return; }
      toast({
        title: "Não deu certo",
        description: r.erro === "precisa_pro" ? "Assine a Vant Pro pra ligar seu banco."
          : r.erro === "pluggy_nao_configurado" ? "A Vant ainda não está configurada pra isso. Avisa o suporte."
          : r.erro === "sem_internet" ? "Sem internet pra abrir a tela do banco."
          : "Tenta de novo em instantes.",
        variant: "destructive",
      });
      return;
    }
    setLigando(true);
    const salvo = await salvarBanco(r.itemId).catch(() => ({ ok: false as const, erro: "erro" }));
    setLigando(false);
    if (!salvo.ok) {
      // o webhook da Pluggy pode ter salvo por conta própria — confere antes de assustar
      await recarregar();
      toast({ title: "Não deu pra salvar", description: "Tenta de novo.", variant: "destructive" });
      return;
    }
    toast({
      title: bancos.length >= 1 ? `${salvo.banco} conectado · diz pra que serve` : `${salvo.banco} conectado`,
      description: salvo.entradas > 0
        ? `${salvo.entradas} ${salvo.entradas === 1 ? "entrada" : "entradas"} dos últimos 7 dias já estão aqui.`
        : salvo.verificado ? "Você agora é verificado." : "Estamos puxando seus recebimentos.",
    });
    void recarregar();
  }, [recarregar]);

  const ligarCarteira = useCallback(async (c: Carteira) => {
    if (!c.fn) return;
    setOcupado(c.id);
    const { data, error } = await (supabase as any).functions.invoke(c.fn);
    setOcupado(null);
    if (error || data?.error || !data?.url) {
      toast({ title: "Não rolou", description: "Tenta de novo em instantes.", variant: "destructive" });
      return;
    }
    window.location.href = String(data.url);
  }, []);

  if (!user?.id || carregando || !pro) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin" style={{ color: GOLD }} /></div>;
  }

  const ligadas = CARTEIRAS.filter((c) => cart?.provedores.includes(c.id));
  const disponiveis = CARTEIRAS.filter((c) => c.fn && !cart?.provedores.includes(c.id));

  /* ---------- bloco das carteiras: grátis, aparece nos três estados ---------- */
  const blocoCarteiras = (
    <>
      <div className="flex items-center justify-between px-0.5 mt-5">
        <p className="text-[10px] font-black tracking-[.15em]" style={{ color: MUTE }}>MAQUININHAS E CARTEIRAS · GRÁTIS</p>
        <p className="text-[10.5px] font-bold" style={{ color: MUTE }}>não dão selo</p>
      </div>
      <Cartao className="mt-2" style={{ padding: "4px 15px" }}>
        {ligadas.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 py-3" style={{ borderTop: i === 0 ? "none" : "1px solid #1e1d21" }}>
            <LogoCarteira sigla={c.sigla} fundo={c.fundo} cor={c.cor} size={34} />
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] font-extrabold">{c.nome}</span>
              <span className="block text-[11px]" style={{ color: MUTE }}>pra conciliar e cobrar</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-black" style={{ color: OK }}>
              <Check className="w-3.5 h-3.5" strokeWidth={3} /> LIGADA
            </span>
          </div>
        ))}
        {disponiveis.map((c, i) => (
          <button key={c.id} type="button" onClick={() => ligarCarteira(c)} disabled={!!ocupado}
            className="w-full flex items-center gap-3 py-3 text-left active:opacity-70"
            style={{ borderTop: i === 0 && ligadas.length === 0 ? "none" : "1px solid #1e1d21" }}>
            <LogoCarteira sigla={c.sigla} fundo={c.fundo} cor={c.cor} size={34} />
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] font-extrabold">{c.nome}</span>
              <span className="block text-[11px]" style={{ color: MUTE }}>{c.linha}</span>
            </span>
            {ocupado === c.id
              ? <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: GOLD }} />
              : <span className="shrink-0 h-7 px-2.5 rounded-full inline-flex items-center text-[10px] font-black tracking-[.06em]" style={{ background: "#1b1a17", border: "1px solid #26241f", color: MUTE }}>LIGAR</span>}
          </button>
        ))}
      </Cartao>
    </>
  );

  const conferirDeNovo = (texto: string) => (
    <button type="button" onClick={() => void recarregar()}
      className="w-full mt-4 text-[11.5px] font-extrabold underline underline-offset-[3px]" style={{ color: MUTE }}>
      {texto}
    </button>
  );

  const topo = (
    <div className="flex items-center justify-between">
      <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b9b3a6" }}>
        <ArrowLeft className="w-5 h-5" />
      </button>
      <p className="font-mono text-[10px] font-bold tracking-[.18em]" style={{ color: MUTE }}>VANT PRO</p>
      {pro.pro
        ? <span className="w-12 inline-flex justify-end"><span className="rounded-full px-2 py-[3px] text-[9.5px] font-black tracking-[.06em]" style={{ background: "rgba(245,184,0,.12)", border: "1px solid rgba(245,184,0,.4)", color: GOLD }}>ATIVO</span></span>
        : <span className="w-12" />}
    </div>
  );

  /* ================= A) SEM OPEN FINANCE — o convite pra conectar (1A), depois a paywall em /pro =================
     Quem tem banco avulso (Essencial + banco, 06/10/2026) passa direto: liga o banco sem ser Pro. */
  if (!pro.pro && !pro.liberado) {
    return (
      <div className="px-4 pt-4 pb-28" style={{ background: "radial-gradient(100% 420px at 50% 0%,#1a1305,transparent 70%)" }}>
        {topo}
        <div className="mt-2" data-tour="conectar-banco"><ConviteBanco onConectar={() => navigate("/pro")} /></div>
        {blocoCarteiras}
      </div>
    );
  }

  /* ================= B) É PRO, SEM BANCO — um objetivo só: ligar o banco ================= */
  if (bancos.length === 0) {
    return (
      <div className="px-4 pt-4 pb-28">
        {topo}
        <Cartao className="mt-2 text-center" style={{ padding: "20px 15px 16px", background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", borderColor: "rgba(245,184,0,.42)" }}>
          <span className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(245,184,0,.1)", border: "2px dashed rgba(245,184,0,.5)" }}>
            <Landmark className="w-7 h-7" style={{ color: GOLD }} strokeWidth={2} />
          </span>
          <p className="text-[19px] font-black mt-3 text-balance">{pro.pro ? "Falta um passo pro selo" : "Agora é ligar o banco"}</p>
          <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "#b9b3a6" }}>
            {pro.pro ? "Liga seu banco. Leva menos de 1 minuto e o selo sai na hora." : "Leva menos de 1 minuto. O Pix que cair no banco passa a ser contado sozinho."}
          </p>
          <div className="mt-3.5" data-tour="conectar-banco">
            <BotaoOuro onClick={abrirBanco} disabled={ligando}>
              {ligando ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Landmark className="w-[18px] h-[18px]" strokeWidth={2.4} />}
              {ligando ? "ABRINDO…" : "LIGAR MEU BANCO"}
            </BotaoOuro>
          </div>
          <p className="text-[10.5px] font-bold mt-2.5" style={{ color: MUTE }}>234 bancos · a senha é digitada no seu banco, a Vant não vê</p>
        </Cartao>

        <Cartao className="mt-3" style={{ padding: "4px 15px" }}>
          <LinhaVantagem primeiro icone={<Banknote className="w-[18px] h-[18px]" style={{ color: OK }} />} titulo="Pix contado sozinho" texto="vê o que caiu enquanto vende" />
          <LinhaVantagem icone={<SeloVerificado size={18} />} titulo="Selo no ranking e no X1" texto="ninguém duvida do seu número" />
          <LinhaVantagem icone={<ReceiptText className="w-[18px] h-[18px]" style={{ color: GOLD }} />} titulo="Gastos organizados" texto="sem digitar nada" />
        </Cartao>

        {blocoCarteiras}
        {conferirDeNovo("já liguei um banco e não apareceu? conferir de novo")}
      </div>
    );
  }

  /* ================= C) É PRO, COM BANCO — o mockup "depois de conectar" (03/10) ================= */
  const desde = bancos[0]?.created_at ? new Date(bancos[0].created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : null;
  const nome = perfil?.nome || "Você";
  return (
    <div className="px-4 pt-4 pb-28 space-y-3">
      {topo}
      <HeroVerificado nome={nome} verificado={pro.verificado} desde={desde} />
      <ComprovadoHoje h={proHoje} />
      <ComprovanteRenda />
      <div className="flex items-center justify-between px-0.5 pt-1">
        <p className="text-[15px] font-black">Onde você recebe</p>
        <span className="rounded-full px-2.5 py-[4px] text-[11px] font-black" style={{ color: OK, border: "1px solid rgba(61,214,140,.45)" }}>
          {bancos.length + ligadas.length} {bancos.length + ligadas.length === 1 ? "conectada" : "conectadas"}
        </span>
      </div>
      {bancoExtra && <BancoExtra usados={bancos.length} email={user?.email} onFechar={() => setBancoExtra(false)} />}
      {/* 04/10: com 2+ bancos, pergunta logo aqui pra que serve cada conta (trabalho × pessoal) */}
      {contasVenda.length >= 2 && contasVenda.some((c) => !c.papel) && <ContasDeVenda contas={contasVenda} onMudou={() => void recarregar()} />}
      <OndeRecebe bancos={bancos} ligadas={ligadas} disponiveis={disponiveis} ocupado={ocupado} ligando={ligando}
        onLigarBanco={abrirBanco} onLigarCarteira={ligarCarteira} />
      {contasVenda.length >= 2 && contasVenda.every((c) => c.papel) && <ContasDeVenda contas={contasVenda} onMudou={() => void recarregar()} />}
      <button type="button" onClick={() => setGerenciar(true)}
        className="w-full h-[52px] rounded-[16px] text-[14px] font-black active:opacity-70"
        style={{ background: "#111114", border: "1px solid #1f1e22", color: "#F4F1EA" }}>
        Gerenciar conexões
      </button>
      <GerenciarConexoes aberto={gerenciar} onAbrir={setGerenciar} bancos={bancos} onMudou={() => void recarregar()} />
      <p className="text-[11px] leading-relaxed px-1" style={{ color: MUTE }}>
        A Vant <b style={{ color: "#c9c4b9" }}>só lê</b> o que entrou. Não move dinheiro, não vê senha. Você desliga quando quiser.
      </p>
      {conferirDeNovo("conferir de novo")}

      {/* Conciliação do mês: veio da tela de Finanças (Rick, 09/09). O lugar dela
          é aqui, junto das conexões que produzem esse número. */}
      <div className="mt-4"><ConciliacaoMes userId={user.id} /></div>

      <button type="button" onClick={() => navigate("/cobrar")}
        className="w-full flex items-center gap-3 mt-3 rounded-[20px] border p-[15px] text-left active:opacity-70"
        style={{ borderColor: "#1e1d21", background: "linear-gradient(180deg,#101013,#0b0b0d)" }}>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-extrabold">Cobrar quem ficou devendo</span>
          <span className="block text-[11.5px] mt-0.5" style={{ color: MUTE }}>A Vant gera o Pix e abre seu WhatsApp.</span>
        </span>
        <ChevronRight className="w-5 h-5 shrink-0" style={{ color: MUTE }} strokeWidth={2.6} />
      </button>
    </div>
  );
}
