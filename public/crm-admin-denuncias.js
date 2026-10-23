/* ============================================================
   CRM da Vant — Admin · Denúncias da comunidade (23/10/2026)
   The stores require moderation of user content. Users report posts/comments in the
   app (community_denunciar); 3 different reports hide the item on their own. Here the
   team decides: "Remover" (stays hidden) or "Manter" (shows again).
   RPCs: admin_denuncias_abertas, admin_denuncia_resolver. Security is in the DB.
   ============================================================ */
(function () {
  "use strict";
  if (!window.CRMAdmin) return;
  const U = window.CRMAdmin.util;
  const esc = U.esc;
  const MOTIVO = { ofensivo: "ofensivo", golpe: "golpe", spam: "spam", sexual: "sexual", outro: "outro" };

  function quando(ts) {
    const d = new Date(ts);
    return isNaN(d) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function item(r, i) {
    const tipo = r.comment_id ? "Comentário" : "Post";
    const motivos = String(r.motivos || "").split(", ").map((m) => MOTIVO[m] || m).join(", ");
    return `<div style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-top:10px;background:var(--panel)">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <b>${esc(tipo)} de ${esc(r.autor || "Vendedor")}</b>
        <span class="pill bad">${r.denuncias} denúncia${r.denuncias === 1 ? "" : "s"}</span>
        <span class="pill">${esc(motivos)}</span>
        ${r.escondido ? `<span class="pill warn">escondido</span>` : ""}
        <span style="margin-left:auto;font-size:11px;color:var(--faint)">${esc(quando(r.primeira))}</span>
      </div>
      <p style="margin:8px 0 0;font-size:13px;white-space:pre-wrap;word-break:break-word">${esc(r.texto || "(sem texto)")}</p>
      ${r.imagem ? `<img src="${esc(r.imagem)}" alt="" style="margin-top:8px;max-height:220px;border-radius:10px">` : ""}
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn lose" data-den="${i}" data-acao="remover">Remover</button>
        <button class="btn ghost" data-den="${i}" data-acao="manter">Manter (não viola)</button>
      </div>
    </div>`;
  }

  async function render(el, ctx) {
    const { data, error } = await U.rpc("admin_denuncias_abertas");
    const lista = data || [];
    el.innerHTML = `
      <div class="box" style="padding:12px 14px;margin-bottom:12px">
        <b>Denúncias da comunidade</b>
        <div style="font-size:12px;color:var(--dim);margin-top:2px">Posts e comentários denunciados no app. Com 3 denúncias de pessoas diferentes o item some sozinho até alguém decidir aqui.</div>
      </div>
      ${error ? `<div style="color:var(--bad);font-size:12px">Não foi possível carregar: ${esc(error)}</div>` : ""}
      ${!error && lista.length === 0 ? `<div style="color:var(--dim);padding:18px 0;text-align:center">Nenhuma denúncia aberta.</div>` : ""}
      ${lista.map(item).join("")}`;
    el.querySelectorAll("[data-den]").forEach((b) => b.addEventListener("click", async () => {
      const r = lista[+b.dataset.den];
      if (!r) return;
      const remover = b.dataset.acao === "remover";
      if (remover && !U.confirmar("Remover esse conteúdo da comunidade?")) return;
      b.disabled = true;
      const res = await U.rpc("admin_denuncia_resolver", { p_post: r.post_id, p_comment: r.comment_id, p_remover: remover });
      if (res.error) { b.disabled = false; U.aviso("Não deu: " + res.error, true); return; }
      U.aviso(remover ? "Conteúdo removido" : "Conteúdo mantido");
      window.CRMAdmin.recarregar();
    }));
  }

  window.CRMAdmin.secao("denuncias", { titulo: "Denúncias", ordem: 15, render });
})();
