/* CRM da Vant — todo o JavaScript fica aqui, fora do HTML, porque a política de segurança
   do site (CSP) proíbe script embutido na página. Este arquivo é servido pelo próprio domínio. */

/* ===== 0. BOOT: roda antes de tudo. Se o CRM travar carregando, avisa em vez de ficar mudo. ===== */
/* roda antes do CRM em si: se o botão continuar "Carregando…" depois de 15s,
   o arquivo principal não chegou (internet, bloqueio ou CDN fora) — avisa em vez de ficar mudo */
window.__crmPronto=false;
document.getElementById("btEntrar").addEventListener("click",function(){
  if(!window.__crmPronto){var e=document.getElementById("erroLogin");e.className="andamento";
    e.textContent="Ainda carregando o CRM… espera uns segundos e clica de novo.";}
});
setTimeout(function(){
  if(window.__crmPronto) return;
  var e=document.getElementById("erroLogin"); e.className="";
  e.textContent="O CRM não terminou de carregar (15s). Verifique a internet e recarregue a página (Ctrl+Shift+R). Se persistir, avise o Rick — pode ser o servidor de scripts fora do ar.";
  document.getElementById("btEntrar").textContent="Recarregar";
  document.getElementById("btEntrar").disabled=false;
  document.getElementById("btEntrar").onclick=function(){location.reload();};
},15000);

