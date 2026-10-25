/* Prévias de exemplo pras telas do Pro (Rick, 25/10/2026). Ficam sempre foscas:
   mostram o FORMATO do dado que o Pro libera, não dados de verdade de ninguém. */
const linhas = [
  { nome: "Av. Principal × Rua das Flores", rs: 96, pico: "17h–19h", km: "0,8" },
  { nome: "Rua do Comércio × Av. Brasil", rs: 81, pico: "11h–13h", km: "1,4" },
  { nome: "Praça Central × Rua Nova", rs: 74, pico: "18h–20h", km: "2,1" },
];

export function PreviaSinais() {
  return (
    <div className="rounded-[18px] border px-4 py-3" style={{ borderColor: "rgba(255,255,255,.08)", background: "#0e0e0f" }}>
      <p className="text-[10px] font-black tracking-[.16em]" style={{ color: "#F5B800" }}>SINAIS QUENTES PERTO DE VOCÊ</p>
      {linhas.map((l, i) => (
        <div key={l.nome} className="flex items-center justify-between gap-3 py-2.5" style={i ? { borderTop: "1px solid rgba(255,255,255,.06)" } : undefined}>
          <div className="min-w-0">
            <p className="text-[13.5px] font-extrabold truncate">{i + 1}. {l.nome}</p>
            <p className="text-[11.5px]" style={{ color: "#b9b3a6" }}>pico {l.pico} · {l.km} km</p>
          </div>
          <p className="text-[15px] font-black shrink-0" style={{ color: "#3DD68C" }}>R$ {l.rs}/h</p>
        </div>
      ))}
    </div>
  );
}
