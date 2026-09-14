import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Orbis — Central de Bugs</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
:root{--ouro:#C9A84C;--ouro-claro:#F5D78E;--surface:#0A0A0A;--surface2:#111111;--card:#0A0010;--branco:#FFFFFF;--cinza:#888888;--cinza-claro:#AAAAAA;--border:rgba(201,168,76,0.15);--border-forte:rgba(201,168,76,0.35);--verde:#10B981;--roxo:#A855F7;--alerta:#E84A4A;--ambar:#F59E0B;--grafite:#6B7280;}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--surface);color:var(--branco);font-family:'DM Sans',sans-serif;line-height:1.6;min-height:100vh;position:relative;overflow-x:hidden;}
#bg-particles{position:fixed;inset:0;z-index:0;pointer-events:none;}
.glow-top{position:fixed;top:0;left:0;right:0;height:420px;z-index:0;pointer-events:none;background:radial-gradient(ellipse at 50% -10%, #1A0533 0%, rgba(26,5,51,0.35) 40%, transparent 72%);}
.wrap{position:relative;z-index:1;max-width:860px;margin:0 auto;padding:0 20px 100px;}
header{text-align:center;padding:56px 0 30px;}
.logo{font-family:'Bebas Neue',sans-serif;font-size:64px;letter-spacing:14px;background:linear-gradient(135deg,var(--ouro),var(--ouro-claro));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;margin-left:14px;}
.subtitulo{font-size:12px;color:var(--cinza);letter-spacing:4px;text-transform:uppercase;margin-top:6px;}
.frase{font-size:13px;color:#555;margin-top:10px;}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:8px 0 26px;}
.stat{background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:16px 14px;text-align:center;}
.stat-num{font-family:'Bebas Neue',sans-serif;font-size:36px;line-height:1;letter-spacing:1px;}
.stat-label{font-size:10px;color:var(--cinza);letter-spacing:2px;text-transform:uppercase;margin-top:6px;}
.stat.abertos .stat-num{color:var(--ouro-claro)}.stat.andamento .stat-num{color:var(--roxo)}.stat.resolvidos .stat-num{color:var(--verde)}.stat.criticos .stat-num{color:var(--alerta)}
.toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:20px;}
.btn-novo{display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:14px;letter-spacing:.5px;color:#1A0500;background:linear-gradient(135deg,var(--ouro),var(--ouro-claro));border:none;border-radius:12px;padding:13px 22px;cursor:pointer;animation:pg 3.2s ease-in-out infinite;}
@keyframes pg{0%,100%{filter:drop-shadow(0 0 14px rgba(201,168,76,0.30))}50%{filter:drop-shadow(0 0 34px rgba(201,168,76,0.60))}}
.search{flex:1;min-width:180px;display:flex;align-items:center;gap:10px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:0 14px;}
.search input{flex:1;background:transparent;border:none;outline:none;color:var(--branco);font-family:'DM Sans',sans-serif;font-size:14px;padding:12px 0;}
.search input::placeholder{color:#555}.search svg{flex-shrink:0;opacity:.5}
.filtros{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px;align-items:center;}
.chip{font-size:12px;letter-spacing:.5px;color:var(--cinza-claro);background:transparent;border:1px solid var(--border);border-radius:999px;padding:8px 15px;cursor:pointer;font-family:'DM Sans',sans-serif;}
.chip.ativo{background:rgba(201,168,76,0.12);border-color:var(--ouro);color:var(--ouro-claro);font-weight:600}
.sync{margin-left:auto;font-size:11px;color:#555;display:inline-flex;align-items:center;gap:6px;}
.sync .dot{width:7px;height:7px;border-radius:50%;background:var(--verde);box-shadow:0 0 8px var(--verde);animation:bl 2s ease-in-out infinite;}
@keyframes bl{0%,100%{opacity:1}50%{opacity:.3}}
.lista{display:flex;flex-direction:column;gap:14px;}
.bug{background:var(--surface2);border:1px solid rgba(255,255,255,0.06);border-left:3px solid var(--grafite);border-radius:14px;padding:20px 22px;}
.bug.sev-critico{border-left-color:var(--alerta)}.bug.sev-alto{border-left-color:var(--ambar)}.bug.sev-medio{border-left-color:var(--ouro)}.bug.sev-baixo{border-left-color:var(--grafite)}
.bug.resolvido{opacity:.6}.bug.resolvido .bug-titulo{text-decoration:line-through;}
.bug-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:8px;}
.bug-titulo{font-size:16px;font-weight:700;color:var(--branco);line-height:1.35;}
.badges{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;}
.badge{font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:700;padding:4px 9px;border-radius:999px;white-space:nowrap;}
.badge.st-aberto{color:var(--ouro-claro);background:rgba(201,168,76,0.12);border:1px solid var(--border-forte)}
.badge.st-andamento{color:var(--roxo);background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.4)}
.badge.st-resolvido{color:var(--verde);background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.4)}
.badge.sv-critico{color:var(--alerta);background:rgba(232,74,74,0.12);border:1px solid rgba(232,74,74,0.4)}
.badge.sv-alto{color:var(--ambar);background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4)}
.badge.sv-medio{color:var(--ouro);background:rgba(201,168,76,0.12);border:1px solid var(--border-forte)}
.badge.sv-baixo{color:var(--cinza-claro);background:rgba(107,114,128,0.15);border:1px solid rgba(107,114,128,0.4)}
.bug-desc{font-size:14px;color:var(--cinza-claro);line-height:1.65;white-space:pre-wrap;word-break:break-word;}
.bug-meta{display:flex;flex-wrap:wrap;gap:14px;margin-top:14px;font-size:12px;color:var(--cinza);}
.bug-meta .m{display:inline-flex;align-items:center;gap:6px;}.bug-meta .m strong{color:var(--cinza-claro);font-weight:600}.bug-meta svg{opacity:.55}
.ia{margin-top:16px;border:1px solid rgba(168,85,247,0.25);border-radius:12px;background:linear-gradient(135deg, rgba(168,85,247,0.06), rgba(201,168,76,0.03));padding:16px 18px;}
.ia-head{display:flex;align-items:center;gap:9px;margin-bottom:12px;}
.ia-orb{width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 35% 30%, var(--ouro-claro), var(--ouro) 45%, #4a3410 100%);box-shadow:0 0 12px rgba(201,168,76,0.6);flex-shrink:0;}
.ia-orb.girando{animation:sp 1.1s linear infinite;}
@keyframes sp{to{transform:rotate(360deg)}}
.ia-label{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--ouro);font-weight:700;}
.ia-bloco{margin-bottom:11px;}.ia-bloco:last-child{margin-bottom:0}
.ia-titulo{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--roxo);font-weight:700;margin-bottom:3px;}
.ia-texto{font-size:13.5px;color:var(--cinza-claro);line-height:1.6;white-space:pre-wrap;}
.ia-pendente{font-size:13px;color:var(--cinza);font-style:italic;}
.ia-reaval{margin-top:10px;font-size:12px;color:var(--ambar);}
.bug-acoes{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;padding-top:14px;border-top:0.5px solid rgba(255,255,255,0.05);}
.acao{font-size:12px;font-weight:600;letter-spacing:.3px;font-family:'DM Sans',sans-serif;background:transparent;border:1px solid var(--border);color:var(--cinza-claro);border-radius:9px;padding:8px 13px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;}
.acao.excluir{margin-left:auto}
.vazio{text-align:center;padding:70px 20px;color:var(--cinza);}
.vazio .orb{width:74px;height:74px;margin:0 auto 22px;border-radius:50%;background:radial-gradient(circle at 35% 30%, var(--ouro-claro), var(--ouro) 45%, #4a3410 100%);box-shadow:0 0 40px rgba(201,168,76,0.35);}
.vazio-titulo{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:2px;color:var(--branco);margin-bottom:6px;}
.vazio-texto{font-size:14px;color:var(--cinza);max-width:340px;margin:0 auto;}
.overlay{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,0.72);display:none;align-items:flex-end;justify-content:center;}
.overlay.aberto{display:flex}
.modal{width:100%;max-width:560px;background:var(--card);border:1px solid var(--border);border-radius:20px 20px 0 0;padding:28px 26px 34px;max-height:92vh;overflow-y:auto;}
.modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.modal-titulo{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:2px;background:linear-gradient(135deg,var(--ouro),var(--ouro-claro));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.fechar{background:transparent;border:none;color:var(--cinza);cursor:pointer;padding:6px;line-height:0;}
.modal-sub{font-size:13px;color:var(--cinza);margin-bottom:22px;}
.campo{margin-bottom:18px;}
.campo label{display:block;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--ouro);margin-bottom:9px;font-weight:600;}
.campo input[type=text], .campo textarea{width:100%;background:#000;border:1px solid var(--border);border-radius:11px;padding:13px 15px;color:var(--branco);font-family:'DM Sans',sans-serif;font-size:14px;outline:none;}
.campo input:focus, .campo textarea:focus{border-color:var(--ouro)}
.campo input::placeholder, .campo textarea::placeholder{color:#555}
.campo textarea{resize:vertical;min-height:96px;line-height:1.6;}
.sev-opcoes{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.sev-op{text-align:center;font-size:12px;font-weight:600;border:1px solid var(--border);border-radius:11px;padding:11px 6px;cursor:pointer;color:var(--cinza-claro);background:transparent;font-family:'DM Sans',sans-serif;}
.sev-op[data-sev=critico].on{border-color:var(--alerta);color:var(--alerta);background:rgba(232,74,74,0.1)}
.sev-op[data-sev=alto].on{border-color:var(--ambar);color:var(--ambar);background:rgba(245,158,11,0.1)}
.sev-op[data-sev=medio].on{border-color:var(--ouro);color:var(--ouro-claro);background:rgba(201,168,76,0.1)}
.sev-op[data-sev=baixo].on{border-color:var(--grafite);color:var(--cinza-claro);background:rgba(107,114,128,0.15)}
.erro{color:var(--alerta);font-size:12px;margin-top:-8px;margin-bottom:14px;display:none;}.erro.show{display:block}
.btn-enviar{width:100%;font-weight:700;font-size:15px;color:#1A0500;background:linear-gradient(135deg,var(--ouro),var(--ouro-claro));border:none;border-radius:12px;padding:15px;cursor:pointer;margin-top:6px;font-family:'DM Sans',sans-serif;}
.btn-enviar:disabled{opacity:.6}
.nota{font-size:11px;color:#555;text-align:center;margin-top:34px;padding:0 20px;line-height:1.6;}.nota b{color:var(--cinza-claro)}
.loading{text-align:center;padding:60px 0;color:var(--cinza);font-size:14px;}
@media (max-width:640px){.logo{font-size:48px;letter-spacing:9px}.stats{grid-template-columns:repeat(2,1fr)}.btn-novo{flex:1;justify-content:center}.sev-opcoes{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<canvas id="bg-particles"></canvas>
<div class="glow-top"></div>
<div class="wrap">
<header><div class="logo">ORBIS</div><div class="subtitulo">Central de Bugs</div><div class="frase">Achou algo quebrado? Anota aqui. A IA analisa. A gente conserta.</div></header>
<div class="stats">
<div class="stat abertos"><div class="stat-num" id="s-abertos">0</div><div class="stat-label">Abertos</div></div>
<div class="stat andamento"><div class="stat-num" id="s-andamento">0</div><div class="stat-label">Em andamento</div></div>
<div class="stat resolvidos"><div class="stat-num" id="s-resolvidos">0</div><div class="stat-label">Resolvidos</div></div>
<div class="stat criticos"><div class="stat-num" id="s-criticos">0</div><div class="stat-label">Críticos abertos</div></div>
</div>
<div class="toolbar">
<button class="btn-novo" id="b-novo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Reportar bug</button>
<div class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input type="text" id="busca" placeholder="Buscar bug..."></div>
</div>
<div class="filtros" id="filtros">
<button class="chip ativo" data-f="todos">Todos</button>
<button class="chip" data-f="aberto">Abertos</button>
<button class="chip" data-f="andamento">Em andamento</button>
<button class="chip" data-f="resolvido">Resolvidos</button>
<button class="chip" data-f="critico">Só críticos</button>
<span class="sync"><span class="dot"></span> ao vivo</span>
</div>
<div id="conteudo"><div class="loading">Carregando bugs...</div></div>
<div class="nota">Painel ligado ao banco do <b>Orbis</b>. Todo mundo com este link vê a mesma lista viva. Cada bug é analisado pela IA.</div>
</div>
<div class="overlay" id="overlay">
<div class="modal">
<div class="modal-head"><div class="modal-titulo">NOVO BUG</div><button class="fechar" id="b-fechar"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
<div class="modal-sub">Descreve o que aconteceu. Quanto mais detalhe, melhor a IA resolve.</div>
<div class="campo"><label for="f-titulo">O bug em uma frase</label><input type="text" id="f-titulo" placeholder="Ex: botão de registrar venda não abre no iPhone"></div>
<div class="erro" id="e-titulo">Escreve pelo menos o título do bug.</div>
<div class="campo"><label for="f-desc">O que aconteceu (passo a passo)</label><textarea id="f-desc" placeholder="O que você fez, o que esperava e o que aconteceu de errado."></textarea></div>
<div class="campo"><label for="f-tela">Onde acontece</label><input type="text" id="f-tela" placeholder="Ex: DEFCON 4, Ranking, tela de login..."></div>
<div class="campo"><label>Gravidade</label><div class="sev-opcoes" id="sev-opcoes"><button class="sev-op" data-sev="critico">Crítico</button><button class="sev-op on" data-sev="alto">Alto</button><button class="sev-op" data-sev="medio">Médio</button><button class="sev-op" data-sev="baixo">Baixo</button></div></div>
<div class="campo"><label for="f-nome">Seu nome</label><input type="text" id="f-nome" placeholder="Quem tá reportando?"></div>
<button class="btn-enviar" id="b-enviar">Enviar bug</button>
</div>
</div>
<script>
var SB_URL="https://qbcsjsdwjjpybvzbxszi.supabase.co";
var SB_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiY3Nqc2R3ampweWJ2emJ4c3ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NzMyNDAsImV4cCI6MjA5NzE0OTI0MH0.vKeJ-H6FivdTbgKppX0HoSD4vm3moIUbBwm5Aq8Etik";
var REST=SB_URL+"/rest/v1/orbis_bugs";var FN=SB_URL+"/functions/v1/analisar-bug";
var H={"apikey":SB_ANON,"Authorization":"Bearer "+SB_ANON,"Content-Type":"application/json"};
var bugs=[],filtro="todos",sevSel="alto",enviando=false;
var SEV_ORDEM={critico:0,alto:1,medio:2,baixo:3};
var SEV_LABEL={critico:"Crítico",alto:"Alto",medio:"Médio",baixo:"Baixo"};
var ST_LABEL={aberto:"Aberto",andamento:"Em andamento",resolvido:"Resolvido"};
var $=function(id){return document.getElementById(id)};
function carregar(){
  fetch(REST+"?select=*&order=criado_em.desc",{headers:H}).then(function(r){return r.json()}).then(function(d){bugs=d;render();}).catch(function(){$("conteudo").innerHTML='<div class="vazio"><div class="vazio-titulo" style="font-size:20px">NÃO CONSEGUI CARREGAR</div><div class="vazio-texto">Recarrega a página.</div></div>';});
}
function salvarBug(){
  if(enviando)return;
  var titulo=$("f-titulo").value.trim();
  if(!titulo){$("e-titulo").classList.add("show");return;}
  enviando=true;var btn=$("b-enviar");btn.disabled=true;btn.textContent="Enviando...";
  var novo={titulo:titulo,descricao:$("f-desc").value.trim(),tela:$("f-tela").value.trim(),severidade:sevSel,reporter:($("f-nome").value.trim()||"Anônimo"),status:"aberto",ai_status:"analisando"};
  fetch(REST,{method:"POST",headers:Object.assign({},H,{"Prefer":"return=representation"}),body:JSON.stringify(novo)}).then(function(r){return r.json()}).then(function(a){
    var criado=a[0];try{localStorage.setItem("orbis_reporter",novo.reporter)}catch(e){}
    $("f-titulo").value="";$("f-desc").value="";$("f-tela").value="";selSev("alto");fecharModal();
    bugs.unshift(criado);render();analisar(criado.id);
  }).catch(function(){alert("Não consegui salvar. Tenta de novo.");}).finally(function(){enviando=false;btn.disabled=false;btn.textContent="Enviar bug";});
}
function analisar(id){
  var b=bugs.find(function(x){return x.id===id});if(b){b.ai_status="analisando";b.ai_erro=null;render();}
  fetch(FN,{method:"POST",headers:H,body:JSON.stringify({id:id})}).then(function(r){return r.json().catch(function(){return{}})}).then(function(){esperar(id);}).catch(function(){var bb=bugs.find(function(x){return x.id===id});if(bb){bb.ai_status="erro";bb.ai_erro="Falha ao chamar a IA.";render();}});
}
function esperar(id){
  var n=0;var t=setInterval(function(){n++;fetch(REST+"?id=eq."+id+"&select=*",{headers:H}).then(function(r){return r.json()}).then(function(a){if(a&&a[0]){var k=bugs.findIndex(function(x){return x.id===id});if(k>=0)bugs[k]=a[0];render();if(a[0].ai_status==="pronto"||a[0].ai_status==="erro"||n>=8){clearInterval(t);}}}).catch(function(){});},2500);
}
function mudarStatus(id,novo){
  var b=bugs.find(function(x){return x.id===id});if(!b)return;var antes=b.status;b.status=novo;render();
  fetch(REST+"?id=eq."+id,{method:"PATCH",headers:H,body:JSON.stringify({status:novo})}).then(function(r){if(!r.ok)throw 0;}).catch(function(){b.status=antes;render();});
}
function excluir(id){
  if(!confirm("Excluir este bug? Não dá pra desfazer."))return;
  var bkp=bugs.slice();bugs=bugs.filter(function(x){return x.id!==id});render();
  fetch(REST+"?id=eq."+id,{method:"DELETE",headers:H}).then(function(r){if(!r.ok)throw 0;}).catch(function(){bugs=bkp;render();});
}
function abrirModal(){$("overlay").classList.add("aberto");$("f-titulo").focus();}
function fecharModal(){$("overlay").classList.remove("aberto");$("e-titulo").classList.remove("show");}
function selSev(s){sevSel=s;var els=document.querySelectorAll(".sev-op");for(var i=0;i<els.length;i++){els[i].classList.toggle("on",els[i].getAttribute("data-sev")===s);}}
function tempoAtras(iso){var ts=new Date(iso).getTime();var s=Math.floor((Date.now()-ts)/1000);if(s<60)return"agora";var m=Math.floor(s/60);if(m<60)return m+" min atrás";var h=Math.floor(m/60);if(h<24)return h+"h atrás";var d=Math.floor(h/24);if(d===1)return"ontem";if(d<30)return d+" dias atrás";return new Date(ts).toLocaleDateString("pt-BR");}
function esc(t){var d=document.createElement("div");d.textContent=(t==null?"":t);return d.innerHTML;}
function blocoIA(b){
  if(b.ai_status==="analisando")return '<div class="ia"><div class="ia-head"><div class="ia-orb girando"></div><div class="ia-label">IA analisando...</div></div><div class="ia-pendente">A IA tá lendo o bug. Já já aparece aqui.</div></div>';
  if(b.ai_status==="pronto"){var rv=(b.ai_severidade&&b.ai_severidade!==b.severidade)?'<div class="ia-reaval">A IA reavaliou a gravidade para: '+(SEV_LABEL[b.ai_severidade]||esc(b.ai_severidade))+'</div>':'';return '<div class="ia"><div class="ia-head"><div class="ia-orb"></div><div class="ia-label">Análise da IA</div></div>'+(b.ai_diagnostico?'<div class="ia-bloco"><div class="ia-titulo">Diagnóstico</div><div class="ia-texto">'+esc(b.ai_diagnostico)+'</div></div>':'')+(b.ai_causa?'<div class="ia-bloco"><div class="ia-titulo">Causa provável</div><div class="ia-texto">'+esc(b.ai_causa)+'</div></div>':'')+(b.ai_correcao?'<div class="ia-bloco"><div class="ia-titulo">Como corrigir</div><div class="ia-texto">'+esc(b.ai_correcao)+'</div></div>':'')+rv+'</div>';}
  if(b.ai_status==="erro")return '<div class="ia"><div class="ia-head"><div class="ia-orb"></div><div class="ia-label" style="color:var(--alerta)">IA não conseguiu analisar</div></div><div class="ia-pendente">'+esc(b.ai_erro||"Erro.")+'</div></div>';
  return '<div class="ia"><div class="ia-head"><div class="ia-orb"></div><div class="ia-label">Análise da IA</div></div><div class="ia-pendente">Ainda não analisado. Toca em Analisar com a IA.</div></div>';
}
function render(){
  var abertos=0,andamento=0,resolvidos=0,criticos=0;
  bugs.forEach(function(b){if(b.status==="aberto")abertos++;if(b.status==="andamento")andamento++;if(b.status==="resolvido")resolvidos++;if(b.status!=="resolvido"&&b.severidade==="critico")criticos++;});
  $("s-abertos").textContent=abertos;$("s-andamento").textContent=andamento;$("s-resolvidos").textContent=resolvidos;$("s-criticos").textContent=criticos;
  var busca=($("busca").value||"").toLowerCase();
  var lista=bugs.filter(function(b){if(filtro==="critico"){if(b.severidade!=="critico"||b.status==="resolvido")return false;}else if(filtro!=="todos"){if(b.status!==filtro)return false;}if(busca){var a=((b.titulo||"")+" "+(b.descricao||"")+" "+(b.tela||"")+" "+(b.reporter||"")).toLowerCase();if(a.indexOf(busca)<0)return false;}return true;});
  lista.sort(function(a,b){var ra=a.status==="resolvido"?1:0,rb=b.status==="resolvido"?1:0;if(ra!==rb)return ra-rb;if(SEV_ORDEM[a.severidade]!==SEV_ORDEM[b.severidade])return SEV_ORDEM[a.severidade]-SEV_ORDEM[b.severidade];return new Date(b.criado_em)-new Date(a.criado_em);});
  var cont=$("conteudo");
  if(bugs.length===0){cont.innerHTML='<div class="vazio"><div class="orb"></div><div class="vazio-titulo">TUDO LIMPO POR AQUI</div><div class="vazio-texto">Nenhum bug reportado ainda. Toca em Reportar bug e anota.</div></div>';return;}
  if(lista.length===0){cont.innerHTML='<div class="vazio"><div class="vazio-titulo" style="font-size:22px">NADA AQUI</div><div class="vazio-texto">Nenhum bug bate com esse filtro.</div></div>';return;}
  var pin='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  var usr='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>';
  var clk='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  var out="";
  lista.forEach(function(b){
    var ac="";
    if(b.status==="aberto")ac+='<button class="acao" data-act="andamento" data-id="'+b.id+'">Começar a resolver</button>';
    if(b.status!=="resolvido")ac+='<button class="acao" data-act="resolvido" data-id="'+b.id+'">Marcar resolvido</button>';
    if(b.status==="resolvido")ac+='<button class="acao" data-act="aberto" data-id="'+b.id+'">Reabrir</button>';
    if(b.status==="andamento")ac+='<button class="acao" data-act="aberto" data-id="'+b.id+'">Voltar p/ aberto</button>';
    if(b.ai_status!=="analisando")ac+='<button class="acao" data-act="ia" data-id="'+b.id+'">'+(b.ai_status==="pronto"?"Analisar de novo":"Analisar com a IA")+'</button>';
    ac+='<button class="acao excluir" data-act="excluir" data-id="'+b.id+'" title="Excluir"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>';
    out+='<div class="bug sev-'+esc(b.severidade)+' '+(b.status==="resolvido"?"resolvido":"")+'"><div class="bug-top"><div class="bug-titulo">'+esc(b.titulo)+'</div><div class="badges"><span class="badge sv-'+esc(b.severidade)+'">'+(SEV_LABEL[b.severidade]||esc(b.severidade))+'</span><span class="badge st-'+esc(b.status)+'">'+(ST_LABEL[b.status]||esc(b.status))+'</span></div></div>'+(b.descricao?'<div class="bug-desc">'+esc(b.descricao)+'</div>':'')+'<div class="bug-meta">'+(b.tela?'<span class="m">'+pin+'<strong>'+esc(b.tela)+'</strong></span>':'')+'<span class="m">'+usr+esc(b.reporter)+'</span><span class="m">'+clk+tempoAtras(b.criado_em)+'</span></div>'+blocoIA(b)+'<div class="bug-acoes">'+ac+'</div></div>';
  });
  cont.innerHTML='<div class="lista">'+out+'</div>';
}
$("b-novo").addEventListener("click",abrirModal);
$("b-fechar").addEventListener("click",fecharModal);
$("b-enviar").addEventListener("click",salvarBug);
$("busca").addEventListener("input",render);
$("overlay").addEventListener("click",function(e){if(e.target.id==="overlay")fecharModal();});
$("sev-opcoes").addEventListener("click",function(e){var t=e.target.closest("[data-sev]");if(t)selSev(t.getAttribute("data-sev"));});
$("filtros").addEventListener("click",function(e){var t=e.target.closest("[data-f]");if(!t)return;filtro=t.getAttribute("data-f");var cs=document.querySelectorAll(".chip");for(var i=0;i<cs.length;i++)cs[i].classList.remove("ativo");t.classList.add("ativo");render();});
$("conteudo").addEventListener("click",function(e){var btn=e.target.closest("button[data-act]");if(!btn)return;var id=btn.getAttribute("data-id"),act=btn.getAttribute("data-act");if(act==="ia")analisar(id);else if(act==="excluir")excluir(id);else mudarStatus(id,act);});
document.addEventListener("keydown",function(e){if(e.key==="Escape")fecharModal();});
(function(){var c=$("bg-particles"),x=c.getContext("2d"),w,h,p;function rs(){w=c.width=innerWidth;h=c.height=innerHeight;var q=Math.min(64,Math.floor(w*h/24000));p=[];for(var i=0;i<q;i++)p.push({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25,r:Math.random()*1.6+.6,z:Math.random()});}function dr(){x.clearRect(0,0,w,h);for(var i=0;i<p.length;i++){var a=p[i];a.x+=a.vx;a.y+=a.vy;if(a.x<0||a.x>w)a.vx*=-1;if(a.y<0||a.y>h)a.vy*=-1;for(var j=i+1;j<p.length;j++){var b=p[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.sqrt(dx*dx+dy*dy);if(d<120){x.strokeStyle="rgba(201,168,76,"+(0.12*(1-d/120))+")";x.lineWidth=.5;x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke();}}x.beginPath();x.arc(a.x,a.y,a.r,0,Math.PI*2);x.fillStyle="rgba(245,215,142,"+(0.35+a.z*0.4)+")";x.shadowColor="rgba(201,168,76,0.7)";x.shadowBlur=8;x.fill();x.shadowBlur=0;}requestAnimationFrame(dr);}addEventListener("resize",rs);rs();dr();})();
try{var nm=localStorage.getItem("orbis_reporter");if(nm)$("f-nome").value=nm;}catch(e){}
carregar();
setInterval(function(){if(!$("overlay").classList.contains("aberto"))carregar();},15000);
</script>
</body>
</html>
`;
Deno.serve(function(req){
  var h=new Headers();
  h.set("Content-Type","text/html; charset=utf-8");
  h.set("Access-Control-Allow-Origin","*");
  h.set("Cache-Control","no-store");
  if(req.method==="OPTIONS")return new Response("ok",{headers:h});
  return new Response(HTML,{status:200,headers:h});
});
