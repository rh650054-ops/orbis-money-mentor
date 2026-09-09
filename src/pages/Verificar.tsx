/* ============================================================
   VERIFICAR (/verificar) — a tela do ORBIS PRO (Rick, 09/09/2026).

   A regra do selo mudou e esta tela é onde ela vive:
     • carteira (Mercado Pago / PagBank) = GRÁTIS. Serve pra conciliar e cobrar.
       NÃO dá selo.
     • banco pelo Open Finance = dá o VERIFICADO. E exige o Orbis Pro (+R$ 10).
   Ou seja: ninguém compra o selo. Compra o acesso ao Open Finance; o selo vem
   de ter uma conta bancária conferida de verdade.

   Três estados:
     A) não é Pro   → a oferta: todos os bancos, selo, conciliação completa
     B) é Pro, 0 banco → "ligue seu banco", abre o widget da Pluggy
     C) é Pro, com banco → selo conquistado + saúde de cada banco

   A senha do banco é digitada DENTRO da tela da Pluggy, nunca numa tela do
   Orbis. O app não vê, não recebe e não guarda senha de banco.
   Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, BadgeCheck, Landmark, ShieldCheck, Trophy,
  Check, Plus, AlertTriangle, RefreshCw, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { Selo, Raios, Grao, LogoCarteira, CARTEIRAS, type Carteira } from "@/components/conectar/Selo";
import {
  ligarBanco, salvarBanco, carregarBancos, carregarPro, saudeDoBanco, horaBR,
  type BancoLigado, type StatusPro,
} from "@/components/conectar/pluggy";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const CIANO = "#7FD3FF";

/** Checkout do produto "Orbis Pro" na Hotmart. Vazio = botão vira lista de espera. */
const LINK_PRO = "";

interface StatusCarteira { conectado: boolean; provedores: string[]; recebido_hoje: number }

/* ---------- peças visuais (fora do componente, sempre) ---------- */

function HeroOuro({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[26px] text-center" style={{
      padding: "26px 18px 20px",
      background: "radial-gradient(120% 85% at 50% -10%,#4a3405 0%,#241a02 40%,#0a0a0c 82%)",
      border: "1px solid rgba(245,184,0,.34)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.08), 0 26px 60px -30px rgba(245,184,0,.5)",
    }}>
      <span className="absolute pointer-events-none" style={{
        left: "50%", top: -150, width: 540, height: 540, marginLeft: -270,
        background: "conic-gradient(from 200deg,transparent 0 18deg,rgba(245,184,0,.13) 18deg 24deg,transparent 24deg 46deg,rgba(245,184,0,.08) 46deg 52deg,transparent 52deg 74deg,rgba(245,184,0,.13) 74deg 80deg,transparent 80deg 360deg)",
      }} />
      <Grao />
      <div className="relative">{children}</div>
    </div>
  );
}