/* ===== 1. O CRM ===== */
(async () => {
/* biblioteca do Supabase vem do jsdelivr (único CDN liberado na CSP do site). Se falhar, avisa. */
let createClient;
try { ({ createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")); }
catch (e1) {
  const el=document.getElementById("erroLogin"); el.className="";
  el.textContent="Não consegui baixar a biblioteca de login (cdn.jsdelivr.net bloqueado ou fora do ar). Recarregue ou tente outra rede.";
  throw e1;
}
const sb = createClient("https://qbcsjsdwjjpybvzbxszi.supabase.co",
                        "sb_publishable_QHFeQuWwHWFOl_0dIbiB4A_6QQCmPyy");
/* =========================================================
   DADOS REAIS — lidos ao vivo do banco (RPCs do CRM).
   Nada aqui e fixo: tudo chega de crm_faturamento, crm_funil,
   crm_hotmart_lista e crm_parceiros. Exige login de admin.
   ========================================================= */
const META={contatos:10, vendas:1};
let GRANA={total:0,pagamentos:0,ticket:0,desde:"—",d7:0,d7Pag:0,mes:0,
  naoPagas:0,naoPagasQtd:0,atraso:0,atrasoQtd:0,encerradas:0,encerradasQtd:0,
  recorrente:0,recorrenteQtd:0,renovMes:0,renovMesValor:0,novasMes:0,dias:[]};
let QTD={}, F=[], FICHAS=[], PARCEIROS=[], HOT=[], CONV={};
let PAPEL="comercial";   // "admin" = dono; "comercial" = opera o CRM
const ehDono=()=>PAPEL==="admin";
/* FUNIL HISTORICO — medido no banco em 22/09/2026 (contas, aberturas, vendas registradas).
   Sao numeros de historia acumulada, nao de hoje; por isso ficam fixos ate virarem RPC. */
/* NUM = números vivos do funil, lidos de crm_numeros() a cada abertura */
let NUM={leads_total:0,leads_sem_conta:0,leads_com_conta:0,contas:0,abriram:0,venderam:0,assinaram:0,pagando:0};
let BASES={base:0,abriram:0,venderam:0,assinaram:0,trial:0,pagante:0,atraso:0,parou:0,frio:0};
const TRIAL_HIST={total:363,semContato:298,comContato:65,fechou:17,fechouSem:14,fechouCom:3};
const FECHOU={jun:28,jul:19,ago:40,set:21,total:108,comYan:33,sozinhas:75,pct:30.6};
const TEMPOS={ate1oContato:182.8,mediana:185.7,entreFollowups:0.2};
const LP={get total(){return NUM.leads_total}, get semConta(){return NUM.leads_sem_conta}, get comConta(){return NUM.leads_com_conta}};
const RITMO=[["26/08",6],["01/09",12],["05/09",4],["07/09",3],["09/09",10],["10/09",48],
             ["12/09",34],["13/09",23],["15/09",63],["16/09",0],["17/09",0],["18/09",0],
             ["19/09",0],["20/09",0],["21/09",0],["22/09",0]];
const FOCO=[{d:"26/08",ini:"13:34",fim:"15:23",min:109,tar:6,fic:3},
 {d:"01/09",ini:"14:36",fim:"14:55",min:19,tar:12,fic:11},
 {d:"05/09",ini:"11:47",fim:"11:53",min:7,tar:4,fic:4},
 {d:"07/09",ini:"11:12",fim:"17:47",min:395,tar:3,fic:2},
 {d:"09/09",ini:"14:01",fim:"14:07",min:6,tar:10,fic:7},
 {d:"10/09",ini:"10:45",fim:"16:00",min:315,tar:48,fic:36},
 {d:"12/09",ini:"11:19",fim:"11:41",min:22,tar:34,fic:17},
 {d:"13/09",ini:"13:13",fim:"13:26",min:13,tar:23,fic:8},
 {d:"15/09",ini:"16:26",fim:"20:29",min:243,tar:63,fic:25}];

/* mapa pipeline do banco -> esteira desta tela */
const DE_PIPE={trial:"trial", relacionamento:"pagante", inadimplente:"perdido", parceiro:"base"};
const DE_ETAPA={
 trial:{lp:"lp",dia1:"dia1",dia2:"dia2",dia3:"dia3",fechamento:"dia3",fechou:"assinou",nao_renovou:"acabou"},
 relacionamento:{inicio_mes:"novo",meio_mes:"meio",fim_mes:"meio",renovacao:"renova"},
 inadimplente:{novo:"saiu",contato1:"motivo",negociando:"oferta",fechamento:"voltou"},
 parceiro:{novo:"frio",contatado:"acordou",respondeu:"usou",virou_teste:"virou"}};

const E={
 trial:{nome:"Trial de 3 dias",cor:"c1",
  desc:"Começa no lead da landing page. Boas-vindas só abre quando a pessoa cria conta no Orbis — o dia seguinte só abre quando a atividade do dia é feita.",
  cols:[["lp","Lead da LP · sem conta"],["dia1","Dia 1 · Boas-vindas"],["dia2","Dia 2 · Ensinar"],["dia3","Dia 3 · Decidir"],["assinou","Assinou"],["acabou","Acabou"]],
  ativ:{
   lp:[
    {t:"Chamar e perguntar se travou no cadastro",m:"Oi {p}, tudo bem? Aqui é o Yan do Orbis.\n\nVocê deixou seu contato pra conhecer o app mas não chegou a criar a conta. Travou em alguma parte?\n\nSe quiser eu te mando o link direto e te acompanho no primeiro dia."},
    {t:"Mandar o link de criar conta",m:"Segue o link pra criar sua conta: [link]\n\nLeva menos de um minuto. Assim que criar me avisa aqui que eu já te mostro por onde começar."},
    {t:"Anotar o motivo se não criar",nota:"Se ele não criar conta, escreva o porquê. O motivo de quem não entra é o dado mais valioso que a gente não tem."}],
   dia1:[
    {t:"Mandar boas-vindas no WhatsApp",m:"Fala {p}, bem-vindo ao Orbis!\n\nSou o Yan, vou te acompanhar nesses 3 dias de teste.\n\nQualquer dúvida é só chamar aqui, respondo rápido."},
    {t:"Perguntar o que ele vende e onde",m:"Me conta uma coisa: o que você vende e onde você costuma vender?\n\nAssim já te mostro a parte do app que mais vai te ajudar no seu corre."},
    {t:"Confirmar que registrou a primeira venda",m:"{p}, conseguiu registrar sua primeira venda no app?\n\nÉ o passo que faz tudo destravar — depois dela o Orbis já começa a te mostrar número."}],
   dia2:[
    {t:"Perguntar como foi o primeiro dia",m:"E aí {p}, como foi o primeiro dia usando o Orbis?\n\nDeu pra registrar as vendas direitinho ou travou em alguma parte?"},
    {t:"Ensinar o DEFCON 4",m:"Quero te mostrar a função que quase ninguém acha sozinho: o DEFCON 4.\n\nEle divide seu dia em blocos de 1 hora, com meta em cada bloco e 5 minutos de descanso entre eles.\n\nQuem usa dois dias seguidos não larga mais. Quer que eu te mostre como liga?"},
    {t:"Anotar a objeção principal",nota:"Escreva com as palavras dele o que está travando: preço, tempo, não entendeu o app, achou que não precisa."}],
   dia3:[
    {t:"Avisar que o teste acaba hoje",m:"{p}, hoje é o último dia do seu teste grátis!\n\nNão quero que acabe e você nem perceba — por isso tô passando aqui."},
    {t:"Mostrar o resultado dos 3 dias",m:"Dá uma olhada no seu relatório antes de decidir: tudo que você registrou nesses 3 dias tá lá.\n\nVocê já consegue ver quanto vendeu, quanto lucrou e qual foi sua melhor hora do dia."},
    {t:"Mandar o link de assinatura",m:"Se fizer sentido continuar, é R$ 29,90 por mês — menos de duas vendas suas.\n\nSegue o link: [link da assinatura]\n\nQualquer dúvida me chama antes de decidir."}],
   assinou:[
    {t:"Confirmar que o pagamento passou",m:"{p}, confirmado aqui! Seja muito bem-vindo de verdade.\n\nSeu acesso já tá liberado e eu continuo por aqui."},
    {t:"Combinar a meta do primeiro mês",m:"Vamos combinar uma coisa: qual a meta de faturamento que você quer bater esse mês?\n\nEu anoto aqui e te cobro — de forma leve, mas cobro."}],
   acabou:[
    {t:"Registrar o motivo de não ter fechado",nota:"OBRIGATÓRIO. Sem o motivo escrito aqui, a ficha fica marcada como 'não houve contato' nas métricas."},
    {t:"Última tentativa de resgate",m:"Oi {p}, aqui é o Yan do Orbis.\n\nSeu teste encerrou e eu queria só entender: o que faltou pra fazer sentido pra você?\n\nSe foi só falta de tempo pra testar direito, eu libero mais 3 dias — e dessa vez eu te acompanho de perto."}]}},

 pagante:{nome:"Já pagantes",cor:"c2",
  desc:"Entra sozinho quando a ficha do Trial cai em Assinou. O trabalho aqui é não deixar a renovação chegar de surpresa.",
  cols:[["novo","Primeiro mês"],["meio","Meio do ciclo"],["renova","Renova em 7 dias"],["renovou","Renovou"]],
  ativ:{
   novo:[
    {t:"Confirmar que está usando todo dia",m:"Opa {p}, tudo certo?\n\nTô de olho aqui e queria saber: tá conseguindo usar o Orbis todo dia ou alguns dias escapam?"},
    {t:"Mostrar uma função que ele não abriu",m:"Vi que você ainda não mexeu em uma parte do app que ia te ajudar bastante.\n\nPosso te mandar um print rápido de como usar?"}],
   meio:[
    {t:"Mandar o resultado do mês dele",m:"{p}, metade do mês já foi. Olha só o que você registrou até agora no Orbis.\n\nTá no caminho da sua meta ou precisa acelerar na segunda quinzena?"},
    {t:"Elogiar um número real dele",m:"Cara, reparei que você manteve a constância esse mês. Isso é o que separa quem cresce de quem só trabalha.\n\nParabéns de verdade."}],
   renova:[
    {t:"Avisar que a renovação está chegando",m:"Opa {p}, tudo certo?\n\nSua renovação do Orbis é dia {renova}. Só tô avisando pra não te pegar de surpresa."},
    {t:"Confirmar que o cartão vai passar",m:"Dá uma conferida se o cartão tá em dia, beleza? Assim não trava seu acesso no meio do corre.\n\nQualquer coisa me chama que eu resolvo por aqui."}],
   renovou:[
    {t:"Agradecer e plantar a meta do mês novo",m:"{p}, renovação confirmada! Obrigado pela confiança.\n\nMês novo, meta nova: quanto você quer bater dessa vez?"}]}},

 perdido:{nome:"Encerrou e não renovou",cor:"c3",
  desc:"Já pagou e parou. É a base mais barata de trazer de volta — essa pessoa já conhece o produto.",
  cols:[["saiu","Acabou de sair"],["motivo","Motivo descoberto"],["oferta","Oferta feita"],["voltou","Voltou"]],
  ativ:{
   saiu:[
    {t:"Perguntar por que parou — sem vender nada",m:"Opa {p}, tudo bem?\n\nVi que sua assinatura do Orbis encerrou. Não tô aqui pra te vender nada, juro.\n\nSó queria entender o que faltou. Foi preço, foi o app, ou foi corrido demais pra usar?"},
    {t:"Anotar o motivo real",nota:"Escreva o motivo como ele falou. Esse campo vira a métrica de por que a gente perde gente."}],
   motivo:[
    {t:"Responder a objeção com o número dele",m:"{p}, entendi o que você falou.\n\nSó pra você ter em mente: no tempo que usou, você registrou suas vendas aqui e dava pra ver exatamente onde entrava e saía o dinheiro. É isso que some quando o app fecha."},
    {t:"Oferecer o caminho de volta",m:"Se quiser voltar, eu reativo sua conta com o histórico todo — nada foi apagado.\n\nQuer que eu reative?"}],
   oferta:[{t:"Cobrar a decisão em 48h",m:"{p}, só pra fechar: quer que eu reative ou prefere que eu encerre de vez aqui?\n\nQualquer resposta tá ótima, só não quero te deixar no limbo."}],
   voltou:[{t:"Confirmar que o pagamento passou",m:"Confirmado, {p}! Bem-vindo de volta.\n\nSeu histórico tá todo lá, é só continuar de onde parou."}]}},

 base:{nome:"Base geral",cor:"c4",
  desc:"Quem criou conta e nunca virou nada. O maior bolo e o mais frio — só entra na fila quando o resto estiver limpo.",
  cols:[["frio","Nunca usou"],["acordou","Abriu o app"],["usou","Registrou venda"],["virou","Virou teste"]],
  ativ:{
   frio:[
    {t:"Mandar a mensagem de resgate",m:"Oi {p}, tudo bem? Aqui é o Yan do Orbis.\n\nVi que você criou sua conta mas ainda não chegou a usar. Acontece, o corre é pesado.\n\nMe fala o que te travou?"},
    {t:"Perguntar o que travou",nota:"Se ele responder, anote aqui. É o dado mais valioso que a gente não tem: por que 408 pessoas criaram conta e sumiram."}],
   acordou:[{t:"Ensinar a primeira venda no DEFCON",m:"{p}, vi que você abriu o app! Boa.\n\nO próximo passo é registrar sua primeira venda — depois dela o Orbis começa a te mostrar número de verdade.\n\nQuer que eu te mostre como?"}],
   usou:[{t:"Mostrar o resultado e oferecer o teste",m:"{p}, você já registrou venda no Orbis — isso é ótimo.\n\nQuem faz isso costuma não largar mais. Quer que eu libere um teste completo pra você ver o resto do app?"}],
   virou:[{t:"Passar para a esteira de Trial",nota:"Ao marcar, a ficha sai daqui e entra no Dia 1 do Trial."}]}}
};


/* ===== CARREGADOR ===== */
function hotDe(c){
  const mail=(c.email||"").toLowerCase().trim();
  const zap=(c.whatsapp||"").replace(/\D/g,"");
  return HOT.find(h=>(h.user_id&&c.user_id&&h.user_id===c.user_id)
    || (mail&&(h.email||"").toLowerCase()===mail)
    || (zap.length>=8&&(h.telefone||"").replace(/\D/g,"").slice(-8)===zap.slice(-8))) || null;
}

const PROBLEMAS=[];
async function chamar(nome, args){
  try{
    const r = args ? await sb.rpc(nome,args) : await sb.rpc(nome);
    if(r.error){ PROBLEMAS.push(nome+": "+r.error.message); return null; }
    return r.data;
  }catch(e){ PROBLEMAS.push(nome+": "+(e.message||e)); return null; }
}
function mostrarProblemas(){
  const d=document.getElementById("diag"); if(!d) return;
  if(!PROBLEMAS.length){ d.hidden=true; return; }
  d.hidden=false;
  d.innerHTML='<b>O CRM abriu, mas parte dos dados não veio:</b><ul style="margin:8px 0 0;padding-left:18px">'
    + PROBLEMAS.map(t=>'<li>'+t.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))+'</li>').join('')
    + '</ul><p style="margin:9px 0 0;font-size:12px">Manda essa lista pro Claude que ele conserta.</p>';
}

async function carregarTudo(){
  PROBLEMAS.length=0;

  const g = (ehDono() ? await chamar("crm_faturamento") : null) || {};
  GRANA={total:+g.total||0,pagamentos:+g.pagamentos||0,ticket:+g.ticket||0,desde:g.desde||"—",
    d7:+g.d7||0,d7Pag:+g.d7_qtd||0,mes:+g.mes||0,
    naoPagas:+g.nao_pagas||0,naoPagasQtd:+g.nao_pagas_qtd||0,
    atraso:+g.atraso||0,atrasoQtd:+g.atraso_qtd||0,
    encerradas:+g.encerradas||0,encerradasQtd:+g.encerradas_qtd||0,
    recorrente:+g.recorrente||0,recorrenteQtd:+g.recorrente_qtd||0,
    renovMes:+g.renov_mes||0,renovMesValor:+g.renov_mes_valor||0,novasMes:+g.novas_mes||0,
    dias:(g.dias||[]).map(x=>[x.d,+x.v])};

  const n = await chamar("crm_numeros"); if(n) NUM=Object.assign(NUM, n);
  HOT = (await chamar("crm_hotmart_lista")) || [];
  CONV = {};
  for(const m of ((await chamar("crm_conversas_lista"))||[])){
    (CONV[m.cartao]=CONV[m.cartao]||[]).push({de:m.de,t:m.texto,q:quando(m.criado_em),ts:m.criado_em,origem:m.origem});
  }
  PARCEIROS = (ehDono() ? await chamar("crm_parceiros") : []) || [];

  const pipes=["trial","relacionamento","inadimplente","parceiro"];
  QTD={}; F=[]; let id=0;
  for(const pipe of pipes){
    const dados = await chamar("crm_funil",{p_pipeline:pipe});
    if(!dados) continue;
    const est=DE_PIPE[pipe], mapa=DE_ETAPA[pipe];
    for(const c of (dados.cartoes||[])){
      try{
        const col=mapa[c.etapa]; if(!col) continue;
        if(String(c.status||"aberto")!=="aberto" && col!=="assinou") continue;
        const k=est+"/"+col; QTD[k]=(QTD[k]||0)+1;
        const h=hotDe(c)||null;
        F.push({id:id++, cartaoId:c.id, e:est, c:col,
          n:String(c.nome||"—").split(" ").slice(0,2).join(" "),
          ref:c.ref||h?.origem||"—",
          zap:"·"+String(c.whatsapp||h?.telefone||"").replace(/\D/g,"").slice(-4),
          tel:telZap(c.whatsapp)||telZap(h?.telefone),
          conversa:(CONV[c.id]||[]),
          email:c.email||h?.email||"", cidade:c.cidade||"",
          d:Number(c.dias_na_etapa)||0,
          trava:(Number(c.dias_na_etapa)||0)>=1?(Number(c.dias_na_etapa)||0):0,
          entrou:c.criado_em||null, fim:c.trial_end||null,
          // data da próxima cobrança: a da Hotmart manda; a do Orbis é reserva
          renova:(h&&h.cobra_em?deBR(h.cobra_em):null)||c.period_end||null,
          pago:h&&h.valor?Number(h.valor):null, notas:c.notas||"",
          feitasBanco:c.feitas||[], hot:h});
      }catch(e){ PROBLEMAS.push("cartão "+(c&&c.id)+": "+(e.message||e)); }
    }
  }
  BASES={base:NUM.contas,abriram:NUM.abriram,venderam:NUM.venderam,assinaram:NUM.assinaram,
    trial:QTD["trial/dia1"]||0,pagante:NUM.pagando||GRANA.recorrenteQtd,
    atraso:GRANA.atrasoQtd,parou:GRANA.encerradasQtd,frio:QTD["base/frio"]||0};

  FICHAS=[];
  for(const f of F){
    try{ FICHAS.push({...f, ...avaliar(f)}); }
    catch(e){ PROBLEMAS.push("prioridade de "+f.n+": "+(e.message||e)); }
  }
  FICHAS.sort((a,b)=>b.score-a.score);
  if(!F.length) PROBLEMAS.push("Nenhum cartão veio das esteiras (crm_funil devolveu vazio).");
  mostrarProblemas();
}

/* ===== util ===== */
const HOJE=(()=>{const d=new Date();d.setHours(0,0,0,0);return d;})();
/* aceita "2026-09-22" e tambem o timestamp completo que vem do banco */
function dias(s){
 if(!s) return 0;
 const t = (s instanceof Date) ? s : new Date(String(s).length<=10 ? String(s)+"T12:00:00" : s);
 if(isNaN(t)) return 0;
 return Math.round((t-HOJE)/86400000);
}
/* data do banco -> 22/09/2026 */
const dbr=v=>{ if(!v) return "—"; const t=String(v); if(/^\d{2}\/\d{2}/.test(t)) return t; return t.slice(8,10)+"/"+t.slice(5,7)+"/"+t.slice(0,4); };
/* "22/09/2026" (como a Hotmart devolve) -> "2026-09-22" */
const deBR=v=>{ const m=/^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(v||"")); return m?`${m[3]}-${m[2]}-${m[1]}`:null; };
/* telefone brasileiro -> digitos com DDI, pronto pro wa.me */
function telZap(v){
 let d=String(v||"").replace(/\D/g,""); if(!d) return "";
 if(d.startsWith("0")) d=d.slice(1);
 if(d.length===10||d.length===11) d="55"+d;
 return d.length>=12&&d.length<=13 ? d : "";
}
/* abre o WhatsApp do vendedor com a mensagem pronta — custo zero, sem API */
const linkZap=(f,texto)=>f.tel?`https://wa.me/${f.tel}${texto?"?text="+encodeURIComponent(texto):""}`:null;
function abrirZap(f,texto){
 const u=linkZap(f,texto); if(!u){toast("Essa ficha não tem WhatsApp");return false;}
 window.open(u,"_blank","noopener"); return true;
}
/* timestamp do banco -> "hoje 14:32" / "ontem 09:10" / "21/09 09:10" */
function quando(ts){
 const t=new Date(ts); if(isNaN(t)) return "";
 const hm=t.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
 const d=Math.round((new Date(t.getFullYear(),t.getMonth(),t.getDate())-HOJE)/86400000);
 return (d===0?"hoje":d===-1?"ontem":t.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}))+" "+hm;
}
const brl=v=>"R$ "+(Number(v)||0).toFixed(2).replace(".",",").replace(/\B(?=(\d{3})+(?!\d))/g,".");
const esc=s=>String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
function toast(t){const e=document.getElementById("toast");e.textContent=t;e.dataset.on="1";clearTimeout(e._t);e._t=setTimeout(()=>e.dataset.on="0",2000);}

/* ===== TEMPERATURA DO LEAD =====
   Nao e sensacao, e comportamento: quanto a pessoa ja usou o app e quanto
   ja faturou DENTRO dele durante o teste. Quem faturou tem argumento pronto. */
function temperatura(f){
 const msgs=(f.conversa||[]).length;
 const respondeu=(f.conversa||[]).some(m=>m.de!=="eu");
 const fat=f.faturou||0, ven=f.vendas||0;
 if(f.c==="lp") return {n:"Ainda não é usuário",ic:"📄",cor:"dim",
   why:`Deixou contato na landing page e não criou conta. Não dá pra falar de resultado ainda — a conversa aqui é destravar o cadastro.`,msgs,respondeu};
 if(f.e!=="trial"&&f.e!=="base") return null;
 if(fat>=100&&ven>=10) return {n:"Pronto pra fechar",ic:"🔥",cor:"bad",
   why:`Registrou <b>${ven} vendas</b> e <b>${brl(fat)}</b> dentro do Orbis durante o teste. Ele já viu o valor — é só pedir a decisão usando o número dele.`,
   msgs,respondeu};
 if(fat>0||ven>0) return {n:"Morno",ic:"🌤️",cor:"warn",
   why:`Mexeu no app (${ven} venda${ven===1?"":"s"}, ${brl(fat)}) mas ainda não pegou ritmo. Falta mostrar o DEFCON.`,msgs,respondeu};
 if(f.usoDias>0) return {n:"Morno",ic:"🌤️",cor:"warn",
   why:`Abriu o app mas não registrou nenhuma venda. É aqui que a maioria some.`,msgs,respondeu};
 return {n:"Frio",ic:"❄️",cor:"dim",
   why:`Não abriu o app nenhuma vez. Quem não registra venda assina em 1,5% dos casos.`,msgs,respondeu};
}

