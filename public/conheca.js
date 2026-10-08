/* /conheca/CODIGO → página do convite do parceiro (Vant, 08/10/2026).
   Os botões passam por /r/CODIGO: lá o clique é contado (parc_clique) e o app
   abre com o cupom guardado, igual ao link do app. "Já tenho conta" leva o
   cupom junto. Sem código (ou código estranho) a página funciona normal. */
(function () {
  var m = /^\/conheca\/([A-Za-z0-9_-]{2,40})\/?$/.exec(location.pathname);
  var q = new URLSearchParams(location.search);
  var code = ((m && m[1]) || q.get("ref") || q.get("cupom") || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (!code) return;
  var testar = "/r/" + encodeURIComponent(code.toLowerCase());
  ["cta1", "cta2"].forEach(function (id) { var a = document.getElementById(id); if (a) a.href = testar; });
  var entrar = document.getElementById("entrar");
  if (entrar) entrar.href = "/auth?cupom=" + encodeURIComponent(code);
  var c = document.getElementById("codigo"), box = document.getElementById("convite");
  if (c && box) { c.textContent = code; box.hidden = false; }
})();
