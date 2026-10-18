/* Pesquisa de satisfação da VANT — uma pergunta por tela, respostas gravadas no banco (pesquisa_enviar).
   Admin/comercial entra pelo rodapé ("equipe VANT") e vê os resultados (pesquisa_listar).
   Tudo fora do HTML por causa da CSP do site (sem script embutido). */
(async () => {
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
function toast(t){const e=$("toast");e.textContent=t;e.dataset.on="1";clearTimeout(e._t);e._t=setTimeout(()=>e.dataset.on="0",2400);}

let sb=null;
try{ const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  sb=createClient("https://qbcsjsdwjjpybvzbxszi.supabase.co","sb_publishable_QHFeQuWwHWFOl_0dIbiB4A_6QQCmPyy"); }
catch(e){ console.error(e); }

/* ================= AS FUNÇÕES DO APP (o que a pessoa pode "usar" ou não) ================= */
const FUNC=[
 {k:"foco",      ic:"🎯", t:"Modo Foco",        s:"DEFCON · meta por hora"},
 {k:"ranking",   ic:"🏆", t:"Ranking",          s:"quem vendeu mais"},
 {k:"relatorio", ic:"📊", t:"Relatório do dia", s:"quanto vendi e lucrei"},
 {k:"financas",  ic:"🏦", t:"Finanças / banco", s:"Pix lido do banco"},
 {k:"ia",        ic:"🤖", t:"VANT IA",          s:"mentor por texto/voz"},
 {k:"estudio",   ic:"🎨", t:"Estúdio de Marca", s:"arte e adesivo com Pix"},
 {k:"x1",        ic:"🥊", t:"X1",               s:"desafio contra outro vendedor"},
 {k:"cacasinal", ic:"📍", t:"Caça-Sinal",       s:"melhores pontos pra vender"},
 {k:"produtos",  ic:"📦", t:"Produtos / custo", s:"quanto custa o que vendo"},
 {k:"cobrar",    ic:"💸", t:"Cobrar cliente",   s:"fiado e cobrança"},
];
const fn=k=>FUNC.find(f=>f.k===k);

/* motivos de não usar — a pergunta que o livro manda fazer: não "quer?", mas "por que não?" */
const MOTIVOS=[
 {k:"nao_sabia",   t:"Não sabia que existia"},
 {k:"nao_entendi", t:"Abri, mas não entendi como usa"},
 {k:"nao_preciso", t:"Não preciso disso no meu corre"},
 {k:"nao_funcionou",t:"Tentei e não funcionou / travou"},
 {k:"demora",      t:"Dá trabalho demais / demora"},
 {k:"outro",       t:"Outro motivo", outro:true},
];
const DESEJOS=[
 {k:"fiado",    ic:"🧾", t:"Lembrete de fiado",      s:"me avisa quem me deve"},
 {k:"estoque",  ic:"📦", t:"Controle de estoque",    s:"quanto sobrou pra amanhã"},
 {k:"recibo",   ic:"🧾", t:"Recibo pro cliente",     s:"comprovante na hora"},
 {k:"comparar", ic:"📈", t:"Comparar semanas",       s:"essa semana × passada"},
 {k:"msgauto",  ic:"💬", t:"Mensagem automática",    s:"pro cliente, sem eu digitar"},
 {k:"previsao", ic:"🔮", t:"Previsão de venda",      s:"quanto vou fazer hoje"},
 {k:"desafios", ic:"🏅", t:"Mais desafios e prêmios",s:"competição com grana"},
 {k:"loja",     ic:"📱", t:"App na Play/App Store",  s:"instalar pela loja"},
 {k:"equipe",   ic:"👥", t:"Versão pra equipe",      s:"vários vendedores juntos"},
 {k:"comunidade",ic:"🫂",t:"Comunidade",             s:"trocar ideia com quem vende"},
 {k:"outro",    ic:"✍️", t:"Outra coisa",            s:"eu escrevo", outro:true},
];

/* ================= AS PERGUNTAS ================= */
/* tipos: single · multi · grid (single/multi com ícone) · emo · escala · texto · contato */
const Q=[
 {id:"tempo", tipo:"single", eyebrow:"Pra começar", t:"Há quanto tempo você usa a VANT?",
  ops:[{k:"teste",t:"Tô testando agora"},{k:"m1",t:"Menos de 1 mês"},{k:"m3",t:"De 1 a 3 meses"},{k:"m3mais",t:"Mais de 3 meses"},{k:"parei",t:"Usei, mas parei",s:"vale muito saber o porquê"}]},
 {id:"freq", tipo:"single", eyebrow:"Rotina", t:"Com que frequência você abre o app?",
  ops:[{k:"todo",t:"Todo dia que eu vendo"},{k:"alguns",t:"Alguns dias por semana"},{k:"vez",t:"De vez em quando"},{k:"quase",t:"Quase nunca"}]},
 {id:"mais_usa", tipo:"grid", eyebrow:"Uso real", t:"Qual função você MAIS usa?", sub:"Só uma — a que você abre primeiro.", ops:FUNC},
 {id:"ja_usou", tipo:"grid", multi:true, eyebrow:"Uso real", t:"E quais você já usou pelo menos uma vez?", sub:"Marque todas. Pode ser só uma.", ops:FUNC, pre:a=>a.mais_usa?[a.mais_usa]:[]},
 {id:"motivo", tipo:"motivos"}, // adaptativa: até 2 funções importantes que a pessoa não usa
 {id:"nao_registrou", tipo:"single", eyebrow:"Sinceridade", t:"Última vez que você vendeu e NÃO registrou na VANT — por quê?",
  ops:[{k:"registro_tudo",t:"Eu registro tudo"},{k:"esqueci",t:"Esqueci"},{k:"corrido",t:"Tava corrido demais na hora"},{k:"sem_vantagem",t:"Não vi vantagem em registrar"},{k:"travou",t:"O app travou / demorou"},{k:"outro",t:"Outro motivo",outro:true}]},
 {id:"pmf", tipo:"emo", eyebrow:"A pergunta que importa", t:"Se a VANT sumisse amanhã, como você ficaria?",
  ops:[{k:"muito",e:"😤",t:"Muito chateado"},{k:"pouco",e:"😕",t:"Um pouco chateado"},{k:"tanto_faz",e:"😐",t:"Tanto faz"},{k:"aliviado",e:"😅",t:"Aliviado"}]},
 {id:"ganho", tipo:"single", eyebrow:"Valor", t:"Qual o maior ganho que a VANT te deu até hoje?",
  ops:[{k:"lucro",t:"Sei quanto lucro de verdade"},{k:"vendo_mais",t:"Vendo mais"},{k:"foco",t:"Mais foco e disciplina"},{k:"dinheiro",t:"Organizei meu dinheiro"},{k:"motivacao",t:"Motivação (ranking, desafios)"},{k:"nada",t:"Nada ainda",s:"tudo bem dizer isso"},{k:"outro",t:"Outro",outro:true}]},
 {id:"irrita", tipo:"texto", eyebrow:"Pode falar mal", t:"O que mais te irrita ou atrapalha no app hoje?", sub:"Sem filtro. É isso que a gente conserta primeiro.", ph:"Ex.: demora pra abrir, não acho a função, o ranking é injusto…", opcional:true},
 {id:"deseja", tipo:"grid", multi:true, max:3, eyebrow:"Futuro", t:"O que você gostaria dentro do app?", sub:"Escolha até <b>3</b>.", ops:DESEJOS},
 {id:"pagaria", tipo:"pagaria"}, // adaptativa: entre as escolhidas, qual pagaria a mais
 {id:"uma_coisa", tipo:"texto", eyebrow:"Varinha mágica", t:"Se pudesse mudar UMA coisa na VANT hoje, qual seria?", ph:"Uma frase basta.", opcional:true, curto:true},
 {id:"nps", tipo:"escala", eyebrow:"Quase lá", t:"De 0 a 10, quanto você indicaria a VANT pra outro vendedor?", min:"Nem pensar", max:"Com certeza", porque:true},
 {id:"contato", tipo:"contato"},
];

/* ================= ESTADO ================= */
const A={};                 // respostas por id
let i=-1;                   // -1 = intro
let USER=null, PERFIL=null; // sessão do app, se houver (mesma origem = mesma sessão)
const origem=new URLSearchParams(location.search).get("o")||"";
const K="vant-pesquisa-v1";
try{const g=JSON.parse(localStorage.getItem(K)||"null"); if(g&&g.A){Object.assign(A,g.A); if(typeof g.i==="number") i=Math.min(g.i,Q.length-1);} }catch(e){}
const salvar=()=>{try{localStorage.setItem(K,JSON.stringify({A,i}));}catch(e){}};

if(sb){ try{ const {data:{session}}=await sb.auth.getSession(); if(session?.user){ USER=session.user;
  const {data}=await sb.from("profiles").select("nickname,phone,what_i_sell").eq("user_id",USER.id).maybeSingle(); PERFIL=data||null; } }catch(e){} }

/* passos "visíveis" (as adaptativas podem não existir) */
function motivosPendentes(){
 if(!A.ja_usou) return [];
 const usou=new Set([...(A.ja_usou||[]), A.mais_usa].filter(Boolean));
 return ["foco","ranking","financas","ia"].filter(k=>!usou.has(k)).slice(0,2);
}
function existe(q){
 if(q.tipo==="motivos") return motivosPendentes().length>0;
 if(q.tipo==="pagaria") return (A.deseja||[]).filter(k=>k!=="outro").length>0;
 return true;
}
const visiveis=()=>Q.filter(existe);
const passoN=()=>visiveis().findIndex(q=>q.id===Q[i]?.id)+1;

/* ================= RENDER ================= */
function render(dir){
 const tela=$("tela");
 const total=visiveis().length, n=i<0?0:passoN();
 $("passo").textContent=i<0?"":i>=Q.length?"":`${n} / ${total}`;
 $("prog").firstElementChild.style.width=(i<0?0:i>=Q.length?100:Math.round(n/total*100))+"%";
 tela.innerHTML=i<0?intro():i>=Q.length?fim():pergunta(Q[i]);
 tela.className=""; void tela.offsetWidth; tela.classList.add("q");
 ligar();
 window.scrollTo({top:0,behavior:"smooth"});
}
function intro(){
 const nome=PERFIL?.nickname?PERFIL.nickname.split(" ")[0]:null;
 return `<div class="hero">
  <img class="masc" src="/vant-mascote.webp" alt="">
  <div class="eyebrow">Pesquisa da VANT</div>
  <h1>${nome?`${esc(nome)}, me conta a real.`:"Me conta a real."}</h1>
  <p class="sub">A gente poderia ficar inventando função nova. Preferimos perguntar <b>o que você usa, o que não usa e por quê</b>. Sua resposta decide o que entra primeiro.</p>
  <div class="chips"><span class="chip"><b>3 min</b></span><span class="chip"><b>${visiveis().length}</b> perguntas</span><span class="chip">pode pular</span><span class="chip">sem resposta errada</span></div>
  <button class="btn go" id="comecar">${Object.keys(A).length?"Continuar de onde parei":"Bora"} →</button>
  ${Object.keys(A).length?`<button class="btn ghost" id="zerar" style="margin-top:6px">Começar do zero</button>`:""}
 </div>`;
}
function fim(){
 return `<div class="hero fim">
  <div class="ok"><svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
  <h1>Valeu. De verdade.</h1>
  <p class="sub">Isso aqui vai direto pra mesa de quem decide o que a VANT constrói. ${A.contato?.pode==="sim"?"Como você topou, alguém da equipe te chama no WhatsApp pra conversar 10 minutos.":""}</p>
  <a class="btn go" href="/" style="text-decoration:none;max-width:280px;margin:0 auto">Voltar pro app</a>
  <div class="avante">Avante</div>
 </div>`;
}
function opt(o,on,icone){
 return `<button type="button" class="opt" data-k="${esc(o.k)}" aria-pressed="${on}">
  ${icone&&o.ic?`<span class="ic">${o.ic}</span>`:""}
  <span class="t">${esc(o.t)}${o.s?`<small>${esc(o.s)}</small>`:""}</span>
  <span class="ck"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.4l2.4 2.4 4.6-5" stroke="#111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
 </button>`;
}
const outroBox=(id,ph)=>`<div class="outro" id="outro-${id}" hidden><input type="text" maxlength="200" data-outro="${id}" placeholder="${esc(ph||"Conta aí…")}" value="${esc(A[id+"_outro"]||"")}"></div>`;
function pergunta(q){
 let corpo="", podeAvancar=false;
 const v=A[q.id];
 if(q.tipo==="single"){
  corpo=`<div class="opts">${q.ops.map(o=>opt(o,v===o.k)).join("")}</div>${outroBox(q.id)}`; podeAvancar=!!v;
 } else if(q.tipo==="grid"){
  const sel=new Set(q.multi?(v||(q.pre?q.pre(A):[])):(v?[v]:[]));
  corpo=`<div class="grid">${q.ops.map(o=>opt(o,sel.has(o.k),true)).join("")}</div>${q.ops.some(o=>o.outro)?outroBox(q.id,"O que seria?"):""}`;
  podeAvancar=sel.size>0;
 } else if(q.tipo==="emo"){
  corpo=`<div class="emos">${q.ops.map(o=>`<button type="button" class="opt" data-k="${o.k}" aria-pressed="${v===o.k}"><span class="e">${o.e}</span><span class="t">${esc(o.t)}</span><span class="ck"></span></button>`).join("")}</div>`;
  podeAvancar=!!v;
 } else if(q.tipo==="escala"){
  corpo=`<div class="escala">${Array.from({length:11},(_,n)=>`<button type="button" data-k="${n}" aria-pressed="${String(v)===String(n)}">${n}</button>`).join("")}</div>
   <div class="escala-lbl"><span>${esc(q.min)}</span><span>${esc(q.max)}</span></div>
   ${q.porque?`<div class="outro" id="pq" ${v==null?"hidden":""}><textarea maxlength="600" data-outro="${q.id}" placeholder="${v!=null&&v<=6?"O que faltou pra ser nota maior?":"Por que essa nota?"} (opcional)">${esc(A[q.id+"_outro"]||"")}</textarea></div>`:""}`;
  podeAvancar=v!=null;
 } else if(q.tipo==="texto"){
  corpo=q.curto?`<input type="text" maxlength="200" data-texto="${q.id}" placeholder="${esc(q.ph||"")}" value="${esc(v||"")}">`
              :`<textarea maxlength="1000" data-texto="${q.id}" placeholder="${esc(q.ph||"")}">${esc(v||"")}</textarea>`;
  podeAvancar=true;
 } else if(q.tipo==="motivos"){
  const pend=motivosPendentes();
  corpo=pend.map(k=>{const f=fn(k), vv=(A.motivo||{})[k];
   return `<div style="margin-bottom:22px"><h2 style="font-size:19px;margin-bottom:10px"><span style="color:var(--ama)">${f.ic} ${esc(f.t)}</span> — por que você não usa?</h2>
    <div class="opts" data-grupo="${k}">${MOTIVOS.map(o=>opt(o,vv===o.k)).join("")}</div>
    <div class="outro" id="outro-motivo-${k}" ${vv==="outro"?"":"hidden"}><input type="text" maxlength="200" data-outro-motivo="${k}" placeholder="Qual?" value="${esc((A.motivo_outro||{})[k]||"")}"></div></div>`;}).join("");
  podeAvancar=pend.every(k=>(A.motivo||{})[k]);
  return cabecalho({eyebrow:"Sem julgamento",t:pend.length>1?"Essas duas você ainda não usa.":"Essa você ainda não usa.",sub:"É a resposta mais útil da pesquisa inteira: <b>o motivo</b> de não usar."},corpo,podeAvancar,false);
 } else if(q.tipo==="pagaria"){
  const esc_=(A.deseja||[]).filter(k=>k!=="outro").map(k=>DESEJOS.find(d=>d.k===k)).filter(Boolean);
  corpo=`<div class="opts">${esc_.map(o=>opt(o,v===o.k,true)).join("")}${opt({k:"nenhuma",t:"Nenhuma — queria, mas não pagaria a mais"},v==="nenhuma")}</div>`;
  podeAvancar=!!v;
  return cabecalho({eyebrow:"Teste de verdade",t:"Dessas, por qual você pagaria a mais?",sub:"Querer é fácil. Pagar separa o que importa do que é legal."},corpo,podeAvancar,false);
 } else if(q.tipo==="contato"){
  const c=v||{};
  corpo=`<div class="opts">${opt({k:"sim",t:"Pode chamar",s:"10 minutinhos, no seu horário"},c.pode==="sim")}${opt({k:"nao",t:"Prefiro não",s:"sem problema nenhum"},c.pode==="nao")}</div>
   ${USER?`<p class="hint" style="margin-top:14px">Você está logado na VANT${PERFIL?.nickname?` como <b style="color:var(--ink)">${esc(PERFIL.nickname)}</b>`:""} — não precisa preencher nada.</p>`
   :`<div style="display:grid;gap:9px;margin-top:16px"><input type="text" maxlength="80" data-c="nome" placeholder="Seu nome (opcional)" value="${esc(c.nome||"")}"><input type="tel" inputmode="tel" maxlength="20" data-c="zap" placeholder="Seu WhatsApp com DDD (opcional)" value="${esc(c.zap||"")}"><p class="hint">Só pra gente saber quem respondeu. Nada de spam.</p></div>`}
   <input class="sr" type="text" name="site" tabindex="-1" autocomplete="off" data-hp>
   <div class="erro" id="erroEnvio"></div>`;
  podeAvancar=!!c.pode;
  return cabecalho({eyebrow:"Última",t:"Podemos te chamar no WhatsApp pra ouvir mais?",sub:"Quem conversa com a gente influencia o app de verdade."},corpo,podeAvancar,false,"Enviar respostas");
 }
 return cabecalho(q,corpo,podeAvancar,q.opcional);
}
function cabecalho(q,corpo,pode,opcional,rotulo){
 return `<div class="eyebrow">${esc(q.eyebrow||"")}</div><h2>${esc(q.t)}</h2>${q.sub?`<p class="sub">${q.sub}</p>`:'<div style="height:14px"></div>'}
  ${corpo}
  <div class="nav">
   <button type="button" class="btn back" id="voltar" aria-label="Voltar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
   <button type="button" class="btn go" id="avancar" ${pode?"":"disabled"}>${rotulo||"Próxima"} →</button>
  </div>
  ${opcional?`<div style="text-align:center;margin-top:12px"><button type="button" class="pular" id="pular">Pular essa</button></div>`:""}`;
}

/* ================= INTERAÇÃO ================= */
function ligar(){
 const q=Q[i];
 const c=$("comecar"); if(c) c.onclick=()=>{i=i<0?0:i; proximo(0);};
 const z=$("zerar"); if(z) z.onclick=()=>{for(const k in A) delete A[k]; i=-1; salvar(); render();};
 if(!q) return;
 const av=$("avancar"), vo=$("voltar"), pu=$("pular");
 const habilitar=on=>{ if(av) av.disabled=!on; };
 if(vo) vo.onclick=()=>proximo(-1);
 if(pu) pu.onclick=()=>{delete A[q.id]; proximo(1);};
 if(av) av.onclick=()=>{ if(q.tipo==="contato") enviar(); else proximo(1); };

 if(q.tipo==="single"||q.tipo==="emo"){
  $("tela").querySelectorAll(".opt").forEach(b=>b.onclick=()=>{
   A[q.id]=b.dataset.k; $("tela").querySelectorAll(".opt").forEach(x=>x.setAttribute("aria-pressed",x===b));
   const o=q.ops.find(o=>o.k===b.dataset.k), ob=$("outro-"+q.id);
   if(ob){ ob.hidden=!o?.outro; if(o?.outro) ob.querySelector("input").focus(); }
   salvar(); habilitar(true);
   if(!o?.outro) setTimeout(()=>proximo(1),260);          // resposta única avança sozinha
  });
 }
 if(q.tipo==="grid"){
  const sel=new Set(q.multi?(A[q.id]||(q.pre?q.pre(A):[])):(A[q.id]?[A[q.id]]:[]));
  if(q.multi&&!A[q.id]&&sel.size){A[q.id]=[...sel];}
  $("tela").querySelectorAll(".opt").forEach(b=>b.onclick=()=>{
   const k=b.dataset.k;
   if(q.multi){ if(sel.has(k)) sel.delete(k); else { if(q.max&&sel.size>=q.max){toast(`Só ${q.max} — tira uma pra pôr outra`);return;} sel.add(k);} A[q.id]=[...sel]; }
   else { sel.clear(); sel.add(k); A[q.id]=k; }
   $("tela").querySelectorAll(".opt").forEach(x=>x.setAttribute("aria-pressed",sel.has(x.dataset.k)));
   const ob=$("outro-"+q.id); if(ob){ ob.hidden=!sel.has("outro"); if(sel.has("outro")&&k==="outro") ob.querySelector("input").focus(); }
   salvar(); habilitar(sel.size>0);
   if(!q.multi&&k!=="outro") setTimeout(()=>proximo(1),260);
  });
 }
 if(q.tipo==="escala"){
  $("tela").querySelectorAll(".escala button").forEach(b=>b.onclick=()=>{
   A[q.id]=+b.dataset.k; $("tela").querySelectorAll(".escala button").forEach(x=>x.setAttribute("aria-pressed",x===b));
   const pq=$("pq"); if(pq){pq.hidden=false; pq.querySelector("textarea").placeholder=(A[q.id]<=6?"O que faltou pra ser nota maior?":"Por que essa nota?")+" (opcional)";}
   salvar(); habilitar(true);
  });
 }
 if(q.tipo==="motivos"){
  $("tela").querySelectorAll("[data-grupo]").forEach(g=>g.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{
   const grupo=g.dataset.grupo; (A.motivo=A.motivo||{})[grupo]=b.dataset.k;
   g.querySelectorAll(".opt").forEach(x=>x.setAttribute("aria-pressed",x===b));
   const ob=$("outro-motivo-"+grupo); if(ob){ob.hidden=b.dataset.k!=="outro"; if(b.dataset.k==="outro") ob.querySelector("input").focus();}
   salvar(); habilitar(motivosPendentes().every(k=>A.motivo[k]));
   if(motivosPendentes().every(k=>A.motivo[k])&&b.dataset.k!=="outro"&&motivosPendentes().length===1) setTimeout(()=>proximo(1),260);
  }));
  $("tela").querySelectorAll("[data-outro-motivo]").forEach(inp=>inp.oninput=()=>{(A.motivo_outro=A.motivo_outro||{})[inp.dataset.outroMotivo]=inp.value; salvar();});
 }
 if(q.tipo==="pagaria"){
  $("tela").querySelectorAll(".opt").forEach(b=>b.onclick=()=>{A[q.id]=b.dataset.k; $("tela").querySelectorAll(".opt").forEach(x=>x.setAttribute("aria-pressed",x===b)); salvar(); habilitar(true); setTimeout(()=>proximo(1),260);});
 }
 if(q.tipo==="contato"){
  A.contato=A.contato||{};
  $("tela").querySelectorAll(".opt").forEach(b=>b.onclick=()=>{A.contato.pode=b.dataset.k; $("tela").querySelectorAll(".opt").forEach(x=>x.setAttribute("aria-pressed",x===b)); salvar(); habilitar(true);});
  $("tela").querySelectorAll("[data-c]").forEach(inp=>inp.oninput=()=>{A.contato[inp.dataset.c]=inp.value; salvar();});
 }
 $("tela").querySelectorAll("[data-texto]").forEach(el=>el.oninput=()=>{A[q.id]=el.value; salvar();});
 $("tela").querySelectorAll("[data-outro]").forEach(el=>el.oninput=()=>{A[el.dataset.outro+"_outro"]=el.value; salvar();});
 $("tela").querySelectorAll("[data-outro]").forEach(el=>el.onkeydown=e=>{if(e.key==="Enter"&&el.tagName==="INPUT"){e.preventDefault();proximo(1);}});
 $("tela").querySelectorAll("[data-texto]").forEach(el=>el.onkeydown=e=>{if(e.key==="Enter"&&el.tagName==="INPUT"){e.preventDefault();proximo(1);}});
 const first=$("tela").querySelector("textarea,[data-texto]"); if(first&&first.tagName==="TEXTAREA") setTimeout(()=>first.focus({preventScroll:true}),350);
}
function proximo(dir){
 const tela=$("tela");
 if(dir!==0){ tela.classList.add("out"); }
 setTimeout(()=>{
  if(dir===0){ render(); salvar(); return; }
  let j=i+dir;
  while(j>=0&&j<Q.length&&!existe(Q[j])) j+=dir;   // pula as adaptativas que não se aplicam
  i=Math.max(-1,Math.min(Q.length,j)); salvar(); render(dir);
 }, dir===0?0:200);
}

/* ================= ENVIO ================= */
let ENVIANDO=false;
async function enviar(){
 if(ENVIANDO) return;
 const hp=$("tela").querySelector("[data-hp]"); if(hp&&hp.value){ i=Q.length; render(); return; } // bot: finge que enviou
 const av=$("avancar"), er=$("erroEnvio");
 if(!sb){ er.textContent="Sem conexão com o servidor. Tenta de novo em instantes."; return; }
 ENVIANDO=true; av.disabled=true; av.textContent="Enviando…"; er.textContent="";
 const payload={...A, versao:"v1", logado:!!USER, enviado_em:new Date().toISOString()};
 const nome=USER?(PERFIL?.nickname||null):(A.contato?.nome||null);
 const zap=USER?null:(A.contato?.zap||null);
 try{
  const {error}=await sb.rpc("pesquisa_enviar",{p_respostas:payload,p_nome:nome,p_whatsapp:zap,p_origem:origem||null,p_ua:navigator.userAgent.slice(0,300)});
  if(error) throw error;
  try{localStorage.removeItem(K);}catch(e){}
  i=Q.length; render();
 }catch(e){
  er.textContent="Não consegui enviar ("+(e.message||e)+"). Suas respostas estão guardadas aqui — tenta de novo.";
  av.disabled=false; av.textContent="Enviar respostas →";
 }
 ENVIANDO=false;
}

/* ================= ADMIN ================= */
const adm=$("admin");
$("btEquipe").onclick=()=>abrirAdmin();
if(location.hash==="#admin") abrirAdmin();
async function abrirAdmin(){
 $("app").hidden=true; adm.hidden=false; history.replaceState(null,"","#admin");
 if(!sb){ adm.innerHTML='<p class="erro">Sem conexão com o servidor.</p>'; return; }
 const {data:{session}}=await sb.auth.getSession();
 if(session){ const {data:ok}=await sb.rpc("is_orbis_crm"); if(ok===true){ await painel(); return; } }
 adm.innerHTML=`<div class="top"><img src="/vant-wordmark.png" alt="VANT"><span class="sp"></span><button class="btn ghost" id="voltarPesq">← pesquisa</button></div>
  <div class="loginbox"><h1>Equipe VANT</h1><p class="sub">Mesmo CPF (ou e-mail) e senha do app. Só admin e comercial entram.</p>
   <input id="inEmail" type="text" placeholder="CPF ou e-mail" autocomplete="username"><input id="inSenha" type="password" placeholder="Senha" autocomplete="current-password">
   <button class="btn go" id="btEntrar">Entrar</button><div class="erro" id="erroLogin"></div></div>`;
 $("voltarPesq").onclick=voltarPesquisa;
 $("btEntrar").onclick=async()=>{
  const v=$("inEmail").value.trim(), email=v.includes("@")?v:v.replace(/\D/g,"")+"@orbis.internal";
  $("btEntrar").disabled=true; $("erroLogin").textContent="";
  const {error}=await sb.auth.signInWithPassword({email,password:$("inSenha").value});
  if(error){ $("erroLogin").textContent=/invalid/i.test(error.message)?"CPF ou senha incorretos.":error.message; $("btEntrar").disabled=false; return; }
  const {data:ok}=await sb.rpc("is_orbis_crm");
  if(ok!==true){ $("erroLogin").textContent="Essa conta não está liberada pra ver a pesquisa."; await sb.auth.signOut(); $("btEntrar").disabled=false; return; }
  await painel();
 };
 ["inEmail","inSenha"].forEach(id=>$(id).onkeydown=e=>{if(e.key==="Enter")$("btEntrar").click();});
}
function voltarPesquisa(){ adm.hidden=true; $("app").hidden=false; history.replaceState(null,"",location.pathname+location.search); }

let R=[], F={dias:"0", busca:""};
async function painel(){
 adm.innerHTML='<p class="tiny" style="padding:30px 0">Carregando respostas…</p>';
 const {data,error}=await sb.rpc("pesquisa_listar");
 if(error){ adm.innerHTML=`<p class="erro">${esc(error.message)}</p>`; return; }
 R=data||[]; desenharPainel();
}
const rot={
 tempo:{teste:"Testando",m1:"< 1 mês",m3:"1–3 meses",m3mais:"> 3 meses",parei:"Parou de usar"},
 freq:{todo:"Todo dia que vende",alguns:"Alguns dias/semana",vez:"De vez em quando",quase:"Quase nunca"},
 pmf:{muito:"Muito chateado",pouco:"Um pouco",tanto_faz:"Tanto faz",aliviado:"Aliviado"},
 nao_registrou:{registro_tudo:"Registra tudo",esqueci:"Esqueceu",corrido:"Corrido demais",sem_vantagem:"Não viu vantagem",travou:"App travou",outro:"Outro"},
 ganho:{lucro:"Sabe quanto lucra",vendo_mais:"Vende mais",foco:"Foco/disciplina",dinheiro:"Organizou o dinheiro",motivacao:"Motivação",nada:"Nada ainda",outro:"Outro"},
};
const nomeF=k=>fn(k)?.t||DESEJOS.find(d=>d.k===k)?.t||MOTIVOS.find(m=>m.k===k)?.t||k;
function contar(lista,fnK){ const c={}; lista.forEach(r=>{const v=fnK(r.respostas||{}); (Array.isArray(v)?v:[v]).filter(x=>x!=null&&x!=="").forEach(x=>c[x]=(c[x]||0)+1);}); return Object.entries(c).sort((a,b)=>b[1]-a[1]); }
function barras(pares,total,rotulo){ const max=Math.max(1,...pares.map(p=>p[1]));
 return pares.length?`<div class="barras">${pares.map(([k,n])=>`<div class="bar"><span>${esc(rotulo?rotulo(k):k)}</span><span class="tr"><i style="width:${n/max*100}%"></i></span><span class="n">${n} · ${total?Math.round(n/total*100):0}%</span></div>`).join("")}</div>`:'<p class="tiny">sem dados ainda</p>'; }
function filtradas(){
 const d=+F.dias, lim=d?Date.now()-d*864e5:0, b=F.busca.trim().toLowerCase();
 return R.filter(r=>(!lim||new Date(r.criado_em).getTime()>=lim)&&(!b||JSON.stringify(r).toLowerCase().includes(b)));
}
function desenharPainel(){
 const L=filtradas(), n=L.length;
 const npsV=L.map(r=>r.nps).filter(v=>v!=null), prom=npsV.filter(v=>v>=9).length, det=npsV.filter(v=>v<=6).length;
 const nps=npsV.length?Math.round((prom-det)/npsV.length*100):null;
 const pmfMuito=L.filter(r=>r.pmf==="muito").length, pmfN=L.filter(r=>r.pmf).length;
 const topa=L.filter(r=>r.respostas?.contato?.pode==="sim").length;
 const dt=s=>{const d=new Date(s);return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});};
 const textos=(campo,q)=>L.filter(r=>(r.respostas?.[campo]||"").trim()).map(r=>`<div class="cit">“${esc(r.respostas[campo])}”<span class="q">${esc(r.nome)} · ${dt(r.criado_em)}${r.nps!=null?" · nota "+r.nps:""}</span></div>`).join("")||'<p class="tiny">ninguém escreveu ainda</p>';
 const motivos=[]; L.forEach(r=>{const m=r.respostas?.motivo||{}; Object.entries(m).forEach(([f,mo])=>motivos.push(f+"|"+mo));});
 const motivosC=Object.entries(motivos.reduce((a,x)=>(a[x]=(a[x]||0)+1,a),{})).sort((a,b)=>b[1]-a[1]);
 adm.innerHTML=`
  <div class="top"><img src="/vant-wordmark.png" alt="VANT"><span class="sp"></span>
   <button class="btn ghost" id="csv">Baixar CSV</button><button class="btn ghost" id="sair">Sair</button><button class="btn ghost" id="voltarPesq">← pesquisa</button></div>
  <h1>Pesquisa de satisfação · resultados</h1>
  <div class="filtros">
   <select id="fDias"><option value="0">Desde o início</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select>
   <input id="fBusca" type="text" placeholder="Buscar nome, WhatsApp, palavra…" value="${esc(F.busca)}">
   <span class="tiny">${n} de ${R.length} respostas</span>
  </div>
  <div class="cards">
   <div class="card"><div class="k">Respostas</div><div class="v">${n}</div><div class="s">${L.filter(r=>r.user_id).length} logadas no app</div></div>
   <div class="card"><div class="k">NPS</div><div class="v" style="color:var(--${nps==null?"dim":nps>=50?"ok":nps>=0?"ama":"bad"})">${nps==null?"—":nps}</div><div class="s">${prom} promotores · ${det} detratores</div></div>
   <div class="card"><div class="k">“Muito chateado” se sumisse</div><div class="v" style="color:var(--${pmfN&&pmfMuito/pmfN>=.4?"ok":"ama"})">${pmfN?Math.round(pmfMuito/pmfN*100)+"%":"—"}</div><div class="s">meta do livro: 40%+ · ${pmfMuito} de ${pmfN}</div></div>
   <div class="card"><div class="k">Topam conversar</div><div class="v">${topa}</div><div class="s">chamar no WhatsApp</div></div>
  </div>
  <div class="duas">
   <div><div class="sec">O que mais usam (1ª escolha)</div><div class="box">${barras(contar(L,a=>a.mais_usa),n,nomeF)}</div></div>
   <div><div class="sec">Já usaram pelo menos uma vez</div><div class="box">${barras(contar(L,a=>a.ja_usou),n,nomeF)}</div></div>
   <div><div class="sec">Por que NÃO usam</div><div class="box">${barras(motivosC,n,k=>{const [f,m]=k.split("|");return nomeF(f)+" → "+nomeF(m);})}</div></div>
   <div><div class="sec">O que querem (até 3 cada)</div><div class="box">${barras(contar(L,a=>a.deseja),n,nomeF)}</div></div>
   <div><div class="sec">Pagariam a mais por</div><div class="box">${barras(contar(L,a=>a.pagaria),n,k=>k==="nenhuma"?"Nenhuma":nomeF(k))}</div></div>
   <div><div class="sec">Maior ganho</div><div class="box">${barras(contar(L,a=>a.ganho),n,k=>rot.ganho[k]||k)}</div></div>
   <div><div class="sec">Por que não registram venda</div><div class="box">${barras(contar(L,a=>a.nao_registrou),n,k=>rot.nao_registrou[k]||k)}</div></div>
   <div><div class="sec">Tempo de uso · frequência</div><div class="box">${barras(contar(L,a=>a.tempo),n,k=>rot.tempo[k]||k)}<div style="height:12px"></div>${barras(contar(L,a=>a.freq),n,k=>rot.freq[k]||k)}</div></div>
  </div>
  <div class="duas" style="margin-top:14px">
   <div><div class="sec">O que irrita</div><div class="box">${textos("irrita")}</div></div>
   <div><div class="sec">Mudariam UMA coisa</div><div class="box">${textos("uma_coisa")}</div></div>
  </div>
  <div class="sec">Resposta por pessoa · clique pra abrir</div>
  <div class="box" style="overflow-x:auto"><table class="tab">
   <tr><th>Quando</th><th>Quem</th><th>Plano</th><th>Nota</th><th>Se sumisse</th><th>Mais usa</th><th>Conversar?</th></tr>
   ${L.map((r,ix)=>{const a=r.respostas||{};
    return `<tr class="r" data-ix="${ix}"><td class="tiny">${dt(r.criado_em)}</td><td><b>${esc(r.nome)}</b>${r.whatsapp?`<br><span class="tiny">${esc(r.whatsapp)}</span>`:""}${r.cidade?`<br><span class="tiny">${esc(r.cidade)}</span>`:""}</td>
     <td>${r.plano?`<span class="pill">${esc(r.plano)}</span>`:r.user_id?'<span class="pill">conta</span>':'<span class="pill">sem login</span>'}</td>
     <td>${r.nps!=null?`<span class="pill ${r.nps>=9?"ok":r.nps<=6?"bad":"ama"}">${r.nps}</span>`:"—"}</td>
     <td>${rot.pmf[r.pmf]||"—"}</td><td>${nomeF(a.mais_usa)||"—"}</td>
     <td>${a.contato?.pode==="sim"?`<a class="pill ok" href="https://wa.me/55${esc((r.whatsapp||"").replace(/\D/g,""))}" target="_blank" rel="noopener" style="text-decoration:none">WhatsApp ↗</a>`:"não"}</td></tr>
    <tr class="det" data-det="${ix}" hidden><td colspan="7">${detalhe(r)}</td></tr>`;}).join("")}
   ${n?"":'<tr><td colspan="7" class="tiny">Nenhuma resposta nesse filtro.</td></tr>'}
  </table></div>
  <p class="tiny" style="margin-top:14px">NPS = % notas 9–10 menos % notas 0–6. "Muito chateado" é a pergunta de Sean Ellis (Lean Startup): acima de 40% o produto é indispensável pra quem usa. Link pra mandar: <b>${location.origin}/pesquisa?o=whatsapp</b></p>`;
 $("voltarPesq").onclick=voltarPesquisa;
 $("sair").onclick=async()=>{await sb.auth.signOut(); voltarPesquisa();};
 $("fDias").value=F.dias; $("fDias").onchange=()=>{F.dias=$("fDias").value; desenharPainel();};
 $("fBusca").oninput=()=>{F.busca=$("fBusca").value; const p=$("fBusca").selectionStart; desenharPainel(); const b=$("fBusca"); b.focus(); b.setSelectionRange(p,p);};
 adm.querySelectorAll("tr.r").forEach(tr=>tr.onclick=()=>{const d=adm.querySelector(`[data-det="${tr.dataset.ix}"]`); d.hidden=!d.hidden;});
 $("csv").onclick=()=>baixarCSV(L);
}
function detalhe(r){
 const a=r.respostas||{}, kv=(k,v)=>v?`<div class="kv"><span class="k">${k}</span><span>${v}</span></div>`:"";
 const motivos=Object.entries(a.motivo||{}).map(([f,m])=>`${nomeF(f)}: <b>${nomeF(m)}</b>${m==="outro"&&a.motivo_outro?.[f]?" — "+esc(a.motivo_outro[f]):""}`).join("<br>");
 return kv("Tempo de uso",rot.tempo[a.tempo])+kv("Frequência",rot.freq[a.freq])+kv("Mais usa",nomeF(a.mais_usa))
  +kv("Já usou",(a.ja_usou||[]).map(nomeF).join(", "))+kv("Por que não usa",motivos)
  +kv("Não registrou porque",(rot.nao_registrou[a.nao_registrou]||"")+(a.nao_registrou==="outro"&&a.nao_registrou_outro?" — "+esc(a.nao_registrou_outro):""))
  +kv("Se sumisse",rot.pmf[a.pmf])+kv("Maior ganho",(rot.ganho[a.ganho]||"")+(a.ganho==="outro"&&a.ganho_outro?" — "+esc(a.ganho_outro):""))
  +kv("Irrita",a.irrita&&`“${esc(a.irrita)}”`)+kv("Quer no app",(a.deseja||[]).map(nomeF).join(", ")+(a.deseja_outro?" — "+esc(a.deseja_outro):""))
  +kv("Pagaria por",a.pagaria==="nenhuma"?"Nenhuma":nomeF(a.pagaria))+kv("Mudaria uma coisa",a.uma_coisa&&`“${esc(a.uma_coisa)}”`)
  +kv("Nota · por quê",a.nps!=null?`${a.nps}${a.nps_outro?" — “"+esc(a.nps_outro)+"”":""}`:"")
  +kv("Vende",r.vende&&esc(r.vende))+kv("Origem",a.logado?"logado no app":"sem login"+(r.origem?" · "+esc(r.origem):""));
}
function baixarCSV(L){
 const cols=["criado_em","nome","whatsapp","cidade","plano","nps","pmf","tempo","freq","mais_usa","ja_usou","motivo","nao_registrou","ganho","irrita","deseja","pagaria","uma_coisa","nps_outro","contato_pode","origem"];
 const cel=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
 const linhas=L.map(r=>{const a=r.respostas||{};return [r.criado_em,r.nome,r.whatsapp,r.cidade,r.plano,r.nps,r.pmf,a.tempo,a.freq,a.mais_usa,(a.ja_usou||[]).join("|"),JSON.stringify(a.motivo||{}),a.nao_registrou,a.ganho,a.irrita,(a.deseja||[]).join("|"),a.pagaria,a.uma_coisa,a.nps_outro,a.contato?.pode,r.origem].map(cel).join(",");});
 const blob=new Blob(["﻿"+cols.join(",")+"\n"+linhas.join("\n")],{type:"text/csv;charset=utf-8"});
 const u=URL.createObjectURL(blob), a=document.createElement("a"); a.href=u; a.download="vant-pesquisa-"+new Date().toISOString().slice(0,10)+".csv"; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000);
}

render();
})().catch(e=>{ console.error(e); const t=document.getElementById("tela"); if(t) t.innerHTML='<p class="erro">A pesquisa não carregou. Recarregue a página.</p>'; });