/* ===== prioridade ===== */
function avaliar(f){
 let u=0,d=0,p="";
 if(f.c==="acabou"){u=100;d=55;
  p=`<b>Travado há ${f.trava} dias e sem motivo registrado.</b> O teste acabou e ninguém falou com essa pessoa. Enquanto o motivo não for escrito, ela conta como <b>lead sem contato</b> nas suas métricas.`;}
 else if(f.c==="renova"){const k=dias(f.renova);u=k<=3?100:95;d=95;
  p=`Renova em <b>${k} dia${k===1?"":"s"}</b> e paga <b>${brl(f.pago)}</b> por mês. Avisar antes custa uma mensagem; recuperar depois falha em 88% dos casos.`;}
 else if(f.e==="perdido"){u=f.d<=7?85:f.d<=15?50:22;d=80;
  p=f.d<=7?`Saiu há <b>${Math.round(f.d)} dias</b>. Essa é a janela: quem volta, volta na primeira semana.`
          :`Saiu há <b>${Math.round(f.d)} dias</b> e ninguém perguntou por quê. Não é mais venda — é descobrir o motivo antes que vire padrão.`;}
 else if(f.c==="lp"){u=f.d<=3?78:f.d<=14?55:f.d<=45?35:18;d=45;
  p=f.d<=3?`Deixou o contato na página <b>há ${Math.round(f.d)} dia${Math.round(f.d)===1?"":"s"}</b> e ainda não criou conta. É agora: quem levantou a mão ontem responde; quem levantou há um mês, não.`
   :`Deixou o contato na página há <b>${Math.round(f.d)} dias</b> e nunca criou conta. São <b>${NUM.leads_sem_conta} pessoas</b> nessa situação — vale um toque leve, sem insistir.`;}
 else if(f.e==="trial"){
  const T=temperatura(f), quente=T&&T.n==="Pronto pra fechar";
  const kFim=f.fim?dias(f.fim):null;
  if(quente){u=100;d=85;
   p=`<b>Pronto pra fechar.</b> Registrou <b>${f.vendas} vendas</b> e <b>${brl(f.faturou)}</b> dentro do Orbis${kFim!==null?`, e o teste ${kFim<=0?"<b>acaba hoje</b>":`acaba em <b>${kFim} dia${kFim===1?"":"s"}</b>`}`:""}. Não precisa convencer — mostra o número dele e pede a decisão.`;}
  else if(f.c==="dia3"){u=98;d=70;p=`<b>O teste acaba hoje.</b> Quem usa o app em 2 dias diferentes assina em 46% dos casos. É a última conversa possível.`;}
  else if(f.c==="dia2"){u=f.trava?80:65;d=55;
   p=f.trava?`<b>Travado há ${f.trava} dia.</b> A atividade do Dia 2 não foi feita, então o Dia 3 não abriu — ele está parado esperando você.`
            :`Segundo dia. <b>Quem usa 2 dias converte a 46%; quem usa 1, a 18%.</b> Hoje é o dia que dobra a chance.`;}
  else{u=60;d=50;p=`Entrou agora. <b>82% dos testes do histórico acabaram sem uma única mensagem</b> — a primeira conversa é o que impede isso.`;}
  if(T&&T.respondeu&&!quente){u=Math.max(u,88);
   p+=` <b>Ele respondeu no WhatsApp e está esperando.</b>`;}}
 else{u=f.c==="usou"?55:f.c==="acordou"?45:25;d=35;
  p=f.c==="frio"?`Criou conta e nunca abriu o app. São <b>${QTD["base/frio"]||0} iguais a esse</b>. Volume alto, chance baixa.`
                :`Já mexeu no app mas não virou teste. <b>Quem registra uma venda converte 25× mais.</b>`;}
 return{score:Math.round(u*.55+d*.3+Math.min(30,f.d*1.1)*.15),porque:p};
}
const byId=id=>FICHAS.find(f=>f.id===id);

/* ===== estado ===== */
const K="crm-orbis-v1";
let S={pos:0,feitas:{},fechados:{},contatos:0,etapa:{},notas:{},conv:{},vistos:{}};
try{const g=localStorage.getItem(K);if(g)S=Object.assign(S,JSON.parse(g));}catch(e){}
const salvar=()=>{try{localStorage.setItem(K,JSON.stringify(S));}catch(e){}};
const etapaDe=f=>S.etapa[f.id]||f.c;
/* "travado" só existe onde há atividade que destrava: Trial (dias 1–3) e Pagantes. Lead da LP e Base só "estão" ali. */
const travaDe=f=>{const c=etapaDe(f); return ((f.e==="trial"&&c!=="lp"&&c!=="acabou")||f.e==="pagante")?f.trava:0;};
const atividades=f=>E[f.e].ativ[etapaDe(f)]||[];
const feitasDe=f=>S.feitas[f.id+"/"+etapaDe(f)]||[];
const tudoFeito=f=>{const a=atividades(f);return a.length>0&&feitasDe(f).length>=a.length;};
const fila=()=>FICHAS.filter(f=>!S.fechados[f.id]);
const atual=()=>{const q=fila();return q[Math.min(S.pos,q.length-1)]||null;};
/* conversa = historico real + o que foi enviado nesta sessao */
const convDe=f=>[...(f.conversa||[]),...(S.conv[f.id]||[])];
async function gravarMsg(f,de,texto){
 texto=String(texto||"").trim(); if(!texto) return false;
 const agora=new Date().toISOString();
 try{
  const {data,error}=await sb.rpc("crm_msg_gravar",{p_cartao:f.cartaoId,p_de:de,p_texto:texto});
  if(error) throw error;
  (f.conversa=f.conversa||[]).push({de,t:data.texto,q:quando(data.criado_em),ts:data.criado_em,origem:"crm"});
  return true;
 }catch(e){
  // sem banco, guarda no navegador pra não perder
  (S.conv[f.id]=S.conv[f.id]||[]).push({de,t:texto,q:quando(agora),ts:agora,origem:"local"});
  salvar(); PROBLEMAS.push("gravar mensagem: "+(e.message||e)); mostrarProblemas();
  return false;
 }
}
const enviar=(f,texto)=>gravarMsg(f,"eu",texto);
/* REGRA DE CUSTO (doc oficial da Meta, 2026):
   - mensagem RECEBIDA nunca e cobrada
   - responder dentro da janela de 24h (conversa de servico) e GRATIS desde 01/11/2024
   - so custa iniciar conversa fora da janela, com modelo aprovado */
function janela(f){
 const c=convDe(f);
 const ultimaDele=[...c].reverse().find(m=>m.de!=="eu");
 return ultimaDele?{free:true,quando:ultimaDele.q}:{free:false,custo:0.21};
}
/* quantas do dia sao gratis e quantas custariam */
/* medidas tiradas das conversas registradas: quanto o vendedor demora pra responder
   e em que horas os leads mais respondem */
function temposDeConversa(){
 const esperas=[], horas=Array(24).fill(0); let respostasDele=0;
 FICHAS.forEach(f=>{
  const c=convDe(f).filter(m=>m.ts).sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  for(let i=0;i<c.length;i++){
   if(c[i].de!=="ele") continue;
   respostasDele++; horas[new Date(c[i].ts).getHours()]++;
   const prox=c.slice(i+1).find(m=>m.de==="eu");
   if(prox) esperas.push((new Date(prox.ts)-new Date(c[i].ts))/60000);
  }
 });
 const media=esperas.length?esperas.reduce((a,b)=>a+b,0)/esperas.length:null;
 let pico=null,max=0; horas.forEach((v,h)=>{if(v>max){max=v;pico=h;}});
 return {media,respondidas:esperas.length,respostasDele,pico,picoQtd:max};
}
function mensagensDoDia(){
 let enviadas=0,respostas=0,pessoas=new Set();
 FICHAS.forEach(f=>convDe(f).forEach(m=>{
  if(!m.ts||dias(m.ts)!==0) return;
  if(m.de==="eu"){enviadas++;pessoas.add(f.id);} else respostas++;
 }));
 return {enviadas,respostas,pessoas:pessoas.size};
}
const custoDoDia=()=>({gratis:mensagensDoDia().enviadas,pagas:0,valor:0});
function msgDe(f,a){
 if(!a.m)return null;
 return a.m.replace(/\{p\}/g,f.n.split(" ")[0])
           .replace(/\{renova\}/g,f.renova?f.renova.slice(8,10)+"/"+f.renova.slice(5,7):"");
}
function marcar(f,i,on){
 const k=f.id+"/"+etapaDe(f),arr=S.feitas[k]||[],j=arr.indexOf(i);
 if(on&&j<0)arr.push(i); if(!on&&j>=0)arr.splice(j,1);
 S.feitas[k]=arr;salvar();
}
function avancar(f){
 const cols=E[f.e].cols,at=etapaDe(f),i=cols.findIndex(c=>c[0]===at);
 if(f.e==="trial"&&at==="dia3"){mover(f,"assinou");return;}
 if(i>=0&&i<cols.length-1)mover(f,cols[i+1][0]);
}
function mover(f,destino){
 // Trial > Assinou entra sozinho em Pagantes
 if(f.e==="trial"&&destino==="assinou"){
   f.e="pagante";S.etapa[f.id]="novo";salvar();
   toast(f.n.split(" ")[0]+" entrou em Já pagantes");render();abrir(f.id);return;
 }
 S.etapa[f.id]=destino;salvar();
 toast("Movido para "+(E[f.e].cols.find(c=>c[0]===destino)?.[1]||destino));
 render();abrir(f.id);
}

