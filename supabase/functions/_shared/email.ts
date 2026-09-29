// Envio de e-mail transacional via Resend (https://resend.com).
// Segredos (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY  — chave da conta Resend
//   RESEND_FROM     — remetente, ex.: "Vant <nao-responda@vant.app>" (dominio verificado no Resend)
// Nunca gravar a chave em codigo.

export async function enviarEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY / RESEND_FROM nao configurados");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${txt.slice(0, 200)}`);
  }
}

/** Layout simples, escuro, no padrao visual da Vant. */
export function layoutEmail(titulo: string, corpoHtml: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#0f0f10;font-family:Arial,Helvetica,sans-serif;color:#f5f5f5">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <p style="margin:0 0 20px;font-size:22px;font-weight:700;letter-spacing:.5px">VANT</p>
    <h1 style="font-size:20px;margin:0 0 16px">${titulo}</h1>
    <div style="font-size:15px;line-height:1.55;color:#d6d6d6">${corpoHtml}</div>
    <p style="margin:28px 0 0;font-size:12px;color:#8a8a8a">Se você não pediu isso, pode ignorar este e-mail. Ninguém consegue mexer na sua conta sem este link/código.</p>
  </div></body></html>`;
}

/** Codigo numerico de 6 digitos com aleatoriedade criptografica. */
export function gerarCodigo6(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return n.toString().padStart(6, "0");
}

export async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