function Cartao({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-[20px] border p-[15px] ${className}`}
      style={{ background: "linear-gradient(180deg,#101013,#0b0b0d)", borderColor: "#1e1d21", boxShadow: "inset 0 1px 0 rgba(255,255,255,.045)", ...style }}>
      {children}
    </div>
  );
}

function Beneficio({ icone, cor, titulo, texto, primeiro }: { icone: React.ReactNode; cor: string; titulo: string; texto: string; primeiro?: boolean }) {
  return (
    <div className="flex gap-3 items-start py-[13px]" style={{ borderTop: primeiro ? "none" : "1px solid #1e1d21", paddingTop: primeiro ? 2 : undefined }}>
      <span className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0"
        style={{ background: `${cor}18`, border: `1px solid ${cor}4d`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.07)" }}>{icone}</span>
      <div>
        <p className="text-[14px] font-extrabold leading-tight tracking-tight">{titulo}</p>
        <p className="text-[11.5px] mt-1 leading-relaxed" style={{ color: "#7b766e" }}>{texto}</p>
      </div>
    </div>
  );
}

function BotaoOuro({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="relative overflow-hidden w-full h-[54px] rounded-[16px] inline-flex items-center justify-center gap-2 text-[14.5px] font-black active:translate-y-[2px] transition-transform disabled:opacity-60"
      style={{ background: "linear-gradient(180deg,#FFD152,#F5B800 55%,#E0A500)", color: "#1a1305", boxShadow: "0 1px 0 rgba(255,255,255,.4) inset, 0 5px 0 #A87E00, 0 16px 34px rgba(245,184,0,.22)" }}>
      {children}
    </button>
  );
}

function MolduraOuro({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-flex p-[3px] rounded-full shrink-0"
      style={{ background: "conic-gradient(from 0deg,#FFE9A3,#F5B800,#A87E00,#FFD152,#F5B800,#FFE9A3)" }}>
      <span className="absolute rounded-full pointer-events-none" style={{ inset: -6, background: "radial-gradient(circle,rgba(245,184,0,.28),transparent 70%)" }} />
      {children}
    </span>
  );
}

function LinhaBanco({ b }: { b: BancoLigado }) {
  const s = saudeDoBanco(b.status, b.last_synced_at);
  return (
    <div className="flex items-center gap-3 py-[11px]" style={{ borderTop: "1px solid #1e1d21" }}>
      {b.institution_logo ? (
        <img src={b.institution_logo} alt="" className="w-[34px] h-[34px] rounded-[11px] shrink-0 object-contain" style={{ background: "#fff" }} />
      ) : (
        <span className="w-[34px] h-[34px] rounded-[11px] shrink-0 flex items-center justify-center" style={{ background: "#16151a", border: "1px solid #2a2823" }}>
          <Landmark className="w-4 h-4" style={{ color: "#7b766e" }} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-extrabold truncate">{b.institution_name || "Banco"}</p>
        <p className="text-[11px] truncate" style={{ color: s.cor }}>
          {s.texto}{!s.alerta && b.last_synced_at ? ` · ${horaBR(b.last_synced_at)}` : ""}
        </p>
      </div>
      {s.alerta
        ? <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: s.cor }} strokeWidth={2.4} />
        : <Check className="w-4 h-4 shrink-0" style={{ color: s.cor }} strokeWidth={3} />}
    </div>
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

  const recarregar = useCallback(async () => {
    if (!user?.id) return;
    const [p, b, s] = await Promise.all([
      carregarPro(),
      carregarBancos().catch(() => [] as BancoLigado[]),
      (supabase as any).rpc("mp_status"),
    ]);
    setPro(p);
    setBancos(b);
    const r = ((s?.data as any[]) || [])[0];
    setCart({
      conectado: !!r?.conectado,
      provedores: (r?.provedores as string[] | null) ?? [],
      recebido_hoje: Number(r?.recebido_hoje) || 0,
    });
    setCarregando(false);
  }, [user?.id]);

  useEffect(() => { void recarregar().catch(() => setCarregando(false)); }, [recarregar]);

  const abrirBanco = useCallback(async () => {
    setLigando(true);
    const r = await ligarBanco();
    if ("erro" in r) {
      setLigando(false);
      if (r.erro === "cancelou") return;
      toast({
        title: "Não deu certo",
        description: r.erro === "precisa_pro" ? "Assine o Orbis Pro pra ligar seu banco."
          : r.erro === "pluggy_nao_configurado" ? "O Orbis ainda não está configurado pra isso. Avisa o suporte."
          : r.erro === "sem_internet" ? "Sem internet pra abrir a tela do banco."
          : "Tenta de novo em instantes.",
        variant: "destructive",
      });
      return;
    }
    const salvo = await salvarBanco(r.itemId);
    setLigando(false);
    if (!salvo.ok) { toast({ title: "Não deu pra salvar", description: "Tenta de novo.", variant: "destructive" }); return; }
    toast({ title: `${salvo.banco} conectado`, description: salvo.verificado ? "Você agora é verificado." : "Estamos puxando seus recebimentos." });
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
    <Cartao className="mt-3">
      <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: "#7b766e" }}>ONDE VOCÊ RECEBE · GRÁTIS</p>
      <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "#a9a49c" }}>
        Carteira não dá selo — quem verifica é o banco. Mas é ela que faz o Orbis conferir o que caiu e gerar as cobranças do calote.
      </p>
      {ligadas.map((c) => (
        <div key={c.id} className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: "1px solid #1e1d21" }}>
          <LogoCarteira sigla={c.sigla} fundo={c.fundo} cor={c.cor} size={34} />
          <p className="flex-1 text-[13.5px] font-extrabold">{c.nome}</p>
          <span className="inline-flex items-center gap-1 text-[11px] font-black" style={{ color: OK }}>
            <Check className="w-3.5 h-3.5" strokeWidth={3} /> LIGADA
          </span>
        </div>
      ))}
      {disponiveis.map((c) => (
        <button key={c.id} type="button" onClick={() => ligarCarteira(c)} disabled={!!ocupado}
          className="w-full flex items-center gap-3 mt-3 pt-3 text-left active:opacity-70" style={{ borderTop: "1px solid #1e1d21" }}>
          <LogoCarteira sigla={c.sigla} fundo={c.fundo} cor={c.cor} size={34} />
          <span className="flex-1 min-w-0">
            <span className="block text-[13.5px] font-extrabold">{c.nome}</span>
            <span className="block text-[11px]" style={{ color: "#7b766e" }}>{c.linha}</span>
          </span>
          {ocupado === c.id
            ? <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: GOLD }} />
            : <span className="shrink-0 h-8 px-3 rounded-[10px] inline-flex items-center text-[11px] font-black" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>LIGAR</span>}
        </button>
      ))}
    </Cartao>
  );

  const topo = (
    <div className="flex items-center justify-between">
      <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#7b766e" }}>
        <ArrowLeft className="w-5 h-5" />
      </button>
      <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: "#7b766e" }}>
        {pro.pro ? "ORBIS PRO" : "SEUS RECEBIMENTOS"}
      </p>
      <span className="w-9" />
    </div>
  );

  /* ================= A) NÃO É PRO — a oferta ================= */
  if (!pro.pro) {
    return (
      <div className="px-4 pt-4 pb-28">
        {topo}
        <div className="mt-2">
          <HeroOuro>
            <MolduraOuro>
              <span className="w-[74px] h-[74px] rounded-full flex items-center justify-center" style={{ background: "#0b0b0d", border: "3px solid #000" }}>
                <Landmark className="w-8 h-8" style={{ color: GOLD }} strokeWidth={2} />
              </span>
            </MolduraOuro>
            <p className="text-[10px] font-black tracking-[.2em] mt-3.5" style={{ color: GOLD }}>ORBIS PRO</p>
            <p className="text-[26px] font-black tracking-[-.035em] leading-[1.08] mt-1.5">Todos os seus<br />bancos no Orbis</p>
            <p className="text-[12.5px] mt-2.5 leading-relaxed" style={{ color: "#a9a49c" }}>
              Nubank, Itaú, Caixa, C6, Bradesco, Santander. O Orbis lê o que caiu em cada um e monta seu dia sozinho.
            </p>
          </HeroOuro>
        </div>

        <Cartao className="mt-3">
          <Beneficio primeiro cor="#B47CFF" titulo="Seus bancos, não só a maquininha"
            texto="O que sobra do dia inteiro, de qualquer conta, num lugar só."
            icone={<Landmark className="w-[19px] h-[19px]" style={{ color: "#B47CFF" }} strokeWidth={2.2} />} />
          <Beneficio cor={CIANO} titulo="Você vira verificado"
            texto="Conta bancária conferida é o que dá o selo. Carteira não dá."
            icone={<BadgeCheck className="w-[19px] h-[19px]" style={{ color: CIANO }} strokeWidth={2.2} />} />
          <Beneficio cor={OK} titulo="Conciliação completa"
            texto="Todo Pix que caiu, de qualquer banco, batendo com o que você lançou."
            icone={<ShieldCheck className="w-[19px] h-[19px]" style={{ color: OK }} strokeWidth={2.2} />} />
          <Beneficio cor={GOLD} titulo="Destaque no ranking"
            texto="Moldura dourada na sua foto e etiqueta PRO em todas as telas."
            icone={<Trophy className="w-[19px] h-[19px]" style={{ color: GOLD }} strokeWidth={2.2} />} />
        </Cartao>

        <Cartao className="mt-3 text-center" style={{ borderColor: "rgba(245,184,0,.34)", background: "linear-gradient(180deg,#171203,#0b0b0d)" }}>
          <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: "#7b766e" }}>VOCÊ JÁ PAGA</p>
          <p className="text-[15px] font-extrabold mt-1" style={{ color: "#a9a49c" }}>R$ 29,90 <span className="text-[12px] font-bold">Orbis</span></p>
          <p className="text-[9.5px] font-black tracking-[.18em] mt-3" style={{ color: GOLD }}>O PRO CUSTA</p>
          <p className="text-[38px] font-black tracking-[-.04em] leading-none mt-1" style={{ color: GOLD }}>
            + R$ 10<span className="text-[15px] font-extrabold">/mês</span>
          </p>
          <p className="text-[11.5px] mt-1.5" style={{ color: "#7b766e" }}>Cancela quando quiser, sem multa.</p>
        </Cartao>

        <div className="mt-3" data-tour="conectar-banco">
          <BotaoOuro onClick={() => {
            if (LINK_PRO) { window.location.href = LINK_PRO; return; }
            toast({ title: "Quase lá", description: "O Pro abre pra todo mundo em instantes. Enquanto isso, ligue sua carteira — é grátis." });
          }}>
            <Trophy className="w-[18px] h-[18px]" strokeWidth={2.4} /> QUERO O PRO
          </BotaoOuro>
        </div>
        <p className="text-[11px] text-center mt-2.5" style={{ color: "#7b766e" }}>
          Sua senha do banco é digitada na tela do próprio banco. O Orbis nunca vê.
        </p>

        {blocoCarteiras}
      </div>
    );
  }

  /* ================= B) É PRO, SEM BANCO ================= */
  if (bancos.length === 0) {
    return (
      <div className="px-4 pt-4 pb-28">
        {topo}
        <div className="mt-2">
          <HeroOuro>
            <MolduraOuro>
              <span className="w-[74px] h-[74px] rounded-full flex items-center justify-center" style={{ background: "#0b0b0d", border: "3px solid #000" }}>
                <Selo size={44} />
              </span>
            </MolduraOuro>
            <p className="text-[10px] font-black tracking-[.2em] mt-3.5" style={{ color: GOLD }}>PRO ATIVO · FALTA UM PASSO</p>
            <p className="text-[26px] font-black tracking-[-.035em] leading-[1.08] mt-1.5">Ligue seu banco<br />e pegue o selo</p>
            <p className="text-[12.5px] mt-2.5 leading-relaxed" style={{ color: "#a9a49c" }}>
              São 234 bancos disponíveis. Leva menos de um minuto e o selo sai na hora.
            </p>
          </HeroOuro>
        </div>

        <div className="mt-3" data-tour="conectar-banco">
          <BotaoOuro onClick={abrirBanco} disabled={ligando}>
            {ligando ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Landmark className="w-[18px] h-[18px]" strokeWidth={2.4} />}
            {ligando ? "ABRINDO…" : "LIGAR MEU BANCO"}
          </BotaoOuro>
        </div>

        <Cartao className="mt-3">
          <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: "#7b766e" }}>COMO FUNCIONA</p>
          <div className="mt-2">
            <Beneficio primeiro cor={CIANO} titulo="Você escolhe o banco e entra"
              texto="A tela é do próprio banco. Sua senha não passa pelo Orbis em momento nenhum."
              icone={<ShieldCheck className="w-[19px] h-[19px]" style={{ color: CIANO }} strokeWidth={2.2} />} />
            <Beneficio cor={OK} titulo="O Orbis só lê o que entrou"
              texto="Nada de mover dinheiro, transferir ou pagar. Só leitura."
              icone={<Check className="w-[19px] h-[19px]" style={{ color: OK }} strokeWidth={2.6} />} />
            <Beneficio cor={GOLD} titulo="O selo sai na hora"
              texto="Banco conectado é conta conferida. É isso que o verificado significa."
              icone={<BadgeCheck className="w-[19px] h-[19px]" style={{ color: GOLD }} strokeWidth={2.2} />} />
          </div>
        </Cartao>

        {blocoCarteiras}
      </div>
    );
  }

  /* ================= C) É PRO, COM BANCO ================= */
  const comProblema = bancos.filter((b) => saudeDoBanco(b.status, b.last_synced_at).alerta);
  return (
    <div className="px-4 pt-4 pb-28">
      {topo}

      <div className="mt-2">
        <HeroOuro>
          <MolduraOuro>
            <span className="w-[74px] h-[74px] rounded-full flex items-center justify-center" style={{ background: "#0b0b0d", border: "3px solid #000" }}>
              <Selo size={46} />
            </span>
          </MolduraOuro>
          <p className="text-[10px] font-black tracking-[.2em] mt-3.5" style={{ color: GOLD }}>
            {pro.verificado ? "VENDEDOR VERIFICADO" : "PRO ATIVO"}
          </p>
          <p className="text-[24px] font-black tracking-[-.035em] leading-[1.1] mt-1.5">
            {bancos.length} {bancos.length === 1 ? "banco ligado" : "bancos ligados"}
          </p>
          <p className="text-[12.5px] mt-2.5 leading-relaxed" style={{ color: "#a9a49c" }}>
            {comProblema.length > 0
              ? `${comProblema.length} ${comProblema.length === 1 ? "banco precisa" : "bancos precisam"} de atenção — confere abaixo.`
              : "Tudo em dia. Seus recebimentos entram sozinhos."}
          </p>
        </HeroOuro>
      </div>

      <Cartao className="mt-3" style={{ padding: "6px 15px 12px" }}>
        <p className="text-[9.5px] font-black tracking-[.18em] pt-3 pb-1" style={{ color: "#7b766e" }}>SEUS BANCOS</p>
        {bancos.map((b) => <LinhaBanco key={b.id} b={b} />)}
        <button type="button" onClick={abrirBanco} disabled={ligando}
          className="w-full h-11 rounded-[13px] mt-3 inline-flex items-center justify-center gap-2 text-[12.5px] font-extrabold"
          style={{ background: "#131316", border: "1px solid #232327", color: "#d9d4cc" }}>
          {ligando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2.6} />}
          {ligando ? "abrindo…" : "ligar mais um banco"}
        </button>
      </Cartao>

      {comProblema.length > 0 && (
        <Cartao className="mt-3" style={{ borderColor: "rgba(255,122,26,.3)", background: "linear-gradient(180deg,#1a1005,#0b0b0d)" }}>
          <div className="flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#ff7a1a" }} strokeWidth={2.3} />
            <div>
              <p className="text-[13.5px] font-extrabold leading-tight">Banco fora do ar não é culpa sua</p>
              <p className="text-[11.5px] mt-1 leading-relaxed" style={{ color: "#a9a49c" }}>
                Acontece com todos os bancos, às vezes por dias. Seus outros bancos continuam em dia e nada se perde — quando ele voltar, o Orbis busca o que ficou pra trás.
              </p>
            </div>
          </div>
        </Cartao>
      )}

      <button type="button" onClick={() => void recarregar()}
        className="w-full h-11 rounded-[13px] mt-3 inline-flex items-center justify-center gap-2 text-[12.5px] font-extrabold"
        style={{ background: "#131316", border: "1px solid #232327", color: "#7b766e" }}>
        <RefreshCw className="w-4 h-4" /> conferir de novo
      </button>

      {blocoCarteiras}

      <button type="button" onClick={() => navigate("/cobrar")}
        className="w-full flex items-center gap-3 mt-3 rounded-[20px] border p-[15px] text-left active:opacity-70"
        style={{ borderColor: "rgba(245,184,0,.3)", background: "linear-gradient(180deg,#171203,#0b0b0d)" }}>
        <span className="flex-1 min-w-0">
          <span className="block text-[9.5px] font-black tracking-[.18em]" style={{ color: GOLD }}>COBRADOR DE CALOTE</span>
          <span className="block text-[14px] font-extrabold mt-1">Cobrar quem ficou devendo</span>
          <span className="block text-[11.5px] mt-0.5" style={{ color: "#7b766e" }}>O Orbis gera o Pix e abre seu WhatsApp.</span>
        </span>
        <ChevronRight className="w-5 h-5 shrink-0" style={{ color: GOLD }} strokeWidth={2.6} />
      </button>
    </div>
  );
}