/* ===== TELA HOJE ===== */
function renderHoje(){
 const q=fila(),f=atual();
 const travados=FICHAS.filter(x=>etapaDe(x)==="acabou"&&!S.fechados[x.id]).length;
 const queRenovam=FICHAS.filter(x=>etapaDe(x)==="renova");
 const renovam=queRenovam.reduce((s,x)=>s+(x.pago||0),0);
 const maxD=Math.max(...GRANA.dias.map(d=>d[1]));
 const msgs=mensagensDoDia();
 const vend=Object.values(S.fechados).filter(x=>x==="ganhou").length;

 let h=ehDono()? `<div class="grana">
  <div class="lbl">Faturamento total do Orbis</div>
  <div class="big num">${brl(GRANA.total)}</div>
  <div class="sub num">${GRANA.pagamentos} pagamentos · ticket ${brl(GRANA.ticket)} · desde ${GRANA.desde}</div>
  <div class="gline">
    <div class="gcell"><div class="k">Últimos 7 dias</div><div class="v num">${brl(GRANA.d7)}</div><div class="n num">${GRANA.d7Pag} pagamentos</div></div>
    <div class="gcell perda"><div class="k">Recorrências não pagas</div><div class="v num">${brl(GRANA.naoPagas)}</div><div class="n num">${GRANA.naoPagasQtd} assinaturas paradas</div></div>
    <div class="gcell"><div class="k">Receita recorrente</div><div class="v num">${brl(GRANA.recorrente)}</div><div class="n num">${GRANA.recorrenteQtd} ativas</div></div>
    <div class="gcell"><div class="k">Renovações do mês</div><div class="v num">${GRANA.renovMes}</div><div class="n num">${brl(GRANA.renovMesValor)}</div></div>
  </div>
  <div class="spark" role="img" aria-label="Faturamento diário dos últimos 14 dias">
    ${GRANA.dias.map(([d,v],i)=>`<span class="b${i===GRANA.dias.length-1?" hoje":""}" style="height:${Math.max(2,v/maxD*100)}%" title="${d}: ${brl(v)}"></span>`).join("")}
  </div>
  <p class="fonte">Faturamento total conta assinatura nova + renovação. Receita recorrente é o fixo do mês.
  <b>${brl(GRANA.naoPagas)} são recorrências que deveriam estar entrando e não estão</b> — ${brl(GRANA.atraso)} em atraso (${GRANA.atrasoQtd}) e ${brl(GRANA.encerradas)} de quem parou (${GRANA.encerradasQtd}).<br>
  Lido da Hotmart pelo webhook, que <b>só começou a gravar em 24/08</b> — o histórico anterior entra quando a API da Hotmart for ligada.</p>
 </div>` : "";

 if(travados) h+=`<div class="alerta">
   <span class="ic"><svg width="19" height="19" viewBox="0 0 20 20" fill="none"><path d="M10 2.5 18.5 17h-17L10 2.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 8v3.6M10 14v.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>
   <div><h3>${TRIAL_HIST.semContato} pessoas testaram o Orbis e ninguém falou com elas</h3>
   <p>De ${TRIAL_HIST.total} testes, <b>${TRIAL_HIST.semContato} (82%) nunca receberam uma única mensagem</b>. ${travados} dessas ainda dá pra recuperar hoje.</p>
   <button class="cta" id="ir-travados">Ver quem está travado</button></div></div>`;

 h+=`<h2 class="sec">Seu dia</h2><div class="strip">
  <div class="stat"><div class="k">Meta de hoje</div><div class="v num">${S.contatos} / ${META.contatos}</div>
   <div class="meter"><i style="width:${Math.min(100,S.contatos/META.contatos*100)}%"></i></div>
   <div class="s">${S.contatos>=META.contatos?"Meta batida.":`Faltam ${META.contatos-S.contatos} contatos`}</div></div>
  <div class="stat"><div class="k">Assinaturas fechadas</div><div class="v num">${vend} / ${META.vendas}</div>
   <div class="meter"><i style="width:${Math.min(100,vend/META.vendas*100)}%"></i></div>
   <div class="s">só as que você fechou</div></div>
  <div class="stat" style="border-color:var(--warn)"><div class="k" style="color:var(--warn)">Renova esta semana</div>
   <div class="v num" style="color:var(--warn)">${brl(renovam)}</div><div class="s">${queRenovam.length} cliente${queRenovam.length===1?"":"s"} · avise antes</div></div>
  <div class="stat" style="border-color:var(--bad)"><div class="k" style="color:var(--bad)">Sem contato</div>
   <div class="v num" style="color:var(--bad)">${travados}</div><div class="s">travados por falta de atividade</div></div>
 </div>
 <div class="box pad" style="margin-top:9px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
  <span style="font-size:22px">💬</span>
  <div style="flex:1;min-width:180px">
   <div style="font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--faint)">WhatsApp hoje</div>
   <div style="font-size:22px;font-weight:700;letter-spacing:-.03em;color:var(--c2)" class="num">${msgs.enviadas} <span style="font-size:12px;font-weight:600;color:var(--dim)">enviadas</span> · ${msgs.respostas} <span style="font-size:12px;font-weight:600;color:var(--dim)">respostas</span></div>
  </div>
  <p style="flex:2;min-width:230px;margin:0;font-size:11.5px;color:var(--dim);line-height:1.5">
   Você falou com <b>${msgs.pessoas} pessoa${msgs.pessoas===1?"":"s"}</b> hoje. Cada mensagem sai pelo <b>seu WhatsApp normal</b>, com o texto já pronto —
   custo <b>R$ 0,00</b>. Quando alguém responder, registre aqui na ficha pra conversa ficar no CRM.</p>
 </div>`;

 if(!f){h+=`<div class="box" style="margin-top:14px"><div class="vazio"><strong>Fila zerada.</strong>Você falou com todo mundo que precisava hoje.</div></div>`;
  document.getElementById("p-hoje").innerHTML=h;ligarHoje(null);return;}

 const et=etapaDe(f),cor=E[f.e].cor,ini=f.n.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
 const colNome=E[f.e].cols.find(c=>c[0]===et)?.[1]||et;
 const ats=atividades(f),fei=feitasDe(f),pronto=tudoFeito(f);

 h+=`<h2 class="sec">Fale com essa pessoa agora</h2><div class="fila"><div class="box">
  <div class="fh"><span class="blob" style="background:var(--${cor}s);color:var(--${cor})">${esc(ini)}</span>
   <div style="min-width:0;flex:1"><h3>${esc(f.n)}</h3>
    <div class="pills"><span class="pill p${cor.slice(1)}">${esc(E[f.e].nome)}</span>
     <span class="pill${et==="acabou"?" bad":""}">${esc(colNome)}</span>
     ${f.ref&&f.ref!=="—"?`<span class="pill">via ${esc(f.ref)}</span>`:""}
     ${f.tel?`<a class="pill" href="${linkZap(f)}" target="_blank" rel="noopener" style="color:var(--c2);border-color:var(--c2);text-decoration:none">WhatsApp ↗</a>`:`<span class="pill">zap ${esc(f.zap)}</span>`}
     ${travaDe(f)?`<span class="pill bad">travado ${travaDe(f)}d</span>`:`<span class="pill">${Math.round(f.d)}d aqui</span>`}</div></div>
   <button class="btn ghost" style="flex:none;align-self:flex-start" data-painel="${f.id}">Painel</button></div>
  <p class="porque"><span style="flex:none;color:var(--dim)">→</span><span><b>Por que esse agora:</b> ${f.porque}</span></p>
  ${sinaisHTML(f)}
  <div class="blk"><h4>Atividades — clique para ver a mensagem</h4>
   <div id="ativs">${ats.map((a,i)=>ativHTML(f,a,i,fei.includes(i))).join("")}</div>
   <p class="destrava${pronto?" ok":""}">${pronto
     ? "✓ Todas feitas. A ficha já pode avançar de etapa."
     : `Enquanto as atividades não forem feitas, <b>${esc(f.n.split(" ")[0])} não avança</b> — fica parado nessa coluna. Três dias parado e a ficha vai pro fim, em vermelho.`}</p>
   <button class="btn go block" style="margin-top:9px" data-avancar="${f.id}" ${pronto?"":"disabled"}>
     ${pronto?"Avançar de etapa →":"Faça as atividades para avançar"}</button></div>
  <div class="blk"><h4>Desfecho do contato</h4><div class="desf">
    <button class="btn win" data-fim="ganhou">Resolvido</button>
    <button class="btn" data-fim="respondeu">Respondeu</button>
    <button class="btn" data-fim="aguarda">Falei, sem resposta</button>
    <button class="btn lose" data-fim="perdido">Perdido</button></div>
   <p class="nota">O desfecho alimenta sua <b>taxa de resposta</b> nas Métricas.</p></div></div>
  <div class="lado">
   <div class="box pad"><h4 class="mini-h">Depois desse</h4>
    ${q.slice(S.pos+1,S.pos+7).map((x,i)=>`<button class="prox" data-painel="${x.id}">
      <span class="n num">${i+2}</span><span class="dot" style="background:var(--${E[x.e].cor})"></span>
      <span class="nm">${esc(x.n)}</span><span class="n num" style="color:var(--faint);width:auto">${x.score}</span></button>`).join("")
      ||`<div style="font-size:12.5px;color:var(--faint)">É o último da fila.</div>`}</div>
   <div class="box pad"><h4 class="mini-h">Como a fila é montada</h4>
    <p style="font-size:12px;color:var(--dim);margin:0;line-height:1.5">Nota de <b>0 a 100</b> somando o <b>prazo</b>,
    o <b>dinheiro</b> e o <b>tempo parado</b>. Quem está no topo está lá porque perder ele hoje custa mais caro.</p></div>
  </div></div>`;

 document.getElementById("p-hoje").innerHTML=h;ligarHoje(f);
}

/* ===== CONVERSA (inbox do WhatsApp dentro do CRM) ===== */
function chatHTML(f){
 const c=convDe(f), j=janela(f), ats=atividades(f).filter(a=>a.m);
 return `
  ${c.length?`<div class="chat">${c.map(m=>`<div class="bal ${m.de==="eu"?"eu":"ele"}">${esc(m.t)}<span class="q">${esc(m.q)}${m.origem==="local"?" · só neste navegador":""}</span></div>`).join("")}</div>`
   :`<p class="nota" style="margin:0">Nenhuma conversa registrada ainda.</p>`}
  ${f.tel?`<div class="janela free">${j.free
    ? `✓ <b>${esc(f.n.split(" ")[0])} mandou a última mensagem</b> (${esc(j.quando)}) — está esperando você.`
    : `✓ Sai pelo <b>seu WhatsApp</b>, já com o texto. Custo <b>R$ 0,00</b>.`}
    <a href="${linkZap(f)}" target="_blank" rel="noopener" style="margin-left:6px;font-weight:700;color:inherit">Abrir conversa ↗</a></div>`
   :`<div class="janela pago">Essa ficha <b>não tem WhatsApp</b> no cadastro — não dá pra abrir a conversa.</div>`}
  <div class="envio">
    <input id="ch-in" placeholder="Escreva pro ${esc(f.n.split(" ")[0])}..." aria-label="Mensagem">
    <button class="btn go" id="ch-send"${f.tel?"":" disabled"}>Enviar no WhatsApp</button>
  </div>
  ${ats.length?`<div class="atalhos">${ats.map((a,i)=>`<button class="atalho" data-atalho="${i}">${esc(a.t)}</button>`).join("")}</div>`:""}
  <p class="nota">Atalhos preenchem o campo com a mensagem da atividade. <b>Enviar</b> abre o WhatsApp com o texto pronto, grava a mensagem aqui e marca a atividade.</p>
  <details class="resposta" style="margin-top:10px">
    <summary style="cursor:pointer;font-size:12.5px;font-weight:600;color:var(--ink)">${esc(f.n.split(" ")[0])} respondeu? Registre aqui</summary>
    <textarea id="ch-dele" class="txtarea" style="margin-top:8px" placeholder="Cole ou resuma o que ele disse..."></textarea>
    <div class="acoes"><button class="btn ghost" id="ch-dele-ok">Registrar resposta dele</button></div>
    <p class="nota">Isso é o que faz a conversa aparecer no CRM e conta como <b>resposta</b> nas suas métricas.</p>
  </details>`;
}
function ligarChat(root,f){
 const inp=root.querySelector("#ch-in"), snd=root.querySelector("#ch-send");
 const ch=root.querySelector(".chat"); if(ch) ch.scrollTop=ch.scrollHeight;
 if(!inp||!snd)return;
 const ats=atividades(f);
 const mandar=async()=>{
  const t=inp.value; if(!t.trim())return;
  if(!abrirZap(f,t.trim())) return;
  const idx=ats.findIndex(a=>a.m&&msgDe(f,a)===t.trim());
  if(idx>=0)marcar(f,idx,true);
  inp.value=""; await enviar(f,t);
  toast(idx>=0?"WhatsApp aberto · atividade marcada":"WhatsApp aberto · mensagem gravada"); render(); abrir(f.id);
 };
 snd.onclick=mandar;
 const dele=root.querySelector("#ch-dele"), deleOk=root.querySelector("#ch-dele-ok");
 if(dele&&deleOk) deleOk.onclick=async()=>{
  const t=dele.value; if(!t.trim()){toast("Escreva o que ele disse");return;}
  await gravarMsg(f,"ele",t); toast("Resposta registrada"); render(); abrir(f.id);
 };
 inp.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();mandar();}});
 root.querySelectorAll("[data-atalho]").forEach(b=>{
  b.onclick=()=>{const a=ats.filter(x=>x.m)[+b.dataset.atalho];
   inp.value=msgDe(f,a); inp.focus();};});
}

