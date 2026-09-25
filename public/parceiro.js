/* VANT PARCEIROS — painel do afiliado.
   Lê tudo de UMA RPC (parc_painel) usando só o token do link. O banco decide o que
   devolver; a página não conhece id de afiliado nenhum. Sem login, sem dados sensíveis. */
(function () {
  var SB = "https://qbcsjsdwjjpybvzbxszi.supabase.co";
  var KEY = "sb_publishable_QHFeQuWwHWFOl_0dIbiB4A_6QQCmPyy";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var brl = function (n) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0); };
  var pct = function (a, b) { return b > 0 ? Math.round(a / b * 100) + "%" : "—"; };
  var toast = function (t) { var e = $("toast"); e.textContent = t; e.dataset.on = "1"; clearTimeout(e._t); e._t = setTimeout(function () { e.dataset.on = "0"; }, 2000); };
  var D = null, FILTRO = "todas";

  var token = new URLSearchParams(location.search).get("t") || "";
  if (!token || token.length < 20) { erro("Este link não é válido."); return; }

  function erro(t) { $("carregando").hidden = true; $("erroTxt").textContent = t; $("erro").hidden = false; }

  fetch(SB + "/rest/v1/rpc/parc_painel", {
    method: "POST", headers: { "Content-Type": "application/json", "apikey": KEY, "Authorization": "Bearer " + KEY },
    body: JSON.stringify({ p_token: token })
  }).then(function (r) { return r.json(); }).then(function (j) {
    if (!j || j.code || j.message) { erro("Não consegui abrir o painel agora. Tente de novo em instantes."); return; }
    if (j.bloqueado) { erro("Este painel está bloqueado. Fale com o time da Vant."); return; }
    D = j; render();
  }).catch(function () { erro("Sem conexão. Verifique a internet e tente de novo."); });

  /* ================= render ================= */
  function render() {
    var a = D.afiliado, f = D.financeiro, c = D.carteira, n = D.nivel;
    $("carregando").hidden = true; $("app").hidden = false;
    $("nome").textContent = a.nome;
    $("av").innerHTML = a.avatar ? '<img src="' + esc(a.avatar) + '" alt="">' : esc((a.nome || "V").trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase());
    $("nivelPill").textContent = "Vant " + a.nivel_nome;
    $("codigo").textContent = "código " + a.code;
    $("desde").textContent = a.entrou_em ? "· no programa desde " + a.entrou_em : "";
    $("link").textContent = a.link.replace(/^https?:\/\//, "");
    $("quando").textContent = new Date(D.gerado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    $("btCopiar").onclick = function () { copiar(a.link); };
    $("btCompartilhar").onclick = function () {
      var txt = "Tô usando a Vant pra organizar o meu corre. Testa 3 dias grátis pelo meu link: " + a.link;
      if (navigator.share) { navigator.share({ title: "Vant", text: txt, url: a.link }).catch(function () {}); }
      else { copiar(txt); }
    };
    renderGeral(); renderCarteira(); renderComissoes(); renderConquistas();
  }
  function copiar(t) { try { navigator.clipboard.writeText(t).then(function () { toast("Link copiado"); }, function () { toast("Copie da tela"); }); } catch (e) { toast("Copie da tela"); } }

  function nivelHTML() {
    var n = D.nivel, prog = n.proximo_vp ? Math.min(100, Math.round(n.vp / n.proximo_vp * 100)) : 100;
    return '<div class="nivel">' +
      '<div class="row"><div class="n">Vant ' + esc(n.atual_nome) + '<small>nível atual</small></div><div class="num" style="font-weight:800;color:var(--gold)">' + n.vp + ' VP</div></div>' +
      '<div class="bar"><i style="width:' + prog + '%"></i></div>' +
      (n.proximo ? '<div class="f num">' + n.vp + ' / ' + n.proximo_vp + ' VP · faltam <b>' + n.faltam + ' VP ativos</b> para atingir ' + esc(n.proximo_nome) + '.</div>'
                 : '<div class="f">Você está no nível mais alto. Mantenha a carteira ativa.</div>') +
      '<div class="niveis">' + (n.niveis || []).map(function (x) {
        return '<span class="' + (x.slug === n.atual ? "on" : (x.vp_min <= n.vp ? "ok" : "")) + '">' + esc(x.nome) + '<br><small class="num">' + x.vp_min + ' VP</small></span>';
      }).join("") + '</div>' +
      '<p class="nota">1 cliente ativo no plano Mensal = 1 VP (Ponto Vant). Cliente que cancela ou deixa de pagar deixa de contar.</p></div>';
  }

  function renderGeral() {
    var f = D.financeiro, c = D.carteira, p = D.pagamentos;
    $("p-geral").innerHTML =
      '<div class="big g"><div class="k">Saldo disponível</div><div class="v num">' + brl(f.disponivel) + '</div>' +
      '<div class="s">' + (p.abaixo_do_minimo && f.disponivel > 0 ? 'Abaixo de ' + brl(p.saldo_minimo) + ' acumula pro próximo ciclo · ' : '') + 'próximo pagamento ' + esc(p.proxima_data) + '</div></div>' +
      '<div class="g2">' +
      '<div class="st g"><div class="k">Renda recorrente estimada</div><div class="v num">' + brl(f.renda_recorrente) + '</div><div class="s">por ciclo, com a carteira de hoje</div></div>' +
      '<div class="st ok"><div class="k">Clientes ativos</div><div class="v num">' + c.ativos + '</div><div class="s">' + c.assinaturas + ' assinaturas conquistadas</div></div>' +
      '</div>' +
      nivelHTML() +
      '<div class="g3">' +
      '<div class="st"><div class="k">Pendente</div><div class="v num">' + brl(f.pendente) + '</div></div>' +
      '<div class="st"><div class="k">Recebido no mês</div><div class="v num">' + brl(f.recebido_mes) + '</div></div>' +
      '<div class="st"><div class="k">Total recebido</div><div class="v num">' + brl(f.total_recebido) + '</div></div>' +
      '</div>' +
      '<p class="nota">Estimativa baseada nos clientes atualmente ativos. O valor pode variar por cancelamentos, inadimplência, alteração de plano ou falha na renovação.</p>';
  }

  function renderCarteira() {
    var c = D.carteira, fu = D.funil;
    var lin = function (k, v, cls) { return '<div class="st ' + (cls || "") + '"><div class="k">' + k + '</div><div class="v num">' + v + '</div></div>'; };
    var fl = function (k, v, prev, rot) { return '<div class="fl"><span>' + k + '</span><b class="num">' + v + '</b><i>' + (prev == null ? "" : rot + " " + pct(v, prev)) + '</i></div>'; };
    $("p-carteira").innerHTML =
      '<div class="sec">Sua carteira</div>' +
      '<div class="g2">' +
      '<div class="st hero"><div class="k">Clientes ativos</div><div class="v num">' + c.ativos + '</div><div class="s">é isso que constrói sua renda recorrente</div></div>' +
      lin("Pessoas indicadas", c.indicados) + lin("Criaram conta", c.contas) +
      lin("Assinaturas conquistadas", c.assinaturas) + lin("Renovações no mês", c.renov_mes) +
      lin("Cancelados", c.cancelados, c.cancelados ? "bad" : "") + lin("Inadimplentes", c.inadimplentes, c.inadimplentes ? "warn" : "") +
      lin("Receita líquida gerada", brl(c.receita_total)) + lin("Receita recorrente da carteira", brl(c.receita_recorrente)) +
      '</div>' +
      '<div class="sec">Seu funil</div>' +
      '<div class="funil">' +
      fl("Cliques no link", fu.cliques) +
      fl("Cadastros", fu.cadastros, fu.cliques, "clique→cad.") +
      fl("Criaram conta", fu.contas, fu.cadastros, "cad.→conta") +
      fl("Usaram o app (teste)", fu.testes, fu.contas, "conta→teste") +
      fl("Assinaram", fu.assinaram, fu.testes, "teste→assin.") +
      fl("Continuam ativos", fu.ativos, fu.assinaram, "assin.→ativo") +
      '</div>' +
      '<p class="nota">Cliques passaram a ser contados a partir de hoje, pelo link novo. Cadastros anteriores continuam valendo.</p>' +
      '<div class="sec">Quem entrou pelo seu link</div>' +
      '<div class="lista">' + ((D.indicados || []).length ? D.indicados.map(function (i) {
        var st = { ativo: "Ativo", teste: "Em teste", conta: "Criou conta", lead: "Cadastro", inadimplente: "Inadimplente", cancelado: "Cancelado", expirado: "Expirado" }[i.status] || i.status;
        return '<div class="li"><span class="dot ' + esc(i.status) + '"></span><div class="nm"><b>' + esc(i.nome) + '</b><span>' + (i.entrada ? "entrou " + esc(i.entrada) : "") + (i.plano ? " · " + esc(i.plano) : "") + '</span></div>' +
          '<div class="r"><b style="font-size:13px">' + st + '</b><span>' + (i.gerou_comissao ? (i.renovacoes ? i.renovacoes + " renov." : "gerou comissão") : "sem comissão") + '</span></div></div>';
      }).join("") : '<div class="vazio">Ninguém entrou pelo seu link ainda. Compartilha!</div>') + '</div>';
  }

  function renderComissoes() {
    var p = D.pagamentos, lista = D.cobrancas || [];
    var filtros = [["todas", "Todas"], ["nova", "Novas assinaturas"], ["renovacao", "Renovações"], ["pendente", "Pendentes"], ["confirmada", "Confirmadas"], ["paga", "Pagas"], ["cancelada", "Canceladas"]];
    var vis = lista.filter(function (x) { return FILTRO === "todas" || x.tipo === FILTRO || x.status === FILTRO; });
    var tipoNome = { nova: "Nova assinatura", renovacao: "Renovação", upgrade: "Upgrade", downgrade: "Downgrade", reembolso: "Reembolso", estorno: "Estorno" };
    var stNome = { pendente: "Pendente", confirmada: "Confirmada", paga: "Paga", cancelada: "Cancelada" };
    $("p-comissoes").innerHTML =
      '<div class="sec">Pagamentos</div>' +
      '<div class="g2">' +
      '<div class="st g"><div class="k">Próximo pagamento</div><div class="v num" style="font-size:18px">' + esc(p.proxima_data) + '</div><div class="s">previsto ' + brl(p.valor_previsto) + (p.abaixo_do_minimo ? " · mínimo " + brl(p.saldo_minimo) : "") + '</div></div>' +
      '<div class="st"><div class="k">Forma</div><div class="v" style="font-size:18px">' + esc(p.forma) + '</div><div class="s">' + (p.pix ? "chave " + esc(p.pix) : "cadastre sua chave Pix com o time da Vant") + '</div></div>' +
      '</div>' +
      (p.ultimo ? '<p class="nota">Último pagamento: ' + esc(p.ultimo.data) + ' · ' + brl(p.ultimo.valor) + '</p>' : '') +
      ((p.historico || []).length ? '<div class="lista">' + p.historico.map(function (h) {
        return '<div class="li"><div class="nm"><b>' + esc(h.data) + '</b><span>' + (h.referencia ? "ref. " + esc(h.referencia) : "") + (h.transacao ? " · " + esc(h.transacao) : "") + '</span></div><div class="r"><b class="num">' + brl(h.valor) + '</b><span>' + esc(h.status) + '</span></div></div>';
      }).join("") + '</div>' : '') +
      '<div class="sec">Histórico de comissões</div>' +
      '<div class="chips">' + filtros.map(function (f) { return '<button class="chip" data-filtro="' + f[0] + '" aria-pressed="' + (FILTRO === f[0]) + '">' + f[1] + '</button>'; }).join("") + '</div>' +
      '<div class="lista">' + (vis.length ? vis.map(function (x) {
        return '<div class="li"><div class="nm"><b>' + esc(x.cliente) + ' <span style="font-weight:500;color:var(--ink3)">· ' + esc(tipoNome[x.tipo] || x.tipo) + '</span></b>' +
          '<span class="num">' + esc(x.data) + ' · ' + esc(x.plano || "") + ' · líquido ' + brl(x.liquido) + ' · ' + x.pct + '%</span></div>' +
          '<div class="r"><b class="num" style="' + (x.comissao < 0 ? "color:var(--bad)" : "") + '">' + brl(x.comissao) + '</b><span class="tag ' + esc(x.status) + '">' + (stNome[x.status] || x.status) + '</span></div></div>';
      }).join("") : '<div class="vazio">Nenhuma comissão ' + (FILTRO === "todas" ? "ainda" : "nesse filtro") + '.</div>') + '</div>' +
      '<p class="nota">Comissão calculada sobre o valor líquido que a Vant recebe (já sem a taxa da Hotmart). Só existe quando a cobrança é aprovada; reembolso, chargeback ou cancelamento cancelam a comissão daquela cobrança.</p>';
    $("p-comissoes").querySelectorAll("[data-filtro]").forEach(function (b) { b.onclick = function () { FILTRO = b.dataset.filtro; renderComissoes(); }; });
  }

  function renderConquistas() {
    var r = D.regras, ic = { primeira_assinatura: "🥇", ativos_5: "🏅", ativos_10: "🏆", ativos_25: "🏆", ativos_50: "👑", ativos_100: "💎", nivel_embaixador: "⭐", nivel_pro: "🌟", nivel_elite: "✨" };
    $("p-conquistas").innerHTML =
      '<div class="sec">Suas conquistas</div>' +
      '<div class="badges">' + (D.conquistas || []).map(function (c) {
        return '<div class="bd ' + (c.ok ? "ok" : "lock") + '"><div class="ic">' + (c.ok ? (ic[c.tipo] || "🏆") : "🔒") + '</div><div class="t">' + esc(c.nome) + '</div><div class="s">' + (c.ok ? "desbloqueado" + (c.em ? " " + esc(c.em) : "") : (c.faltam != null ? "faltam " + c.faltam : "bloqueado")) + '</div></div>';
      }).join("") + '</div>' +
      '<div class="sec">Campanhas Vant</div>' +
      ((D.campanhas || []).length ? D.campanhas.map(function (c) {
        var prog = Math.min(100, Math.round((c.progresso / c.meta) * 100));
        return '<div class="camp"><b>' + esc(c.nome) + '</b><p>' + esc(c.descricao || "") + '</p><p>Até ' + esc(c.fim) + ' · prêmio: <b style="color:var(--gold)">' + esc(c.premio || "—") + '</b></p>' +
          '<div class="bar"><i style="width:' + prog + '%"></i></div><p class="num">' + c.progresso + ' / ' + c.meta + (c.criterio === "vp_ativos" ? " VP" : "") + '</p></div>';
      }).join("") : '<div class="lista"><div class="vazio">Nenhuma campanha ativa agora. Quando a Vant lançar uma, ela aparece aqui.</div></div>') +
      '<div class="sec">Regras do programa</div><div class="termos">' +
      det("Como a comissão é calculada", "Sempre sobre o valor líquido que a Vant recebe da Hotmart (hoje cerca de " + brl(r.liquido_ref) + " de um plano de R$ 29,90), nunca sobre o valor bruto. Primeira cobrança do cliente indicado: " + r.pct_primeira + "%. Renovações: " + r.pct_recorrente + "% recorrente.") +
      det("Quando a comissão existe e quando é confirmada", "Ela nasce quando a Hotmart aprova a cobrança. " + (r.dias_confirmacao > 0 ? "Fica pendente por " + r.dias_confirmacao + " dias e depois é confirmada." : "É confirmada na hora.") + " Cobrança recusada, boleto não pago ou inadimplência não geram comissão.") +
      det("Reembolso, chargeback e cancelamento", "Se a cobrança for reembolsada, contestada (chargeback) ou cancelada, a comissão daquela cobrança é cancelada. Se já tiver sido paga, o valor é descontado do próximo pagamento.") +
      det("Pagamento", "Uma vez por mês, no dia " + r.dia_pagamento + ", por Pix, quando o saldo confirmado for de pelo menos " + brl(r.saldo_minimo) + ". Abaixo disso, acumula pro ciclo seguinte.") +
      det("Níveis e VP (Pontos Vant)", "VP contam só assinaturas ativas: " + (r.vp_planos || []).map(function (p) { return p.nome + " (" + brl(p.preco) + ") = " + p.vp + " VP"; }).join(" · ") + ". Cliente que cancela ou deixa de pagar deixa de contar. Níveis: " + (D.nivel.niveis || []).map(function (n) { return n.nome + " a partir de " + n.vp_min + " OP"; }).join(", ") + ". " + (D.nivel.progressao_ativa ? "O nível altera o percentual recorrente." : "Por enquanto os níveis são reconhecimento e não alteram a comissão.")) +
      det("Campanhas e premiações", "Prêmios extras são campanhas temporárias criadas pela Vant, com período, regra e meta próprios. Não fazem parte da remuneração permanente.") +
      det("Fraude", "Auto-indicação, cadastros falsos, uso de cartões de terceiros ou qualquer manipulação cancelam as comissões envolvidas e podem bloquear o afiliado.") +
      det("Mudanças no programa", "A Vant pode alterar percentuais, níveis e regras para novos participantes e novas campanhas. Comissões já confirmadas não mudam — cada cobrança guarda a regra que valia no dia.") +
      '</div>';
  }
  function det(t, b) { return '<details><summary>' + esc(t) + '</summary><p>' + esc(b) + '</p></details>'; }

  /* ================= abas ================= */
  document.querySelectorAll(".tab").forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-selected", x === b); });
      ["geral", "carteira", "comissoes", "conquistas"].forEach(function (k) { $("p-" + k).hidden = k !== b.dataset.tab; });
      window.scrollTo({ top: 0 });
    };
  });
})();
