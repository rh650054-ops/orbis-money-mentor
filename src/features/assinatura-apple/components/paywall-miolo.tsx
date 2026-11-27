import type { ReactNode } from "react";

/** The body of every paywall screen (Paywall V3, 27/11/2026). It fills what the full screen leaves
    under its header: the content scrolls INSIDE it (flex-1 min-h-0 overflow-y-auto) and the footer,
    when there is one, is its own row of the column, so it never covers the content. Same layout as the
    screens that scroll on the iPhone (the VANT IA chat, the welcome tour): the fixed frame never
    scrolls itself. Inside a page (not full screen) it simply grows with its content. */
export function PaywallMiolo({ children, rodape }: { children: ReactNode; rodape?: ReactNode }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div data-rolagem="paywall" className="flex-1 min-h-0 overflow-y-auto [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
        {children}
        {!rodape && <div aria-hidden className="h-[max(16px,env(safe-area-inset-bottom))]" />}
      </div>
      {rodape && <div className="shrink-0 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{rodape}</div>}
    </div>
  );
}