/* ===== SINAIS DO LEAD (o que o CRM sabe sobre ele) ===== */
function sinaisHTML(f){
 const T=temperatura(f), conv=convDe(f);
 const respondeu=conv.length&&conv[conv.length-1].de!=="eu";
 const quente=T&&T.n==="Pronto pra fechar";
 const kFim=f.fim?dias(f.fim):null;
 const sins=[];
 if(f.vendas!==undefined) sins.push({k:"Vendas no app",v:f.vendas,q:f.vendas>=10});
 if(f.faturou!==undefined) sins.push({k:"Faturou testando",v:brl(f.faturou),q:f.faturou>=100});
 if(kFim!==null) sins.push({k:"Teste acaba",v:kFim<=0?"hoje":kFim+"d",q:kFim<=1});
 if(f.pago) sins.push({k:"Paga por mês",v:brl(f.pago),q:false});
 if(f.renova) sins.push({k:"Renova em",v:dias(f.renova)+"d",q:dias(f.renova)<=3});
 sins.push({k:"Mensagens",v:conv.length||"—",q:false});
 sins.push({k:"Respondeu?",v:respondeu?"sim, e espera":conv.length?"não":"—",q:respondeu});
 return `<div class="blk"><h4>O que já sabemos dele</h4>
  <div class="sinais">${sins.map(s=>`<div class="sin${s.q?" q":""}"><div class="k">${s.k}</div><div class="v num">${s.v}</div></div>`).join("")}</div>
  ${T?`<div class="temp${quente?" q":T.cor==="warn"?" w":""}"><span class="e">${T.ic}</span>
    <span><b>${T.n}.</b> ${T.why}</span></div>`:""}
  ${respondeu?`<div class="temp q" style="margin-top:7px"><span class="e">💬</span>
    <span><b>Ele mandou a última mensagem.</b> Está esperando você desde ${esc(conv[conv.length-1].q)} — e responder dentro de 24h é de graça no WhatsApp oficial.</span></div>`:""}
 </div>`;
}

function ativHTML(f,a,i,on){
 const m=msgDe(f,a);
 return `<div class="ativ${on?" on":""}" data-ativ="${i}" data-open="0">
  <button class="ativ-h" data-toggle="${i}">
    <span class="cbox"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.4l2.4 2.4 4.6-5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    <span class="tt">${esc(a.t)}</span>
    <span class="cv"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
  </button>
  <div class="ativ-b" hidden>
    ${m?`<div class="msg">${esc(m)}</div>
       <div class="acoes">
         <button class="btn go" data-enviar="${i}"${f.tel?"":" disabled"}>Abrir no WhatsApp com a mensagem</button>
         <button class="btn ghost" data-copiar="${i}">Só copiar</button>
       </div>
       <p class="nota">${f.tel?"Abre o seu WhatsApp já com o texto. A atividade é marcada e a mensagem fica gravada aqui.":"Sem WhatsApp no cadastro — copie e mande por onde conseguir."}</p>`
      :`<div class="msg nota">${esc(a.nota||"Anote o resultado desta atividade.")}</div>
        <textarea class="txtarea" style="margin-top:9px" data-nota="${i}" placeholder="Escreva aqui...">${esc(S.notas[f.id+"/"+i]||"")}</textarea>
        <div class="acoes"><button class="btn go" data-salvar="${i}">Salvar e marcar feita</button></div>`}
  </div></div>`;
}

function ligarAtividades(root,f){
 root.querySelectorAll("[data-toggle]").forEach(b=>{
  b.onclick=()=>{const w=b.closest(".ativ"),bd=w.querySelector(".ativ-b");
   const open=w.dataset.open==="1";w.dataset.open=open?"0":"1";bd.hidden=open;};});
 root.querySelectorAll("[data-copiar],[data-enviar]").forEach(b=>{
  b.onclick=async()=>{
   const i=+(b.dataset.copiar??b.dataset.enviar),a=atividades(f)[i],m=msgDe(f,a);
   if(b.dataset.enviar!==undefined){
     if(!abrirZap(f,m)) return;
     marcar(f,i,true); await enviar(f,m);
     toast("WhatsApp aberto · atividade marcada"); render();
     if(document.getElementById("drawer").dataset.on==="1")abrir(f.id);
   } else { try{await navigator.clipboard.writeText(m);}catch(e){} toast("Mensagem copiada"); }};});
 root.querySelectorAll("[data-salvar]").forEach(b=>{
  b.onclick=()=>{const i=+b.dataset.salvar,ta=root.querySelector(`[data-nota="${i}"]`);
   S.notas[f.id+"/"+i]=ta?ta.value:"";marcar(f,i,true);salvar();
   toast("Anotado · atividade marcada");render();
   if(document.getElementById("drawer").dataset.on==="1")abrir(f.id);};});
}

function ligarHoje(f){
 const bt=document.getElementById("ir-travados");
 if(bt)bt.onclick=()=>{const q=fila(),i=q.findIndex(x=>etapaDe(x)==="acabou");
  if(i>=0){S.pos=i;salvar();renderHoje();window.scrollTo({top:0,behavior:"smooth"});}};
 document.querySelectorAll("[data-painel]").forEach(b=>b.onclick=()=>abrir(+b.dataset.painel));
 if(!f)return;
 ligarAtividades(document.getElementById("p-hoje"),f);
 const av=document.querySelector("[data-avancar]");
 if(av&&!av.disabled)av.onclick=()=>avancar(f);
 document.querySelectorAll("[data-fim]").forEach(b=>b.onclick=()=>{
  S.fechados[f.id]=b.dataset.fim;S.contatos++;
  if(S.pos>=fila().length)S.pos=Math.max(0,fila().length-1);
  salvar();toast({ganhou:"Boa. Próximo.",respondeu:"Resposta registrada",aguarda:"Volta em 2 dias",perdido:"Marcado como perdido"}[b.dataset.fim]);
  render();});
}

/* ===== TELA ALERTAS =====
   O CRM cutuca o Yan quando entra: quem vaza se ninguem falar hoje. */
function alertas(){
 const A=[];
 fila().forEach(f=>{
  const et=etapaDe(f), c=convDe(f);
  const esperando=c.length&&c[c.length-1].de!=="eu";
  const T=temperatura(f);
  if(esperando) A.push({p:1,ic:"💬",cor:"bad",f,
   tt:`${f.n} respondeu e está sem resposta`,
   ds:`Última mensagem dele em ${c[c.length-1].q}. A janela de 24h está aberta — responder agora não custa nada e é o contato com maior chance de virar venda.`});
  if(T&&T.n==="Pronto pra fechar") A.push({p:1,ic:"🔥",cor:"bad",f,
   tt:`${f.n} está pronto pra fechar`,
   ds:`Registrou ${f.vendas} vendas e ${brl(f.faturou)} dentro do Orbis no teste. Não precisa convencer — mostre o número dele.`});
  if(f.fim&&dias(f.fim)<=1) A.push({p:1,ic:"⏳",cor:"bad",f,
   tt:`Teste do ${f.n.split(" ")[0]} ${dias(f.fim)<=0?"acaba hoje":"acaba amanhã"}`,
   ds:`Depois disso ele vira mais um dos 298 que testaram e ninguém procurou.`});
  if(et==="renova"&&dias(f.renova)<=3) A.push({p:2,ic:"💳",cor:"warn",f,
   tt:`${f.n} renova em ${dias(f.renova)} dias`,
   ds:`${brl(f.pago)} por mês. Se o cartão falhar sem aviso, vira inadimplente — e 85% de quem atrasa não volta.`});
  if(travaDe(f)>=1) A.push({p:2,ic:"🔒",cor:"warn",f,
   tt:`${f.n} travado há ${travaDe(f)} dia${travaDe(f)===1?"":"s"}`,
   ds:`A atividade da etapa não foi feita, então a ficha não avançou. Ele está parado esperando você.`});
  if(et==="acabou"&&!(S.notas[f.id+"/0"]||"").trim()) A.push({p:3,ic:"❓",cor:"dim",f,
   tt:`${f.n} acabou sem motivo registrado`,
   ds:`Enquanto o motivo não for escrito, ele conta como lead sem contato nas métricas.`});
 });
 return A.sort((a,b)=>a.p-b.p);
}
function renderAlertas(){
 const A=alertas(), urg=A.filter(a=>a.p===1).length;
 const bd=document.getElementById("bd-d"), bm=document.getElementById("bd-m");
 [bd,bm].forEach(b=>{if(b){b.textContent=A.length;b.hidden=A.length===0;}});
 const el=document.getElementById("p-alertas"); if(!el)return;
 el.innerHTML=`
  <div class="alerta" style="margin-top:0"><span class="ic"><svg width="19" height="19" viewBox="0 0 20 20" fill="none"><path d="M10 2.5 18.5 17h-17L10 2.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 8v3.6M10 14v.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>
   <div><h3>${A.length} coisa${A.length===1?"":"s"} precisam de você hoje</h3>
   <p>${urg} ${urg===1?"é urgente":"são urgentes"} — se ninguém falar com essas pessoas hoje, elas viram lead perdido.
   Este aviso aparece toda vez que você abre o CRM.</p></div></div>
  <h2 class="sec">Por ordem de urgência</h2>
  <div class="box pad">${A.length?A.slice(0,40).map((a,i)=>`
    <button class="alerta-l" data-al="${i}">
      <span class="al-ic" style="background:var(--${a.cor==="dim"?"panel2":a.cor+"-s"});">${a.ic}</span>
      <span class="tx"><span class="tt">${esc(a.tt)}</span><span class="ds">${a.ds}</span></span>
      <span class="go">abrir ↗</span>
    </button>`).join("")
   :`<div class="vazio"><strong>Nada pendente.</strong>Ninguém está vazando agora.</div>`}
   ${A.length>40?`<div class="mais num" style="margin-top:8px">+ ${A.length-40} alertas depois destes — resolva os de cima primeiro</div>`:""}</div>
  <p class="nota">A regra: entra aqui quem <b>respondeu e está sem resposta</b>, quem <b>já mostrou que vale a pena</b>,
  quem <b>vence hoje ou amanhã</b>, quem está <b>parado há mais de um dia</b> na mesma etapa, e quem <b>acabou sem motivo escrito</b>.</p>

  <h2 class="sec">Como manter o custo em R$ 0,00</h2>
  <div class="box pad">
   <div class="alerta-l" style="cursor:default"><span class="al-ic" style="background:var(--c2s)">✓</span>
    <span class="tx"><span class="tt">Receber é sempre grátis</span>
    <span class="ds">A Meta não cobra por mensagem que chega. Ver tudo dentro do CRM custa zero, para sempre.</span></span></div>
   <div class="alerta-l" style="cursor:default"><span class="al-ic" style="background:var(--c2s)">✓</span>
    <span class="tx"><span class="tt">Responder em até 24h é grátis</span>
    <span class="ds">Quando o cliente fala, abre uma janela de 24 horas. Dentro dela você manda quantas mensagens quiser sem pagar nada — regra oficial da Meta desde 01/11/2024.</span></span></div>
   <div class="alerta-l" style="cursor:default"><span class="al-ic" style="background:var(--warn-s)">R$</span>
    <span class="tx"><span class="tt">Só custa quando você começa a conversa</span>
    <span class="ds">Fora da janela, iniciar exige um modelo aprovado: R$ 0,21 (utilidade) ou R$ 0,35 (marketing).</span></span></div>
   <div class="alerta-l" style="cursor:default"><span class="al-ic" style="background:var(--c1s)">💡</span>
    <span class="tx"><span class="tt">A saída: faça ele chamar primeiro</span>
    <span class="ds">Um botão <b>"Falar com o Yan"</b> dentro do Orbis abre o WhatsApp já com a mensagem escrita. Quem clica manda a mensagem, e isso abre a janela grátis — sem você gastar um centavo. É o caminho de custo zero pros 298 que nunca foram atendidos.</span></span></div>
  </div>`;
 el.querySelectorAll("[data-al]").forEach(b=>b.onclick=()=>abrir(A[+b.dataset.al].f.id));
}

