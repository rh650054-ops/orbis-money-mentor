import { useNavigate } from "react-router-dom";

interface Props {
  onDone: () => void;
}

export default function MissionDay1Modal({ onDone }: Props) {
  const navigate = useNavigate();

  const handleAccept = () => {
    localStorage.setItem("missao_dia1_vista", "true");
    onDone();
    navigate("/daily-goals");
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-6">
      <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-8 max-w-sm w-full text-center space-y-5 animate-fade-in">
        <span className="text-5xl block">🎯</span>
        <h2 className="text-xl font-bold text-white">Sua primeira missão</h2>
        <p className="text-[15px] text-[#888888] leading-relaxed">
          Hoje você tem um objetivo simples: iniciar o DEFCON 4 e registrar sua primeira venda. Só isso. Não precisa bater meta ainda. Só precisa começar.
        </p>
        <button
          onClick={handleAccept}
          className="w-full py-4 rounded-xl font-bold text-black bg-[#F4A100] text-lg active:scale-[0.97] transition-transform"
        >
          Aceitar a missão →
        </button>
        <button
          onClick={() => { localStorage.setItem("missao_dia1_vista", "true"); onDone(); }}
          className="text-sm text-[#888888] hover:text-white transition-colors"
        >
          Pular
        </button>
      </div>
    </div>
  );
}
