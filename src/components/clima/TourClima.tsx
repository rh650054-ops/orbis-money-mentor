/* ============================================================
   TOUR DO CLIMA — primeiro acesso à tela (Rick, 11/09).
   Sete passos, um por clima, com a CENA DE VERDADE animada: o vendedor
   vê o personagem daquele dia se mexendo e lê, em uma frase, o que o
   Orbis faz naquele clima. Aparece uma vez por pessoa; "pular" encerra.
   ============================================================ */
import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, MapPin } from "lucide-react";
import { ClimaCena, type Estado } from "./ClimaCena";
import "@/styles/clima.css";

const chave = (userId: string) => `orbis_tour_clima_v1_${userId}`;
export function tourClimaVisto(userId: string): boolean {
  try { return localStorage.getItem(chave(userId)) === "1"; } catch { return false; }
}

interface Passo { estado: Estado; temp: number; condicao: string; linha: string; titulo: string; txt: string }
const PASSOS: Passo[] = [
  { estado: "sol", temp: 26, condicao: "Ensolarado", linha: "máx 28° · mín 18° · sensação 26°",
    titulo: "Dia limpo", txt: "Céu aberto, dia inteiro seu. O Orbis manda sair cedo e protege a sua melhor hora — aquela em que você mais vende." },
  { estado: "calor", temp: 34, condicao: "Sol muito forte", linha: "máx 36° · mín 24° · sensação 38°",
    titulo: "Calor", txt: "Sol na veia e ele de língua de fora. Gelada vende sozinha, mas das 12h às 15h o povo some — ele te dá a hora de parar e a de voltar." },
  { estado: "nublado", temp: 22, condicao: "Nublado", linha: "máx 24° · mín 17° · sensação 22°",
    titulo: "Nublado", txt: "Céu fechado é conforto pra quem tá na rua: ninguém com pressa de fugir do sol. Dia de esticar o corre." },
  { estado: "chuva", temp: 18, condicao: "Chuva", linha: "máx 20° · mín 15° · sensação 17°",
    titulo: "Chuva", txt: "Começa a cair gota na tela. Ele te diz a hora que a chuva chega e quantas das 6 previsões concordam — pra você fechar a meta antes." },
  { estado: "tempestade", temp: 19, condicao: "Tempestade", linha: "máx 21° · mín 16° · sensação 19°",
    titulo: "Tempestade", txt: "Raio no fundo e chuva forte. Aqui ele não enrola: é dia de ficar em casa. A meta se recupera amanhã, você não." },
  { estado: "frio", temp: 11, condicao: "Frio e vento", linha: "máx 14° · mín 8° · sensação 9°",
    titulo: "Frio", txt: "Vento passando e ele tremendo. Café e caldo valem mais que gelada — e metade da concorrência nem sai de casa." },
  { estado: "noite", temp: 17, condicao: "Céu limpo", linha: "máx 20° · mín 15° · sensação 17°",
    titulo: "Noite", txt: "Cidade acesa, corre noturno. Ele mostra até que hora o movimento segura — e a hora de recolher." },
];

export function TourClima({ userId, onFim }: { userId: string; onFim: () => void }) {
  const [i, setI] = useState(0);
  const [toques, setToques] = useState(0);
  const p = PASSOS[i]!;
  const ultimo = i === PASSOS.length - 1;
  const fechar = () => { try { localStorage.setItem(chave(userId), "1"); } catch { /* ignore */ } onFim(); };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: "#0d0c0b" }} role="dialog" aria-modal="true" aria-label="Como funciona o clima">
      <div className="flex-1 overflow-y-auto px-3 pt-3 flex flex-col justify-center" style={{ paddingBottom: ".5rem" }}>
       <div className="w-full shrink-0">
        {/* passinhos */}
        <div className="flex items-center gap-1.5 px-1 pb-2.5">
          {PASSOS.map((s, k) => (
            <span key={s.estado} className="h-[3px] flex-1 rounded-full transition-colors" style={{ background: k <= i ? "var(--orbis-gold,#F5B800)" : "rgba(255,255,255,.14)" }} />
          ))}
        </div>

        {/* a cena de verdade, animada */}
        <div className="cl-tour-cena">
          <ClimaCena
            key={p.estado}
            estado={p.estado} temp={p.temp} condicao={p.condicao} linha={p.linha}
            cidade="sua cidade" fontes={6} concordancia={82}
            toques={toques} onToque={() => setToques((t) => t + 1)}
          />
        </div>

        <div className="px-2 pt-4">
          <p className="text-[10.5px] font-extrabold tracking-[.18em] uppercase" style={{ color: "var(--orbis-gold,#F5B800)" }}>
            {i + 1} de {PASSOS.length} · como funciona
          </p>
          <p className="font-display text-[23px] font-black leading-tight mt-1">{p.titulo}</p>
          <p className="text-[13.5px] leading-[1.55] mt-1.5" style={{ color: "#b9b3a6" }}>{p.txt}</p>
          <p className="text-[12px] leading-[1.5] mt-2.5 flex items-start gap-1.5" style={{ color: "#7e7869" }}>
            <MapPin className="w-3.5 h-3.5 mt-[1px] shrink-0" strokeWidth={2.4} />
            {i === 0 ? "Toca no boneco que ele pula e fala de novo." : "Você não escolhe o clima: ele vem sozinho do lugar onde você está."}
          </p>
        </div>
       </div>
      </div>

      <div className="px-4 pt-2 flex items-center gap-2 shrink-0" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))", background: "#0d0c0b", boxShadow: "0 -18px 30px -12px #0d0c0b" }}>
        <button
          type="button"
          onClick={() => { if (ultimo) fechar(); else { setI((v) => v + 1); setToques(0); } }}
          className="orbis-cta flex-1 flex items-center justify-center gap-2" style={{ height: 52, fontSize: 14 }}
        >
          {ultimo ? <>ENTENDI, BORA <Check className="w-[18px] h-[18px]" strokeWidth={3} /></> : <>PRÓXIMO <ArrowRight className="w-[18px] h-[18px]" strokeWidth={3} /></>}
        </button>
        {!ultimo && <button type="button" onClick={fechar} className="h-[52px] px-3 text-[13px] font-bold shrink-0" style={{ color: "#7e7869" }}>pular</button>}
      </div>
    </div>,
    document.body,
  );
}
