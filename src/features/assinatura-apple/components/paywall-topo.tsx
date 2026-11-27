const GOLD = "#F5B800";

/** The top of the first paywall screen: the promise, then the plans right below it. */
export function PaywallTopo({ troca }: { troca: boolean }) {
  return (
    <header className="text-center pt-1">
      <p className="text-[12px] font-black tracking-[.46em] pl-[.46em]" style={{ color: GOLD }}>VANT</p>
      <h1 className="mt-2.5 font-black leading-[1.05] tracking-[-.025em] text-[clamp(25px,7.4vw,31px)]">
        {troca ? "Troque de plano quando quiser." : <>Venda mais.<br /><span style={{ color: GOLD }}>Saiba quanto lucrou.</span></>}
      </h1>
      <p className="mt-2 text-[13.5px] leading-snug mx-auto max-w-[300px]" style={{ color: "#a9a397" }}>
        Escolha o plano ideal para o seu corre.
      </p>
    </header>
  );
}