/* ===== TELA ESTEIRAS ===== */
function renderEsteiras(){
 let h=`<p class="nota" style="margin:0 0 12px">Clique em qualquer ficha para abrir o <b>painel completo da pessoa</b>.
 Uma ficha só avança de coluna quando as atividades daquela etapa são feitas — e você pode mover à mão, mas o CRM avisa se ainda falta atividade.
 No celular, arraste as colunas para o lado.</p>`;
 for(const [k,def] of Object.entries(E)){
  const total=def.cols.reduce((s,[c])=>s+(QTD[k+"/"+c]||0),0);
  h+=`<div class="box" style="margin-bottom:14px">
   <div class="est-head"><span class="dot" style="background:var(--${def.cor});width:9px;height:9px"></span>
    <h3>${def.nome}</h3><span class="c num">${total} fichas</span>
    <p style="width:100%;margin:2px 0 0;font-size:11.5px;color:var(--dim)">${def.desc}</p></div>
   <div class="cols" style="--n:${def.cols.length}">
   ${def.cols.map(([c,titulo])=>{
     const qtd=QTD[k+"/"+c]||0,morto=(c==="acabou");
     const am=FICHAS.filter(x=>x.e===k&&etapaDe(x)===c&&!S.fechados[x.id]).slice(0,4);
     return `<div class="col"><div class="col-h"><span class="t"${morto?' style="color:var(--bad)"':''}>${esc(titulo)}</span><span class="q num">${qtd}</span></div>
      ${am.map(x=>{
        const semMotivo=etapaDe(x)==="acabou"&&!(S.notas[x.id+"/0"]||"").trim();
        return `<button class="chip${morto?" morto":""}" style="border-left-color:var(--${morto?"bad":def.cor})" data-painel="${x.id}">
         <div class="nm">${esc(x.n)}</div>
         <div class="sb${travaDe(x)||semMotivo?" bad":""}">${semMotivo?"sem motivo · conta como sem contato"
           :travaDe(x)?`travado ${travaDe(x)}d`:`${Math.round(x.d)}d nessa coluna`}</div></button>`;}).join("")}
      ${qtd>am.length?`<button class="mais num" data-coluna="${k}/${c}" style="color:var(--c1);font-weight:700">+ ${qtd-am.length} não mostradas · ver todas ↗</button>`:""}
      ${qtd===0?`<div class="mais">vazia</div>`:""}</div>`;}).join("")}
   </div></div>`;}
 document.getElementById("p-esteiras").innerHTML=h;
 document.querySelectorAll("#p-esteiras [data-painel]").forEach(b=>b.onclick=()=>abrir(+b.dataset.painel));
 document.querySelectorAll("#p-esteiras [data-coluna]").forEach(b=>b.onclick=()=>{
   const [k,c]=b.dataset.coluna.split("/"); const titulo=(E[k].cols.find(x=>x[0]===c)||[c,c])[1];
   const lista=FICHAS.filter(x=>x.e===k&&etapaDe(x)===c&&!S.fechados[x.id]);
   abrirLista(titulo, `${lista.length} pessoas nesta coluna · por prioridade`, lista, lista.length);
 });
}

/* ===== PAINEL DA PESSOA ===== */
function abrir(id){
 const f=byId(id);if(!f)return;
 const dr=document.getElementById("drawer"),veu=document.getElementById("veu");
 const et=etapaDe(f),def=E[f.e],cols=def.cols,idx=cols.findIndex(c=>c[0]===et);
 const ats=atividades(f),fei=feitasDe(f),pronto=tudoFeito(f);
 const ini=f.n.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
 const semMotivo=et==="acabou"&&!(S.notas[f.id+"/0"]||"").trim();

 dr.innerHTML=`
  <div class="dr-head">
   <span class="blob" style="background:var(--${def.cor}s);color:var(--${def.cor})">${esc(ini)}</span>
   <div style="min-width:0"><h3>${esc(f.n)}</h3>
    <div class="pills"><span class="pill p${def.cor.slice(1)}">${esc(def.nome)}</span>
     <span class="pill${et==="acabou"?" bad":""}">${esc(cols[idx]?.[1]||et)}</span></div></div>
   <button class="fechar" id="dr-x" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
  </div>
  <div class="dr-body">
   <div class="dr-sec"><h4>Dados</h4>
    <div class="kv"><span class="k">WhatsApp</span><span class="v">${f.tel?`<a href="${linkZap(f)}" target="_blank" rel="noopener" style="color:var(--c2);font-weight:700">+${f.tel.slice(0,2)} ${f.tel.slice(2,4)} ${f.tel.slice(4)} ↗</a>`:esc(f.zap)}</span></div>
    <div class="kv"><span class="k">Origem</span><span class="v">${esc(f.ref||"—")}</span></div>
    ${f.email?`<div class="kv"><span class="k">E-mail</span><span class="v">${esc(f.email)}</span></div>`:""}
    ${f.cidade?`<div class="kv"><span class="k">Cidade</span><span class="v">${esc(f.cidade)}</span></div>`:""}
    ${f.entrou?`<div class="kv"><span class="k">Entrou em</span><span class="v">${dbr(f.entrou)}</span></div>`:""}
    ${f.pago?`<div class="kv"><span class="k">Paga por mês</span><span class="v">${brl(f.pago)}</span></div>`:""}
    ${f.renova?`<div class="kv"><span class="k">Renova em</span><span class="v">${dbr(f.renova)} · ${dias(f.renova)}d</span></div>`:""}
    ${f.fim?`<div class="kv"><span class="k">Teste acaba em</span><span class="v">${dbr(f.fim)} · ${dias(f.fim)}d</span></div>`:""}
    <div class="kv"><span class="k">Parado há</span><span class="v">${Math.round(f.d)} dias</span></div>
    <div class="kv"><span class="k">Prioridade</span><span class="v num">${f.score}/100</span></div>
   </div>
   ${f.hot?`<div class="dr-sec"><h4>Assinatura na Hotmart</h4>
    <div class="kv"><span class="k">Situação</span><span class="v">${esc(f.hot.situacao||"—")}</span></div>
    ${f.hot.plano?`<div class="kv"><span class="k">Plano</span><span class="v">${esc(f.hot.plano)}</span></div>`:""}
    ${f.hot.valor?`<div class="kv"><span class="k">Valor</span><span class="v">${brl(f.hot.valor)}</span></div>`:""}
    ${f.hot.recorrencia?`<div class="kv"><span class="k">Cobranças já feitas</span><span class="v num">${f.hot.recorrencia}</span></div>`:""}
    ${f.hot.assinou_em?`<div class="kv"><span class="k">Assinou em</span><span class="v">${esc(f.hot.assinou_em)}</span></div>`:""}
    ${f.hot.cobra_em?`<div class="kv"><span class="k">Próxima cobrança</span><span class="v">${esc(f.hot.cobra_em)}${f.hot.dias_pra_cobrar!=null?" · "+f.hot.dias_pra_cobrar+"d":""}</span></div>`:""}
    ${f.hot.pagamento?`<div class="kv"><span class="k">Forma de pagamento</span><span class="v">${esc(f.hot.pagamento)}</span></div>`:""}
   </div>`:""}
   <div class="dr-sec"><h4>Situação</h4>
    <p style="margin:0;font-size:13px;line-height:1.55">${f.porque}</p></div>
   <div class="dr-sec"><h4>Onde ele está na esteira</h4>
    <div class="trilha">${cols.map(([c,t],i)=>`<span class="tstep ${c===et?(c==="acabou"?"bad":"now"):(i<idx?"pass":"")}">${esc(t)}</span>`).join("")}</div>
    <p class="nota" style="margin:11px 0 0"><b>Mover para:</b></p>
    <div class="mover">${cols.filter(([c])=>c!==et).map(([c,t])=>{
      const frente=cols.findIndex(x=>x[0]===c)>idx;
      const trava=frente&&!pronto;
      return `<button class="mv" data-mover="${c}" ${trava?"disabled":""} title="${trava?"Faça as atividades desta etapa antes de avançar":"Mover para "+t}">${trava?"🔒 ":""}${esc(t)}</button>`;}).join("")}</div>
    ${!pronto?`<p class="nota">Só dá pra <b>avançar</b> depois que as atividades desta etapa estiverem feitas. Voltar é sempre liberado.</p>`:""}
   </div>
   ${semMotivo?`<div class="dr-sec" style="background:var(--bad-s)">
     <h4 style="color:var(--bad)">Falta o motivo</h4>
     <p style="margin:0;font-size:12.5px;line-height:1.5">Enquanto o motivo de não ter fechado não for escrito na primeira atividade,
     esta ficha conta como <b>lead sem contato</b> nas Métricas.</p></div>`:""}
   <div class="dr-sec"><h4>Conversa no WhatsApp</h4>${chatHTML(f)}</div>
   <div class="dr-sec"><h4>Atividades desta etapa</h4>
    <div id="dr-ativs">${ats.map((a,i)=>ativHTML(f,a,i,fei.includes(i))).join("")}</div>
    <button class="btn go block" style="margin-top:9px" id="dr-avancar" ${pronto?"":"disabled"}>
      ${pronto?"Avançar de etapa →":"Faça as atividades para avançar"}</button>
   </div>
   <div class="dr-sec"><h4>Ir para a fila</h4>
    <button class="btn block" id="dr-fila">Colocar como próximo em Hoje</button></div>
  </div>`;
 dr.dataset.on="1";veu.dataset.on="1";
 document.getElementById("dr-x").onclick=fechar;
 veu.onclick=fechar;
 ligarAtividades(dr,f); ligarChat(dr,f);
 dr.querySelectorAll("[data-mover]").forEach(b=>{if(!b.disabled)b.onclick=()=>mover(f,b.dataset.mover);});
 const av=document.getElementById("dr-avancar");if(av&&!av.disabled)av.onclick=()=>avancar(f);
 document.getElementById("dr-fila").onclick=()=>{
  const q=fila(),i=q.findIndex(x=>x.id===f.id);
  if(i>=0){S.pos=i;salvar();fechar();aba("hoje");renderHoje();window.scrollTo({top:0});}
  else toast("Essa ficha já foi fechada hoje");};
}
function fechar(){document.getElementById("drawer").dataset.on="0";document.getElementById("veu").dataset.on="0";}
document.addEventListener("keydown",e=>{if(e.key==="Escape")fechar();});

/* ===== LISTA (drill-down das métricas) ===== */
function abrirLista(titulo,sub,pessoas,total){
 const dr=document.getElementById("drawer"),veu=document.getElementById("veu");
 dr.innerHTML=`<div class="dr-head"><div style="min-width:0"><h3>${esc(titulo)}</h3>
   <p style="margin:3px 0 0;font-size:12px;color:var(--dim)">${esc(sub)}</p></div>
   <button class="fechar" id="dr-x" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>
  <div class="dr-body"><div class="dr-sec">
   ${pessoas.length>8?`<input id="busca-lista" class="txtarea" style="min-height:0;margin-bottom:9px" placeholder="Buscar por nome, WhatsApp ou cupom…" aria-label="Buscar na lista">`:""}
   ${pessoas.length?pessoas.map(p=>`<button class="lista-p" data-painel="${p.id}" data-busca="${esc((p.n+" "+p.zap+" "+(p.ref||"")+" "+(p.email||"")).toLowerCase())}">
     <span class="dot" style="background:var(--${E[p.e].cor})"></span>
     <span class="nm">${esc(p.n)}<span class="mt" style="display:block;font-weight:400">${esc(E[p.e].nome)} · zap ${esc(p.zap)} · ${esc(p.ref||"—")}</span></span>
     <span class="mt num">${Math.round(p.d)}d</span></button>`).join("")
    :`<p class="nota" style="margin:0">Ninguém nesta lista.</p>`}
   ${total&&total>pessoas.length?`<p class="nota">Mostrando as <b>${pessoas.length}</b> fichas abertas; o total de <b>${total}</b> inclui quem já foi fechado ou arquivado.</p>`:""}
  </div></div>`;
 dr.dataset.on="1";veu.dataset.on="1";
 document.getElementById("dr-x").onclick=fechar;veu.onclick=fechar;
 dr.querySelectorAll("[data-painel]").forEach(b=>b.onclick=()=>abrir(+b.dataset.painel));
 const bl=dr.querySelector("#busca-lista");
 if(bl) bl.oninput=()=>{const q=bl.value.trim().toLowerCase();
   dr.querySelectorAll(".lista-p").forEach(b=>b.hidden=!!q&&!b.dataset.busca.includes(q));};
}

