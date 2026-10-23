/* ============================================================
   CRM da Vant — Admin › Contas demo
   Port of src/pages/AdminDemoUsers.tsx:
     - "Em teste (3 dias)": profiles with plan_status = 'trial', ordered by trial_end
     - create demo account via edge function create-demo-user (shows e-mail + password,
       reveal/hide + copy buttons)
     - list of active demo accounts (profiles.is_demo = true) with note + created date
     - revoke: same profiles update the app does
   Server-side checks (admin) stay in the edge function / RLS.
   ============================================================ */
(function () {
  "use strict";
  if (!window.CRMAdmin) return;
  const U = window.CRMAdmin.util;
  const esc = U.esc;

  const INPUT = "width:100%;padding:9px 11px;border:1px solid var(--line2);border-radius:9px;background:var(--panel);color:var(--ink);font:inherit;box-sizing:border-box";
  const LABEL = "display:block;font-size:12px;color:var(--dim);margin-bottom:4px";

  // Credentials of the last created account survive re-renders (cleared by "Fechar").
  let credenciais = null;   // {email, password, existing, message}
  let mostrarSenha = false;
  // Unsent form draft survives re-renders too.
  let rascunho = { email: "", nickname: "", note: "" };

  async function carregar(sb) {
    const [trial, demo] = await Promise.all([
      sb.from("profiles")
        .select("id, user_id, email, nickname, plan_status, trial_end, created_at")
        .eq("plan_status", "trial")
        // only trials still running (599 old ones from June stayed "trial" until they reopen the app)
        .gte("trial_end", U.hojeBR())
        .order("trial_end", { ascending: true }),
      sb.from("profiles")
        .select("id, user_id, email, nickname, demo_note, created_at")
        .eq("is_demo", true)
        .order("created_at", { ascending: false }),
    ]);
    return {
      trial: trial.data || [], trialErro: trial.error ? trial.error.message : null,
      demo: demo.data || [], demoErro: demo.error ? demo.error.message : null,
    };
  }

  function htmlTrial(lista, erro) {
    let corpo;
    if (erro) corpo = `<p style="color:var(--bad);font-size:13px">Erro ao carregar usuários em teste: ${esc(erro)}</p>`;
    else if (!lista.length) corpo = `<p style="color:var(--dim);font-size:13px;text-align:center;padding:12px 0">Ninguém em teste no momento.</p>`;
    else corpo = lista.map((u) => {
      const fim = u.trial_end ? new Date(u.trial_end) : null;
      const dias = fim && !isNaN(fim) ? Math.ceil((fim.getTime() - Date.now()) / 86400000) : null;
      const pill = dias === null ? "" :
        `<span class="pill ${dias <= 1 ? "bad" : "warn"}">${dias <= 0 ? "expira hoje" : `${dias} ${dias === 1 ? "dia" : "dias"}`}</span>`;
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;margin-top:8px;background:var(--panel2)">
          <div style="min-width:0">
            <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.nickname || "Sem nome")}</div>
            <div style="font-size:12px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.email || "")}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">${pill}
            ${fim && !isNaN(fim) ? `<div style="font-size:11px;color:var(--faint);margin-top:3px">até ${esc(fim.toLocaleDateString("pt-BR"))}</div>` : ""}
          </div>
        </div>`;
    }).join("");
    return `<div class="box" style="padding:14px;margin-bottom:12px">
        <div class="mini-h">Em teste (3 dias) — ${lista.length}</div>${corpo}</div>`;
  }

  function htmlForm() {
    return `<div class="box" style="padding:14px;margin-bottom:12px">
        <div class="mini-h">Criar nova conta demo</div>
        <form id="demo-form" style="margin-top:10px">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
            <label><span style="${LABEL}">E-mail *</span>
              <input id="demo-email" type="email" required placeholder="influenciador@exemplo.com" value="${esc(rascunho.email)}" style="${INPUT}"></label>
            <label><span style="${LABEL}">Apelido</span>
              <input id="demo-nick" placeholder="Opcional" value="${esc(rascunho.nickname)}" style="${INPUT}"></label>
          </div>
          <label style="display:block;margin-top:10px"><span style="${LABEL}">Observação</span>
            <textarea id="demo-note" rows="3" placeholder="Ex: Conta para influenciador X" style="${INPUT};resize:vertical">${esc(rascunho.note)}</textarea></label>
          <button type="submit" class="btn go block" id="demo-criar" style="margin-top:10px">Criar conta demo</button>
        </form>
      </div>`;
  }

  function htmlCredenciais() {
    if (!credenciais) return "";
    const c = credenciais;
    const linha = (rotulo, valor, extra) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0">
        <div style="min-width:0;flex:1"><div style="font-size:12px;color:var(--dim)">${rotulo}</div>
          <div style="font-family:ui-monospace,Menlo,monospace;font-weight:700;word-break:break-all">${valor}</div></div>
        <div style="display:flex;gap:6px;flex-shrink:0">${extra}</div></div>`;
    return `<div class="box" style="padding:14px;margin-bottom:12px;border-color:var(--ok);background:var(--ok-s)">
        <div class="mini-h" style="color:var(--ok)">✓ ${esc(c.message || "Conta demo criada com sucesso!")}</div>
        <div style="margin-top:8px;padding:6px 12px;border:1px solid var(--line);border-radius:10px;background:var(--panel)">
          ${linha("E-mail", esc(c.email), `<button class="btn ghost" data-demo-copiar="email" style="padding:6px 10px;font-size:12px">Copiar</button>`)}
          ${linha("Senha", mostrarSenha ? esc(c.password) : "••••••••••••",
            `<button class="btn ghost" data-demo-ver style="padding:6px 10px;font-size:12px">${mostrarSenha ? "Ocultar" : "Mostrar"}</button>
             <button class="btn ghost" data-demo-copiar="senha" style="padding:6px 10px;font-size:12px">Copiar</button>`)}
        </div>
        ${c.existing ? `<p style="font-size:12px;color:var(--dim);margin:8px 0 0">Essa conta já existia: a senha dela não foi alterada.</p>` : ""}
        <button class="btn ghost block" data-demo-fechar-cred style="margin-top:10px">Fechar</button>
      </div>`;
  }

  function htmlDemo(lista, erro) {
    let corpo;
    if (erro) corpo = `<p style="color:var(--bad);font-size:13px">Não foi possível carregar os usuários demo: ${esc(erro)}</p>`;
    else if (!lista.length) corpo = `<p style="color:var(--dim);font-size:13px;text-align:center;padding:16px 0">Nenhuma conta demo criada ainda.</p>`;
    else corpo = lista.map((u) => `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:12px;border:1px solid var(--line);border-radius:10px;margin-top:8px;background:var(--panel2)">
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><b style="word-break:break-word">${esc(u.nickname || u.email || "")}</b><span class="pill p4">DEMO</span></div>
          <div style="font-size:12px;color:var(--dim);margin-top:3px;word-break:break-all">${esc(u.email || "")}</div>
          ${u.demo_note ? `<div style="font-size:12px;color:var(--dim);margin-top:3px;font-style:italic">${esc(u.demo_note)}</div>` : ""}
          <div style="font-size:11px;color:var(--faint);margin-top:6px">Criado em: ${esc(new Date(u.created_at).toLocaleDateString("pt-BR"))}</div>
        </div>
        <button class="btn lose" data-demo-revogar="${esc(u.user_id)}" data-demo-nome="${esc(u.nickname || u.email || "")}" style="padding:6px 11px;font-size:12px;flex-shrink:0">Revogar</button>
      </div>`).join("");
    return `<div class="box" style="padding:14px;margin-bottom:12px">
        <div class="mini-h">Contas demo ativas (${lista.length})</div>${corpo}</div>`;
  }

  async function render(el, ctx) {
    const sb = ctx.sb;
    const d = await carregar(sb);
    if (d.demoErro) U.aviso("Não foi possível carregar os usuários demo.", true);

    el.innerHTML = `
      <div class="box" style="padding:12px 14px;margin-bottom:12px">
        <b>Usuários demo</b>
        <div style="font-size:12px;color:var(--dim);margin-top:2px">Crie e gerencie contas de demonstração ilimitadas.</div>
      </div>
      ${htmlForm()}
      <div id="demo-cred">${htmlCredenciais()}</div>
      ${htmlDemo(d.demo, d.demoErro)}
      ${htmlTrial(d.trial, d.trialErro)}`;

    // Keep the draft in memory so a re-render does not wipe it.
    const fEmail = el.querySelector("#demo-email"), fNick = el.querySelector("#demo-nick"), fNote = el.querySelector("#demo-note");
    fEmail.addEventListener("input", () => { rascunho.email = fEmail.value; });
    fNick.addEventListener("input", () => { rascunho.nickname = fNick.value; });
    fNote.addEventListener("input", () => { rascunho.note = fNote.value; });

    el.querySelector("#demo-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const email = fEmail.value.trim();
      if (!email) { U.aviso("E-mail é obrigatório", true); return; }
      const btn = el.querySelector("#demo-criar");
      btn.disabled = true; btn.textContent = "Criando...";
      const r = await U.funcao("create-demo-user", {
        email,
        nickname: fNick.value.trim() || email.split("@")[0],
        note: fNote.value.trim() || "Conta de demonstração criada manualmente",
      });
      btn.disabled = false; btn.textContent = "Criar conta demo";
      if (r.error || !(r.data && r.data.success)) {
        U.aviso(r.error || (r.data && r.data.error) || "Não foi possível criar a conta demo.", true);
        return;
      }
      credenciais = {
        email: r.data.user.email, password: r.data.user.password,
        existing: !!r.data.user.existing, message: r.data.message,
      };
      mostrarSenha = false;
      rascunho = { email: "", nickname: "", note: "" };
      U.aviso("Conta demo criada! As credenciais foram geradas.");
      window.CRMAdmin.recarregar();
    });

    // Credentials box: reveal / copy / close (re-drawn in place, no reload).
    const cred = el.querySelector("#demo-cred");
    function ligarCred() {
      cred.querySelectorAll("[data-demo-copiar]").forEach((b) => b.addEventListener("click", () => {
        if (!credenciais) return;
        if (b.dataset.demoCopiar === "email") U.copiar(credenciais.email, "E-mail copiado");
        else U.copiar(credenciais.password, "Senha copiada");
      }));
      const ver = cred.querySelector("[data-demo-ver]");
      if (ver) ver.addEventListener("click", () => { mostrarSenha = !mostrarSenha; cred.innerHTML = htmlCredenciais(); ligarCred(); });
      const fechar = cred.querySelector("[data-demo-fechar-cred]");
      if (fechar) fechar.addEventListener("click", () => { credenciais = null; mostrarSenha = false; cred.innerHTML = ""; });
    }
    ligarCred();

    // Revoke: same update as the app (profiles by user_id).
    el.querySelectorAll("[data-demo-revogar]").forEach((b) => b.addEventListener("click", async () => {
      const nome = b.dataset.demoNome || "esta conta";
      if (!U.confirmar(`Revogar acesso demo de ${nome}?\n\nA conta será desativada e o usuário não poderá mais acessar o sistema.`)) return;
      b.disabled = true;
      const { error } = await sb.from("profiles")
        .update({ is_demo: false, billing_exempt: false, plan_status: "expired", demo_note: "Conta demo revogada" })
        .eq("user_id", b.dataset.demoRevogar);
      if (error) { b.disabled = false; U.aviso("Não foi possível revogar a conta demo: " + error.message, true); return; }
      U.aviso("Conta revogada: a conta demo foi desativada.");
      window.CRMAdmin.recarregar();
    }));
  }

  window.CRMAdmin.secao("demo", { titulo: "Contas demo", ordem: 20, render });
})();
