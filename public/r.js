/* /r/CODIGO → registra o clique do link do afiliado e manda pro app com o cupom.
   Se o banco não responder em 1,5 s, redireciona do mesmo jeito (o clique é
   estatística; a atribuição de verdade acontece no cadastro/checkout). */
(function () {
  var SB = "https://qbcsjsdwjjpybvzbxszi.supabase.co";
  var KEY = "sb_publishable_QHFeQuWwHWFOl_0dIbiB4A_6QQCmPyy";
  var m = /^\/r\/([A-Za-z0-9_-]{2,40})/.exec(location.pathname);
  var code = m ? m[1].toUpperCase() : "";
  var destino = code ? "/?cupom=" + encodeURIComponent(code) : "/";
  var alt = document.getElementById("alt"); if (alt) alt.href = destino;
  var foi = false;
  function ir(url) { if (foi) return; foi = true; location.replace(url || destino); }
  if (!code) { ir(); return; }
  var t = setTimeout(function () { ir(); }, 1500);
  try {
    fetch(SB + "/rest/v1/rpc/parc_clique", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": KEY, "Authorization": "Bearer " + KEY },
      body: JSON.stringify({ p_code: code, p_ua: navigator.userAgent || "" }),
      keepalive: true
    }).then(function (r) { return r.json(); })
      .then(function (j) { clearTimeout(t); ir(j && j.ok && j.destino ? j.destino : destino); })
      .catch(function () { clearTimeout(t); ir(); });
  } catch (e) { clearTimeout(t); ir(); }
})();