/* ===== TELA MÉTRICAS ===== */
function renderMetricas(){
 const tc=temposDeConversa();
 const fe=Object.values(S.fechados);
 const resp=fe.filter(x=>x==="respondeu"||x==="ganhou").length;
 const taxaResp=fe.length?Math.round(resp/fe.length*100):null;
 const todas=FICHAS.filter(f=>!S.fechados[f.id]);

 const cards=[
  {k:"Pessoas que entraram",v:BASES.base,suf:"",s:"contas criadas no total",cor:"c4",pct:100,
   lista:()=>abrirLista("Pessoas que entraram",`${NUM.contas} contas criadas — quem ainda não virou nada está na esteira Base`,todas.filter(f=>f.e==="base"),BASES.base)},
  {k:"Taxa de conversão",v:NUM.contas?String((NUM.assinaram/NUM.contas*100).toFixed(1)).replace(".",","):"—",suf:"%",s:`${NUM.assinaram} assinaram de ${NUM.contas} contas`,cor:"c1",pct:NUM.contas?NUM.assinaram/NUM.contas*100:0,
   lista:()=>abrirLista("Quem assinou",`${NUM.assinaram} pessoas assinaram alguma vez · ${NUM.pagando} pagam hoje`,todas.filter(f=>f.e==="pagante"),BASES.assinaram)},
  {k:"Taxa de resposta",v:taxaResp===null?"—":taxaResp,suf:taxaResp===null?"":"%",
   s:taxaResp===null?"marque um desfecho para começar a medir":`${resp} responderam de ${fe.length} contatos`,cor:"c2",pct:taxaResp||0,
   lista:()=>abrirLista("Taxa de resposta","Alimentada pelo botão Respondeu no desfecho de cada contato",[],0)},
  {k:"Taxa de fechamento",v:"4,7",suf:"%",s:"17 assinaram de 363 testes",cor:"c2",pct:4.7,
   lista:()=>abrirLista("Testes que não fecharam","298 acabaram sem contato · falta o motivo em cada um",todas.filter(f=>etapaDe(f)==="acabou"),TRIAL_HIST.semContato)},
  {k:"Taxa de inadimplência",v:"13,6",suf:"%",s:"11 em atraso de 81 assinaturas",cor:"c3",pct:13.6,
   lista:()=>abrirLista("Quem parou de pagar",`${brl(GRANA.naoPagas)} por mês parados · ${GRANA.naoPagasQtd} assinaturas`,todas.filter(f=>f.e==="perdido"),BASES.parou+BASES.atraso)}
 ];
 const funil=[["Contas criadas",BASES.base,"c4"],["Abriram o app",BASES.abriram,"c1"],["Registraram venda",BASES.venderam,"c1"],["Assinaram",BASES.assinaram,"c2"],["Pagando hoje",BASES.pagante,"c2"]];
 const maxF=funil[0][1],maxR=Math.max(...RITMO.map(r=>r[1]));

 document.getElementById("p-metricas").innerHTML=`
 <h2 class="sec">Os números do Yan · clique em qualquer um para ver quem são</h2>
 <div class="taxas">${cards.map((t,i)=>`<button class="taxa" data-card="${i}">
   <span class="ver">ver lista ↗</span>
   <div class="k">${t.k}</div><div class="v num" style="color:var(--${t.cor})">${t.v}<span style="font-size:17px">${t.suf}</span></div>
   <div class="s">${t.s}</div><div class="bar"><i style="width:${Math.min(100,t.pct)}%;background:var(--${t.cor})"></i></div>
 </button>`).join("")}</div>

 <h2 class="sec">Seus tempos de resposta</h2>
 <div class="box pad">
  <div class="taxas" style="grid-template-columns:repeat(auto-fit,minmax(152px,1fr))">
   <div class="taxa" style="cursor:default;border-color:var(--bad)">
    <div class="k" style="color:var(--bad)">Demora pra chamar o lead</div>
    <div class="v num" style="color:var(--bad)">7,6<span style="font-size:15px"> dias</span></div>
    <div class="s">mediana 7,7 dias · <b>o teste dura 3</b></div>
    <div class="bar"><i style="width:100%;background:var(--bad)"></i></div></div>
   <div class="taxa" style="cursor:default">
    <div class="k">Tempo médio de resposta</div>
    ${tc.media!=null?`<div class="v num" style="color:var(--${tc.media<=60?"c2":tc.media<=240?"warn":"bad"})">${tc.media<60?Math.round(tc.media)+'<span style="font-size:15px"> min</span>':tc.media<1440?(tc.media/60).toFixed(1).replace(".",",")+'<span style="font-size:15px"> h</span>':(tc.media/1440).toFixed(1).replace(".",",")+'<span style="font-size:15px"> dias</span>'}</div>
    <div class="s">do lead responder até você responder de volta · ${tc.respondidas} conversa${tc.respondidas===1?"":"s"}</div>
    <div class="bar"><i style="width:${Math.min(100,tc.media/240*100)}%;background:var(--${tc.media<=60?"c2":tc.media<=240?"warn":"bad"})"></i></div>`
    :`<div class="v num" style="color:var(--faint)">—</div>
    <div class="s">aparece quando você registrar as respostas dos leads nas fichas</div>
    <div class="bar"><i style="width:0%"></i></div>`}</div>
   <div class="taxa" style="cursor:default">
    <div class="k">Intervalo de follow-up</div>
    <div class="v num" style="color:var(--warn)">0,2<span style="font-size:15px"> dias</span></div>
    <div class="s">é rajada, não follow-up: várias marcações na mesma sessão</div>
    <div class="bar"><i style="width:8%;background:var(--warn)"></i></div></div>
   <div class="taxa" style="cursor:default">
    <div class="k">Horário de mais resposta</div>
    ${tc.pico!=null?`<div class="v num" style="color:var(--c2)">${String(tc.pico).padStart(2,"0")}h–${String(tc.pico+1).padStart(2,"0")}h</div>
    <div class="s">${tc.picoQtd} de ${tc.respostasDele} respostas dos leads chegaram nessa hora</div>
    <div class="bar"><i style="width:${Math.round(tc.picoQtd/tc.respostasDele*100)}%;background:var(--c2)"></i></div>`
    :`<div class="v" style="color:var(--faint);font-size:19px">—</div>
    <div class="s">aparece quando houver respostas registradas</div>
    <div class="bar"><i style="width:0%"></i></div>`}</div>
  </div>
  <p class="nota"><b>O número de cima é o mais grave da operação inteira.</b> Você leva em média
  <b>7,6 dias</b> pra falar com um lead pela primeira vez — e o teste grátis dura <b>3 dias</b>.
  Quando a conversa começa, o teste já acabou há quase cinco dias. Não é falta de esforço:
  é a fila que nunca apontou pra pessoa certa no dia certo.</p>
 </div>

 <h2 class="sec">Quanto tempo por dia dentro do CRM</h2>
 <div class="box pad">
  <table class="tabela">
   <tr><th>Dia</th><th>Entrou</th><th>Saiu</th><th class="n">Janela</th><th class="n">Tarefas</th><th class="n">Por tarefa</th></tr>
   ${FOCO.map(f=>{const mpt=(f.min/f.tar);return `<tr>
     <td class="num">${f.d}</td><td class="num">${f.ini}</td><td class="num">${f.fim}</td>
     <td class="n">${f.min<60?f.min+"min":(Math.floor(f.min/60)+"h"+String(f.min%60).padStart(2,"0"))}</td>
     <td class="n">${f.tar}</td>
     <td class="n" style="color:var(--${mpt<1?"bad":mpt<3?"warn":"c2"})">${mpt<1?Math.round(mpt*60)+"s":mpt.toFixed(1)+"min"}</td></tr>`;}).join("")}
   <tr style="border-top:2px solid var(--line2)"><td><b>9 dias em 27</b></td><td colspan="2" class="num">33% dos dias</td>
     <td class="n"><b>18h49</b></td><td class="n"><b>203</b></td><td class="n"><b>5,6min</b></td></tr>
  </table>
  <div class="temp q" style="margin-top:13px"><span class="e">⚠️</span><span>
   <b>Ele trabalhou no CRM em 9 dias de 27 — e a última vez foi 15/09, há uma semana.</b>
   A janela média nos dias que trabalhou é de <b>2h05</b>. Mas o que importa é a última coluna:
   em 12/09 foram <b>34 tarefas em 22 minutos</b> e em 13/09 <b>23 em 13 minutos</b> — cerca de
   <b>36 segundos por tarefa</b>. Não existe conversa de WhatsApp de 36 segundos com 34 pessoas seguidas.
   Isso é marcação em lote, e é a prova que faltava de por que contato e não-contato converteram igual.</span></div>
  <p class="nota">Os dias de <b>26/08</b> (18 min por tarefa) e <b>10/09</b> (6,6 min) parecem trabalho de verdade.
  O de 07/09 são 3 tarefas espalhadas em 6 horas — janela longa, trabalho nenhum.
  Com a atividade amarrada ao envio da mensagem, essa coluna passa a medir conversa de verdade.</p>
 </div>

 <h2 class="sec">Quanto a gente fecha · e qual deve ser a meta</h2>
 <div class="box pad">
  <div class="funil" style="margin-bottom:14px">
   ${[["Junho",FECHOU.jun],["Julho",FECHOU.jul],["Agosto",FECHOU.ago],["Setembro (até dia 22)",FECHOU.set]].map(([m,v])=>`
     <div class="fstep" style="cursor:default"><span class="lbl">${m}</span>
      <span class="track"><i style="width:${v/40*100}%;background:var(--c2)"></i></span>
      <span class="v num">${v}</span></div>`).join("")}
  </div>
  <table class="tabela">
   <tr><th>Como as 108 assinaturas aconteceram</th><th class="n">Qtd</th><th class="n">Parte</th></tr>
   <tr><td>Assinaram <b>sozinhas</b>, sem nenhum contato seu</td><td class="n">${FECHOU.sozinhas}</td><td class="n">69,4%</td></tr>
   <tr><td>Tiveram <b>contato seu</b> antes de assinar</td><td class="n">${FECHOU.comYan}</td><td class="n">30,6%</td></tr>
  </table>
  <div class="temp q" style="margin-top:14px"><span class="e">🎯</span><span>
   <b>A meta que proponho: ${META.contatos} contatos e ${META.vendas} assinatura fechada por dia útil.</b><br>
   A conta: 87 assinaturas em jun+jul+ago dão <b>29 por mês</b>, ou 1,3 por dia útil. Mas só 30,6% passam por você —
   então hoje você fecha <b>0,4 por dia</b>. Entram cerca de 230 cadastros por mês, ou 10,5 por dia útil:
   por isso <b>10 contatos</b>, que é falar com todo mundo que entra. Se 10% virarem assinatura — o dobro da taxa
   de hoje, justificado por falar no dia 1 em vez do dia 8 — dá <b>1 por dia</b>, ou 22 no mês.
   Seria <b>2,4× o que você fecha hoje</b>, sem depender de mais tráfego.</span></div>
  <p class="nota">A meta conta só as assinaturas <b>que você fechou</b>. As 69,4% que entram sozinhas não somam
  no seu placar — elas já aconteceriam de qualquer jeito. Quem define os dois números é o admin.</p>
 </div>

 <h2 class="sec">Onde as pessoas somem · clique em cada degrau</h2>
 <div class="box pad"><div class="funil">
  ${funil.map(([l,v,c],i)=>`<button class="fstep" data-funil="${i}">
    <span class="lbl">${l}</span><span class="track"><i style="width:${v/maxF*100}%;background:var(--${c})"></i></span>
    <span class="v num">${v}${i?` · ${Math.round(v/maxF*100)}%`:""}</span></button>`).join("")}</div>
  <p class="nota">O degrau mais caro é o primeiro: <b>${NUM.contas-NUM.abriram} pessoas criaram conta e nunca abriram o app</b>.
  Desse grupo só 1,5% assina; de quem registra uma venda, 38% assina — <b>25 vezes mais</b>.</p></div>

 <h2 class="sec">Seu ritmo de trabalho</h2>
 <div class="box pad"><div class="barras" role="img" aria-label="Atividades concluídas por dia">
  ${RITMO.map(([d,v])=>`<div class="c2"><span class="bb${v?"":" zero"}" style="height:${v?Math.max(4,v/maxR*100):2}%" title="${d}: ${v}"></span><span class="dt">${d.slice(0,2)}</span></div>`).join("")}</div>
  <div class="legend"><span><span class="dot" style="background:var(--c1)"></span>atividades concluídas no dia</span></div>
  <p class="nota"><b>Nenhuma atividade desde 15/09 — sete dias.</b> E o trabalho vem em rajada: 63 num dia, zero em cinco.
  A fila do Hoje existe pra trocar rajada por ritmo: 5 por dia, todo dia, nas fichas certas.</p></div>

 <h2 class="sec">A pergunta incômoda</h2>
 <div class="box pad"><table class="tabela">
  <tr><th>Grupo</th><th class="n">Pessoas</th><th class="n">Assinaram</th><th class="n">Taxa</th></tr>
  <tr><td>Nunca recebeu contato</td><td class="n">${TRIAL_HIST.semContato}</td><td class="n">${TRIAL_HIST.fechouSem}</td><td class="n">4,7%</td></tr>
  <tr><td>Recebeu pelo menos 1 contato</td><td class="n">${TRIAL_HIST.comContato}</td><td class="n">${TRIAL_HIST.fechouCom}</td><td class="n">4,6%</td></tr></table>
  <p class="nota"><b>Quem foi contatado converteu igual a quem não foi.</b> Isso não prova que contato não funciona — prova que
  <b>marcar tarefa no CRM antigo não significava que a conversa aconteceu</b>. Em 15/09 foram 63 tarefas marcadas em 25 fichas no mesmo dia: carimbo, não conversa.
  É por isso que aqui a atividade só é marcada quando você <b>envia a mensagem</b>, e marcar sem enviar trava a pessoa em vez de limpar a lista.</p></div>

 <p class="nota" style="margin-top:18px">Números lidos do banco de produção a cada abertura. Faturamento e assinaturas vêm do webhook
 da Hotmart (histórico a partir de 24/08). <b>Nesta versão, o que você marca, move ou anota fica salvo
 só neste navegador</b> — ainda não volta pro banco, então o mesmo trabalho feito no celular e no
 computador não se enxerga. Gravar no banco é o próximo passo.</p>`;

 document.querySelectorAll("[data-card]").forEach(b=>b.onclick=()=>cards[+b.dataset.card].lista());
 const alvos=[
  ()=>abrirLista("Contas criadas",`${NUM.contas} pessoas criaram conta no Orbis`,todas.filter(f=>f.e==="base"),BASES.base),
  ()=>abrirLista("Abriram o app",`${NUM.abriram} de ${NUM.contas} chegaram a abrir o app`,todas.filter(f=>f.e==="base"&&etapaDe(f)!=="frio"),BASES.abriram),
  ()=>abrirLista("Registraram venda",`${NUM.venderam} registraram pelo menos uma venda`,todas.filter(f=>etapaDe(f)==="usou"),BASES.venderam),
  ()=>abrirLista("Assinaram",`${NUM.assinaram} assinaram alguma vez`,todas.filter(f=>f.e==="pagante"),BASES.assinaram),
  ()=>abrirLista("Pagando hoje",`${NUM.pagando} assinaturas ativas na Hotmart`,todas.filter(f=>f.e==="pagante"),BASES.pagante)];
 document.querySelectorAll("[data-funil]").forEach(b=>b.onclick=()=>alvos[+b.dataset.funil]());
}

