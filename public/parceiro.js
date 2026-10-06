/* VANT PARCEIROS v3 (06/10/2026) — painel do influenciador.
   Lê tudo de UMA RPC (parc_painel) usando só o token do link. O banco decide o que
   devolver; a página não conhece id de afiliado nenhum. Sem login, sem dados sensíveis.
   v3: comprovante do próximo Pix no topo, botão de mandar no WhatsApp, mensagens
   prontas, gráfico de ganhos por mês, carteira por status, lista de clientes com
   filtro e "ver mais", comissões agrupadas por mês. */
(function () {
  var SB = "https://qbcsjsdwjjpybvzbxszi.supabase.co";
  var KEY = "sb_publishable_QHFeQuWwHWFOl_0dIbiB4A_6QQCmPyy";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var brl = function (n) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0); };
  var num = function (n) { return new Intl.NumberFormat("pt-BR").format(Number(n) || 0); };
  var toast = function (t) { var e = $("toast"); e.textContent = t; e.dataset.on = "1"; clearTimeout(e._t); e._t = setTimeout(function () { e.dataset.on = "0"; }, 2000); };
  // "dd/mm/aaaa" → Date ao meio-dia (sem pulo de fuso)
  var dt = function (s) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || "")); return m ? new Date(+m[3], +m[2] - 1, +m[1], 12) : null; };
  var mesNome = function (d, longo) { return d.toLocaleDateString("pt-BR", { month: longo ? "long" : "short" }).replace(".", ""); };
  var D = null, FILTRO = "ativo", LIMITE = 20;

  var STATUS = {
    ativo: { nome: "Ativo", cor: "var(--ok)" },
    teste: { nome: "Em teste", cor: "var(--teste)" },
    inadimplente: { nome: "Atrasado", cor: "var(--warn)" },
    cancelado: { nome: "Cancelou", cor: "var(--bad)" },
    expirado: { nome: "Expirou", cor: "var(--bad)" },
    conta: { nome: "Criou conta", cor: "var(--ink4)" },
    lead: { nome: "Só cadastro", cor: "var(--ink4)" }
  };

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
  }).catch(function () { erro("Sem conexão. Confira a internet e tente de novo."); });

  /* ================= dados derivados ================= */
  function hoje() { var g = new Date(D.gerado_em || Date.now()); return new Date(g.getFullYear(), g.getMonth(), g.getDate(), 12); }
  function cobrancasValidas() { return (D.cobrancas || []).filter(function (c) { return c.status !== "cancelada"; }); }
  function doMes(ano, mes) { return cobrancasValidas().filter(function (c) { var d = dt(c.data); return d && d.getFullYear() === ano && d.getMonth() === mes; }); }
  function soma(l) { return l.reduce(function (s, c) { return s + (Number(c.comissao) || 0); }, 0); }

  /* ================= render ================= */
  function render() {
    var a = D.afiliado;
    $("carregando").hidden = true; $("app").hidden = false;
    $("nome").textContent = a.nome;
    $("av").innerHTML = a.avatar ? '<img src="' + esc(a.avatar) + '" alt="">' : esc((a.nome || "V").trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase());
    $("nivelTxt").textContent = "Vant " + a.nivel_nome;
    $("desde").textContent = a.entrou_em ? "desde " + a.entrou_em : "";
    $("link").textContent = a.link.replace(/^https?:\/\//, "");
    $("quando").textContent = new Date(D.gerado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    renderRecibo(); renderLink(); renderInicio(); renderClientes(); renderGanhos(); renderRegras();
  }

  function renderRecibo() {
    var p = D.pagamentos, f = D.financeiro, h = hoje();
    var dPix = dt(p.proxima_data), dias = dPix ? Math.round((dPix - h) / 864e5) : null;
    $("quandoPix").textContent = dPix ? (dias <= 0 ? "cai hoje" : dias === 1 ? "cai amanhã" : "cai dia " + p.proxima_data.slice(0, 5) + " (em " + dias + " dias)") : "—";
    var v = Number(p.valor_previsto) || 0, partes = brl(v).replace(/^R\$\s?/, "");
    $("valorPix").innerHTML = '<small>R$</small>' + esc(partes);
    $("subPix").textContent = p.abaixo_do_minimo && v > 0
      ? "Abaixo de " + brl(p.saldo_minimo) + " o valor junta com o próximo mês."
      : v > 0 ? "Comissão confirmada das assinaturas que vieram pelo seu link." : "Quando alguém assinar pelo seu link, a comissão aparece aqui.";
    var m = doMes(h.getFullYear(), h.getMonth());
    var novas = m.filter(function (c) { return c.tipo === "nova"; }).length, renov = m.filter(function (c) { return c.tipo === "renovacao"; }).length;
    $("mes").innerHTML =
      '<div><b>' + brl(soma(m)) + '</b><span>em ' + esc(mesNome(h, true)) + '</span></div>' +
      '<div><b>' + novas + '</b><span>' + (novas === 1 ? "assinatura nova" : "assinaturas novas") + '</span></div>' +
      '<div><b>' + renov + '</b><span>' + (renov === 1 ? "renovação" : "renovações") + '</span></div>';
  }

  function textos() {
    var l = D.afiliado.link;
    return [
      "Tô usando a Vant pra organizar meu corre: meta do dia, quanto vendi, quanto sobrou. Testa 3 dias grátis pelo meu link 👇\n" + l,
      "Vendedor de rua: a Vant mostra quanto você lucra de verdade e te ajuda a bater meta todo dia. Usa meu link e testa grátis:\n" + l,
      "Parei de anotar venda em caderno. Agora é tudo na Vant e eu sei quanto sobra no fim do mês. Link pra testar: " + l
    ];
  }
  function renderLink() {
    var l = D.afiliado.link, t = textos();
    $("btCopiar").onclick = function () { copiar(l, "Link copiado"); };
    $("btZap").onclick = function () { window.open("https://wa.me/?text=" + encodeURIComponent(t[0]), "_blank", "noopener"); };
    $("btMais").onclick = function () {
      if (navigator.share) navigator.share({ title: "Vant", text: t[0], url: l }).catch(function () {});
      else copiar(t[0], "Mensagem copiada");
    };
    $("prontas").innerHTML = t.map(function (x, i) { return '<div class="msg">' + esc(x) + '<button type="button" data-msg="' + i + '">Copiar essa mensagem</button></div>'; }).join("");
    $("prontas").querySelectorAll("[data-msg]").forEach(function (b) { b.onclick = function () { copiar(t[+b.dataset.msg], "Mensagem copiada"); }; });
  }
  function copiar(t, ok) { try { navigator.clipboard.writeText(t).then(function () { toast(ok); }, function () { toast("Segura o texto pra copiar"); }); } catch (e) { toast("Segura o texto pra copiar"); } }

  /* ---------- início ---------- */
  function contagem() {
    var c = { ativo: 0, teste: 0, inadimplente: 0, cancelado: 0, expirado: 0, conta: 0, lead: 0 };
    (D.indicados || []).forEach(function (i) { if (c[i.status] != null) c[i.status]++; });
    return c;
  }
  function grafico() {
    var h = hoje(), cols = [], max = 0;
    for (var k = 5; k >= 0; k--) {
      var d = new Date(h.getFullYear(), h.getMonth() - k, 1, 12), v = soma(doMes(d.getFullYear(), d.getMonth()));
      max = Math.max(max, v); cols.push({ d: d, v: v, atual: k === 0 });
    }
    if (max <= 0) return '<div class="vazio">Seus ganhos de cada mês aparecem aqui assim que entrar a primeira comissão.</div>';
    // rótulo em reais inteiros (R$ 20,81 → 21): cabe em cima da barra até no celular pequeno
    return '<div class="graf">' + cols.map(function (c) {
      return '<div class="c' + (c.atual ? " atual" : "") + '"><em>' + (c.v > 0 ? Math.round(c.v) : "") + '</em><i style="height:' + Math.max(2, Math.round(c.v / max * 100)) + '%"></i><span>' + esc(mesNome(c.d)) + '</span></div>';
    }).join("") + '</div>';
  }
  function nivelHTML() {
    var n = D.nivel, nv = n.niveis || [], idx = Math.max(0, nv.findIndex(function (x) { return x.slug === n.atual; }));
    var trilha = nv.map(function (x, i) {
      var prox = nv[i + 1], pct = i < idx ? 100 : i > idx ? 0 : (prox ? Math.min(100, Math.round((n.vp - x.vp_min) / Math.max(1, prox.vp_min - x.vp_min) * 100)) : 100);
      return '<div><i style="width:' + pct + '%"></i></div>';
    }).join("");
    return '<div class="bloco niv">' +
      '<div class="top"><b>Vant ' + esc(n.atual_nome) + '</b><span>' + n.vp + ' ' + (n.vp === 1 ? "cliente ativo" : "clientes ativos") + '</span></div>' +
      '<div class="trilha">' + trilha + '</div>' +
      '<div class="trilha-nomes">' + nv.map(function (x) { return '<span class="' + (x.slug === n.atual ? "on" : "") + '">' + esc(x.nome) + '</span>'; }).join("") + '</div>' +
      '<p>' + (n.proximo ? "Faltam <b>" + n.faltam + "</b> " + (n.faltam === 1 ? "cliente ativo" : "clientes ativos") + " pra virar " + esc(n.proximo_nome) + "." : "Você está no nível mais alto. Mantenha a carteira ativa.") + '</p></div>';
  }
  function renderInicio() {
    var c = contagem(), f = D.financeiro, total = 0, segs = ["ativo", "teste", "inadimplente", "cancelado"];
    var saiu = c.cancelado + c.expirado;
    var partes = [["ativo", c.ativo], ["teste", c.teste], ["inadimplente", c.inadimplente], ["cancelado", saiu]];
    partes.forEach(function (p) { total += p[1]; });
    $("p-inicio").innerHTML =
      '<h3>Ganhos por mês <small>em reais</small></h3><div class="bloco">' + grafico() + '</div>' +
      '<h3>Sua carteira <small>' + num(D.carteira.indicados) + ' pessoas pelo seu link</small></h3>' +
      '<div class="bloco">' +
      (total ? '<div class="seg">' + partes.filter(function (p) { return p[1] > 0; }).map(function (p) { return '<i style="flex:' + p[1] + ';background:' + STATUS[p[0]].cor + '"></i>'; }).join("") + '</div>' : '') +
      '<div class="leg">' + partes.map(function (p) { return '<div><span class="pt" style="background:' + STATUS[p[0]].cor + '"></span>' + (p[0] === "cancelado" ? "Saíram" : STATUS[p[0]].nome) + '<b>' + p[1] + '</b></div>'; }).join("") + '</div>' +
      '<div class="renda"><b class="n">' + brl(f.renda_recorrente) + '</b><span>por mês só com quem já é cliente hoje. Cada cliente ativo a mais soma na sua renda todo mês.</span></div>' +
      '</div>' +
      '<h3>Seu nível</h3>' + nivelHTML() +
      (segs && c.teste > 0 ? '<p class="nota">' + c.teste + (c.teste === 1 ? " pessoa está" : " pessoas estão") + ' testando a Vant agora. Uma mensagem sua lembrando de assinar costuma virar comissão.</p>' : '');
  }

  /* ---------- clientes ---------- */
  function renderClientes() {
    var c = contagem(), fu = D.funil;
    var filtros = [["ativo", "Ativos", c.ativo], ["teste", "Em teste", c.teste], ["inadimplente", "Atrasados", c.inadimplente], ["saiu", "Saíram", c.cancelado + c.expirado], ["cadastro", "Só cadastro", c.conta + c.lead], ["todos", "Todos", (D.indicados || []).length]];
    var lista = (D.indicados || []).filter(function (i) {
      return FILTRO === "todos" || i.status === FILTRO || (FILTRO === "saiu" && (i.status === "cancelado" || i.status === "expirado")) || (FILTRO === "cadastro" && (i.status === "conta" || i.status === "lead"));
    });
    var vis = lista.slice(0, LIMITE);
    var maxF = Math.max(1, fu.cadastros || 0, fu.cliques || 0);
    var linhaF = function (k, v) { return '<div class="f"><span>' + k + '</span><div><i style="width:' + Math.round((v || 0) / maxF * 100) + '%"></i></div><b>' + num(v) + '</b></div>'; };
    $("p-clientes").innerHTML =
      '<h3>Quem entrou pelo seu link</h3>' +
      '<div class="filtros">' + filtros.map(function (f) { return '<button type="button" class="chip" data-f="' + f[0] + '" aria-pressed="' + (FILTRO === f[0]) + '">' + f[1] + '<b>' + f[2] + '</b></button>'; }).join("") + '</div>' +
      '<div class="lista">' + (vis.length ? vis.map(function (i) {
        var s = STATUS[i.status] || { nome: i.status }, ini = esc((i.nome || "?").trim().charAt(0).toUpperCase());
        var det = [i.entrada ? "entrou " + i.entrada : "", i.plano || "", i.renovacoes ? i.renovacoes + (i.renovacoes === 1 ? " renovação" : " renovações") : ""].filter(Boolean).join(", ");
        return '<div class="li"><span class="ini">' + ini + '</span><div class="nm"><b>' + esc(i.nome) + '</b><span>' + esc(det) + '</span></div><span class="st ' + esc(i.status) + '">' + esc(s.nome) + '</span></div>';
      }).join("") + (lista.length > LIMITE ? '<button type="button" class="mais" id="btMaisLista">Ver mais ' + Math.min(20, lista.length - LIMITE) + ' de ' + (lista.length - LIMITE) + '</button>' : '')
        : '<div class="vazio">' + (FILTRO === "ativo" ? "Ninguém ativo ainda. Manda seu link pra quem vende na rua!" : "Ninguém aqui.") + '</div>') + '</div>' +
      '<h3>Do clique à assinatura</h3>' +
      '<div class="bloco funil">' +
      (fu.cliques ? linhaF("Clicaram no link", fu.cliques) : "") +
      linhaF("Se cadastraram", fu.cadastros) + linhaF("Criaram conta", fu.contas) + linhaF("Testaram o app", fu.testes) +
      linhaF("Assinaram", fu.assinaram) + linhaF("Continuam ativos", fu.ativos) +
      '</div>' +
      (fu.cliques ? '' : '<p class="nota">Os cliques no link começaram a ser contados há pouco. Cadastros anteriores continuam valendo.</p>');
    $("p-clientes").querySelectorAll("[data-f]").forEach(function (b) { b.onclick = function () { FILTRO = b.dataset.f; LIMITE = 20; renderClientes(); }; });
    var bm = $("btMaisLista"); if (bm) bm.onclick = function () { LIMITE += 20; renderClientes(); };
  }

  /* ---------- ganhos ---------- */
  function renderGanhos() {
    var p = D.pagamentos, f = D.financeiro, lista = D.cobrancas || [];
    var tipoNome = { nova: "nova", renovacao: "renovação", upgrade: "upgrade", downgrade: "downgrade", reembolso: "reembolso", estorno: "estorno" };
    var stNome = { pendente: "pendente", confirmada: "confirmada", paga: "paga", cancelada: "cancelada" };
    var grupos = {}, ordem = [];
    lista.forEach(function (c) {
      var d = dt(c.data), k = d ? d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") : "sem";
      if (!grupos[k]) { grupos[k] = { d: d, itens: [] }; ordem.push(k); }
      grupos[k].itens.push(c);
    });
    $("p-ganhos").innerHTML =
      '<h3>Pagamentos</h3>' +
      '<div class="cards2">' +
      '<div class="k2"><span>Próximo pagamento</span><b>' + esc(p.proxima_data) + '</b><em>' + brl(p.valor_previsto) + ' por ' + esc(p.forma) + '</em></div>' +
      '<div class="k2"><span>Já recebido</span><b>' + brl(f.total_recebido) + '</b><em>' + (p.ultimo ? "último em " + esc(p.ultimo.data) : "nenhum pagamento ainda") + '</em></div>' +
      '</div>' +
      '<p class="nota">' + (p.pix ? "Pix cadastrado: " + esc(p.pix) + "." : "Você ainda não cadastrou sua chave Pix. Manda ela pro time da Vant pra receber no dia " + esc(D.regras.dia_pagamento) + ".") + '</p>' +
      ((p.historico || []).length ? '<div class="lista" style="margin-top:10px">' + p.historico.map(function (h) {
        return '<div class="li"><div class="nm"><b>' + esc(h.data) + '</b><span>' + esc([h.referencia ? "ref. " + h.referencia : "", h.transacao || ""].filter(Boolean).join(", ")) + '</span></div><div class="cv"><b>' + brl(h.valor) + '</b><span>' + esc(h.status) + '</span></div></div>';
      }).join("") + '</div>' : '') +
      '<h3>Comissões</h3>' +
      (ordem.length ? ordem.map(function (k) {
        var g = grupos[k], tot = soma(g.itens.filter(function (c) { return c.status !== "cancelada"; }));
        return '<div class="mesg"><div class="cab"><b>' + (g.d ? esc(mesNome(g.d, true) + " " + g.d.getFullYear()) : "Sem data") + '</b><span>' + brl(tot) + '</span></div><div class="lista">' + g.itens.map(function (c) {
          return '<div class="li"><div class="nm"><b>' + esc(c.cliente) + '<span class="tipo ' + esc(c.tipo) + '">' + esc(tipoNome[c.tipo] || c.tipo) + '</span></b><span>' + esc(c.data.slice(0, 5)) + ', ' + c.pct + '% de ' + brl(c.liquido) + '</span></div>' +
            '<div class="cv"><b style="' + (c.comissao < 0 || c.status === "cancelada" ? "color:var(--bad)" : "") + '">' + brl(c.comissao) + '</b><span>' + esc(stNome[c.status] || c.status) + '</span></div></div>';
        }).join("") + '</div></div>';
      }).join("") : '<div class="bloco vazio">Nenhuma comissão ainda. Ela aparece aqui quando alguém assinar pelo seu link.</div>') +
      '<p class="nota">A comissão é calculada sobre o valor que a Vant recebe depois da taxa da Hotmart. Reembolso, contestação ou cancelamento cancelam a comissão daquela cobrança.</p>';
  }

  /* ---------- regras ---------- */
  function renderRegras() {
    var r = D.regras, n = D.nivel, ic = { primeira_assinatura: "🥇", ativos_5: "🏅", ativos_10: "🏆", ativos_25: "🏆", ativos_50: "👑", ativos_100: "💎", nivel_embaixador: "⭐", nivel_pro: "🌟", nivel_elite: "✨" };
    $("p-regras").innerHTML =
      '<h3>Conquistas</h3>' +
      '<div class="medalhas">' + (D.conquistas || []).map(function (c) {
        return '<div class="md ' + (c.ok ? "ok" : "lock") + '"><div class="ic">' + (c.ok ? (ic[c.tipo] || "🏆") : "🔒") + '</div><b>' + esc(c.nome) + '</b><span>' + (c.ok ? "conquistada" + (c.em ? " em " + esc(c.em.slice(0, 5)) : "") : (c.faltam ? "faltam " + c.faltam : "bloqueada")) + '</span></div>';
      }).join("") + '</div>' +
      ((D.campanhas || []).length ? '<h3>Campanhas</h3>' + D.campanhas.map(function (c) {
        var prog = Math.min(100, Math.round((c.progresso / Math.max(1, c.meta)) * 100));
        return '<div class="bloco camp" style="margin-top:8px"><b>' + esc(c.nome) + '</b><p>' + esc(c.descricao || "") + '</p><p>Até ' + esc(c.fim) + '. Prêmio: <b style="color:var(--gold)">' + esc(c.premio || "—") + '</b></p>' +
          '<div class="trilha" style="grid-template-columns:1fr"><div><i style="width:' + prog + '%"></i></div></div><p class="n">' + c.progresso + ' de ' + c.meta + '</p></div>';
      }).join("") : '') +
      '<h3>Como funciona</h3>' +
      det("Quanto eu ganho", "Na primeira mensalidade de cada cliente que vem pelo seu link você ganha " + r.pct_primeira + "%. Em todas as renovações seguintes, " + r.pct_recorrente + "% enquanto ele continuar pagando. Hoje cada mensalidade rende pra Vant cerca de " + brl(r.liquido_ref) + " depois da taxa da Hotmart, e a comissão é sobre esse valor.") +
      det("Quando a comissão conta", "Ela nasce quando a Hotmart aprova a cobrança" + (r.dias_confirmacao > 0 ? " e é confirmada " + r.dias_confirmacao + " dias depois." : ", já confirmada.") + " Cobrança recusada ou cliente atrasado não geram comissão.") +
      det("Quando eu recebo", "Todo dia " + r.dia_pagamento + ", por Pix, se o saldo confirmado passar de " + brl(r.saldo_minimo) + ". Abaixo disso, o valor junta com o mês seguinte.") +
      det("Reembolso e cancelamento", "Se a cobrança for reembolsada, contestada ou cancelada, a comissão dela é cancelada. Se já tiver sido paga, o valor sai do próximo pagamento.") +
      det("Níveis", "O nível conta só clientes ativos: " + (n.niveis || []).map(function (x) { return x.nome + " a partir de " + x.vp_min; }).join(", ") + ". Quem cancela ou atrasa deixa de contar. " + (n.progressao_ativa ? "Subir de nível aumenta seu percentual nas renovações." : "Por enquanto o nível é reconhecimento e não muda a comissão.")) +
      det("Campanhas", "Prêmios extras são campanhas com prazo, regra e meta próprios. Não fazem parte da comissão de sempre.") +
      det("O que cancela tudo", "Indicar a si mesmo, cadastro falso, cartão de outra pessoa ou qualquer tentativa de enganar o sistema cancela as comissões envolvidas e pode bloquear o seu painel.") +
      det("Mudanças no programa", "A Vant pode mudar percentuais e regras para novos parceiros e novas campanhas. Comissão já confirmada não muda: cada cobrança guarda a regra do dia em que entrou.");
  }
  function det(t, b) { return '<details class="r"><summary>' + esc(t) + '</summary><p>' + esc(b) + '</p></details>'; }

  /* ================= abas ================= */
  document.querySelectorAll(".aba").forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll(".aba").forEach(function (x) { x.setAttribute("aria-selected", x === b); });
      ["inicio", "clientes", "ganhos", "regras"].forEach(function (k) { $("p-" + k).hidden = k !== b.dataset.tab; });
      var top = document.querySelector(".abas").offsetTop;
      if (window.scrollY > top) window.scrollTo({ top: top });
    };
  });
})();