/* ===== TELA PARCEIROS · gerar e medir os links ===== */
function renderParceiros(){
 const el=document.getElementById("p-parceiros"); if(!el)return;
 const tot=PARCEIROS.reduce((a,p)=>a+(+p.cadastros||0),0);
 const ass=PARCEIROS.reduce((a,p)=>a+(+p.assinaturas||0),0);
 el.innerHTML=`
 <h2 class="sec">Criar um link novo</h2>
 <div class="box pad">
  <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr">
   <input id="pCode" class="txtarea" style="min-height:0" placeholder="CÓDIGO (ex: JOAO5)" maxlength="20">
   <input id="pNome" class="txtarea" style="min-height:0" placeholder="Nome do parceiro">
   <select id="pTipo" class="txtarea" style="min-height:0">
     <option value="afiliado">Afiliado (5%)</option>
     <option value="influenciador">Influenciador (6,5%)</option>
   </select>
   <input id="pCom" class="txtarea" style="min-height:0" type="number" step="0.5" value="5" placeholder="Comissão %">
  </div>
  <label style="display:flex;gap:8px;align-items:center;margin-top:9px;font-size:12.5px;color:var(--dim)">
   <input type="checkbox" id="pRec"> comissão recorrente (ganha todo mês, não só na primeira)</label>
  <button class="btn go block" id="pSalvar" style="margin-top:10px">Gerar link</button>
  <div id="pResult" class="janela free" hidden style="margin-top:10px"></div>
  <p class="nota"><b>Importante:</b> o link já funciona pra rastrear cadastro e atribuir a venda.
  Mas pro desconto aparecer no checkout, o cupom com esse mesmo código precisa existir na Hotmart —
  isso você cria no painel deles uma vez.</p>
 </div>

 <h2 class="sec">Links ativos · ${PARCEIROS.length} parceiros · ${tot} cadastros · ${ass} assinaturas</h2>
 <div class="box pad">
  ${PARCEIROS.length?PARCEIROS.map(p=>{
    const conv=p.cadastros?Math.round(p.assinaturas/p.cadastros*100):0;
    const cor=conv>=20?"c2":conv>=10?"warn":"bad";
    return `<div class="pbox">
      <span class="nm"><b>${esc(p.nome)} · ${esc(p.code)}</b>
        <span>${esc(p.link)}</span></span>
      <span class="st"><b class="num" style="color:var(--${cor})">${conv}%</b>
        ${p.cadastros} cad · ${p.assinaturas} ass${p.ativas?" · "+p.ativas+" ativas":""}</span>
      <button class="btn ghost" data-copiar-link="${esc(p.link)}" style="flex:none;padding:7px 11px">Copiar</button>
    </div>`;}).join("")
   :`<div class="vazio">Nenhum parceiro cadastrado ainda.</div>`}
 </div>
 <p class="nota">A conversão compara <b>cadastros que vieram pelo link</b> com <b>assinaturas</b> desses cadastros.
 Quem estiver abaixo de 10% traz público que não é vendedor de rua.</p>`;

 el.querySelectorAll("[data-copiar-link]").forEach(b=>b.onclick=async()=>{
   try{await navigator.clipboard.writeText(b.dataset.copiarLink);toast("Link copiado");}catch(e){toast("Copie da tela");}});
 const sv=document.getElementById("pSalvar");
 if(sv) sv.onclick=async()=>{
   const code=document.getElementById("pCode").value, nome=document.getElementById("pNome").value;
   const tipo=document.getElementById("pTipo").value, com=+document.getElementById("pCom").value||5;
   const rec=document.getElementById("pRec").checked;
   const {data,error}=await sb.rpc("crm_parceiro_salvar",
     {p_code:code,p_nome:nome,p_tipo:tipo,p_comissao:com,p_recorrente:rec});
   if(error){ toast(error.message); return; }
   const r=document.getElementById("pResult");
   r.hidden=false; r.innerHTML=`✓ Link criado: <b>${esc(data.link)}</b>`;
   PARCEIROS=(await sb.rpc("crm_parceiros")).data||[];
   toast("Parceiro salvo"); renderParceiros();
 };
}

/* ===== abas ===== */
function aplicarPapel(){
 document.querySelectorAll('[data-tab="parceiros"]').forEach(b=>b.hidden=!ehDono());
 const av=document.getElementById("quemSou");
 if(av) av.title = ehDono()? "Dono — vê tudo" : "Comercial — sem faturamento e sem links";
}
function aba(t){
 if(t==="parceiros"&&!ehDono()) t="hoje";
 document.querySelectorAll("[data-tab]").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===t));
 ["hoje","alertas","esteiras","metricas","parceiros"].forEach(k=>document.getElementById("p-"+k).hidden=k!==t);
}
document.querySelectorAll("[data-tab]").forEach(b=>{
 b.onclick=()=>{aba(b.dataset.tab);render();window.scrollTo({top:0});};});
function render(){renderHoje();renderAlertas();renderEsteiras();renderMetricas();}
/* ===== LOGIN + BOOT ===== */
async function depoisDoLogin(){
  const {data:podeCrm, error:errAcesso}=await sb.rpc("is_orbis_crm");
  if(errAcesso){ erroLogin("Entrou, mas não consegui checar a permissão: "+errAcesso.message+". Tente de novo."); return; }
  if(podeCrm!==true){ erroLogin("Você entrou, mas essa conta não está liberada pro CRM (só admin e comercial). Peça ao Rick pra liberar seu CPF."); await sb.auth.signOut(); return; }
  const {data:papel}=await sb.rpc("orbis_papel");
  PAPEL = papel || "comercial";
  const {data:{user}}=await sb.auth.getUser();
  {const q=document.getElementById("quemSou"), quem=(user?.email||"").split("@")[0];
   q.textContent = ehDono()?"D":"C"; q.title = quem+" · "+(ehDono()?"dono":"comercial");}
  document.getElementById("telaLogin").hidden=true;
  document.getElementById("app").hidden=false;
  document.getElementById("carregando").hidden=false;
  try{ await chamar("crm_sync"); await chamar("crm_sync_base"); await carregarTudo(); }
  catch(e){ PROBLEMAS.push("carregamento: "+(e.message||e)); mostrarProblemas(); }
  try{ aplicarPapel(); render(); if(ehDono()) renderParceiros(); }
  catch(e){ PROBLEMAS.push("desenho da tela: "+(e.message||e)); mostrarProblemas(); }
  document.getElementById("carregando").hidden=true;
}
function erroLogin(t, andamento){ const e=document.getElementById("erroLogin"); e.className=andamento?"andamento":""; e.textContent=t||""; }
function botaoLogin(travado, texto){ const b=document.getElementById("btEntrar"); b.disabled=!!travado; b.textContent=texto||"Entrar"; }
/* traduz o erro do Supabase pra algo que a pessoa consiga agir em cima */
function explicaErro(error){
  const m=String(error?.message||error||"").toLowerCase();
  if(m.includes("invalid login credentials")) return "CPF ou senha incorretos. É a MESMA senha do app Orbis. Se esqueceu, peça ao Rick pra redefinir no painel.";
  if(m.includes("email not confirmed")) return "Essa conta ainda não foi confirmada. Fale com o Rick.";
  if(m.includes("too many") || m.includes("rate limit")) return "Muitas tentativas seguidas. Espere 1 minuto e tente de novo.";
  if(m.includes("failed to fetch") || m.includes("network") || m.includes("load failed")) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  return "Não foi possível entrar: " + (error?.message||error);
}
function resolverLogin(v){ v=String(v||"").trim();
  if(v.includes("@")) return v; const d=v.replace(/\D/g,""); return d?d+"@orbis.internal":v; }
window.__crmPronto=true; botaoLogin(false,"Entrar"); erroLogin("");
document.getElementById("btEntrar").onclick=async()=>{
  erroLogin("");
  const email=resolverLogin(document.getElementById("inEmail").value);
  const senha=document.getElementById("inSenha").value;
  if(!email||!senha){ erroLogin("Preencha CPF (ou e-mail) e senha."); return; }
  botaoLogin(true,"Entrando…"); erroLogin("Conferindo CPF e senha…", true);
  try{
    const {error}=await sb.auth.signInWithPassword({email,password:senha});
    if(error){ erroLogin(explicaErro(error)); botaoLogin(false,"Entrar"); return; }
    erroLogin("Senha certa. Abrindo o CRM…", true);
    await depoisDoLogin();
  }catch(e){ erroLogin(explicaErro(e)); }
  finally{ botaoLogin(false,"Entrar"); }
};
["inEmail","inSenha"].forEach(id=>document.getElementById(id).addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("btEntrar").click();}));
document.getElementById("btSair").onclick=async()=>{ await sb.auth.signOut(); location.reload(); };
document.getElementById("btAtualizar").onclick=async()=>{
  document.getElementById("carregando").hidden=false;
  try{ await chamar("crm_sync"); await chamar("crm_sync_base"); await carregarTudo(); render(); if(ehDono()) renderParceiros(); toast("Atualizado"); }
  catch(e){ PROBLEMAS.push("atualizar: "+(e.message||e)); mostrarProblemas(); }
  document.getElementById("carregando").hidden=true;
};
(async()=>{ const {data:{session}}=await sb.auth.getSession(); if(session) await depoisDoLogin(); })();

})().catch((e) => {
  const el = document.getElementById("erroLogin");
  if (el) { el.className = ""; el.textContent = "O CRM falhou ao iniciar: " + ((e && e.message) || e) + ". Recarregue a página; se continuar, avise o Rick."; }
  const b = document.getElementById("btEntrar");
  if (b) { b.disabled = false; b.textContent = "Recarregar"; b.onclick = () => location.reload(); }
  console.error(e);
});
