(function(){
  function $(id){ return document.getElementById(id); }
  var mqNoHover = window.matchMedia('(hover: none)').matches;

  var PHRASES = [
    ['Você não sabe quanto precisa vender hoje.','A Vant já calculou sua meta.'],
    ['No corre, dá pra perder a conta.','O DEFCON 4 conta por você.'],
    ['Vendeu fiado e esqueceu de cobrar?','Anota o WhatsApp e a Vant cobra por você.'],
    ['Ficar sem produto no pico é prejuízo.','A Vant avisa antes.'],
    ['Vender vira competição.','Suba de patente e dispute R$ 1.000 no Pix.'],
    ['O mês acabou. E agora?','Você disputa R$ 1.000 no Pix.']
  ];
  var SCREEN_BY_INDEX = ['missao','defcon','cobranca','estoque','ranking','standard'];
  var active = 0;

  var bar = $('orb-scenariobar');
  var tabs = bar ? Array.prototype.slice.call(bar.querySelectorAll('[data-scenario]')) : [];
  var screens = Array.prototype.slice.call(document.querySelectorAll('.orb-screen'));
  var phraseEl = $('orb-phrase');
  function styleTabs(){ for(var i=0;i<tabs.length;i++){ var on=i===active; var b=tabs[i]; b.style.background=on?'rgba(250,176,5,0.14)':'transparent'; b.style.borderColor=on?'rgba(250,176,5,0.5)':'rgba(255,255,255,0.12)'; b.style.color=on?'#FAB005':'rgba(255,255,255,0.6)'; } }
  function showScreen(){ var type=SCREEN_BY_INDEX[active]; for(var i=0;i<screens.length;i++){ screens[i].style.display = screens[i].getAttribute('data-screen')===type ? 'block':'none'; } }
  function updatePhrase(){ var s=PHRASES[active]; if(phraseEl) phraseEl.innerHTML = s[0]+'<br><span style="color:#FAB005">'+s[1]+'</span>'; var dc=$('demo-content'); if(dc && SCREEN_BY_INDEX[active]==='standard'){ dc.style.animation='none'; void dc.offsetWidth; dc.style.animation='demoIn .45s ease'; } }
  function select(i){ if(i===active) return; active=i; styleTabs(); showScreen(); updatePhrase(); }
  for(var ti=0;ti<tabs.length;ti++){ (function(idx){ tabs[idx].addEventListener('click', function(){ select(idx); }); })(ti); }
  styleTabs(); showScreen(); updatePhrase();
  var idb=$('orb-iniciar-dia'); if(idb) idb.addEventListener('click', function(){ select(1); });

  var defconRunning=false, defconSecs=3600, defconTimer=null;
  var dToggle=$('orb-defcon-toggle');
  function renderDefcon(){ var idle=document.querySelector('[data-defcon="idle"]'); var run=document.querySelector('[data-defcon="running"]'); if(idle) idle.style.display=defconRunning?'none':'block'; if(run) run.style.display=defconRunning?'block':'none'; var clk=$('orb-defcon-clock'); if(clk){ var m=Math.floor(defconSecs/60), s=defconSecs%60; clk.textContent=(m<10?'0':'')+m+':'+(s<10?'0':'')+s; } if(dToggle) dToggle.textContent=defconRunning?'PAUSAR':'INICIAR DEFCON 4'; }
  if(dToggle) dToggle.addEventListener('click', function(){ if(defconRunning){ clearInterval(defconTimer); defconTimer=null; defconRunning=false; } else { defconRunning=true; defconTimer=setInterval(function(){ defconSecs=defconSecs>0?defconSecs-1:0; renderDefcon(); },1000); } renderDefcon(); });
  renderDefcon();

  Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function(item){
    item.addEventListener('click', function(){
      var ans=item.querySelector('[data-faq-a]'); var ic=item.querySelector('[data-faq-ic]'); var open=item.getAttribute('data-open')==='1';
      if(ans){ ans.style.maxHeight=open?'0px':(ans.scrollHeight+14)+'px'; ans.style.opacity=open?'0':'1'; ans.style.marginTop=open?'0px':'14px'; }
      if(ic) ic.style.transform=open?'rotate(0deg)':'rotate(45deg)';
      item.setAttribute('data-open', open?'0':'1');
    });
  });

  (function(){ var els=Array.prototype.slice.call(document.querySelectorAll('[data-reveal]')); if(!('IntersectionObserver' in window)){ els.forEach(function(e){ e.style.opacity='1'; e.style.transform='none'; }); return; } var io=new IntersectionObserver(function(ents){ ents.forEach(function(en){ if(en.isIntersecting){ var el=en.target; var d=parseInt(el.getAttribute('data-reveal-delay')||'0',10); setTimeout(function(){ el.style.opacity='1'; el.style.transform='none'; }, d); io.unobserve(el); } }); }, {threshold:0.12, rootMargin:'0px 0px -8% 0px'}); els.forEach(function(e){ io.observe(e); }); })();

  Array.prototype.forEach.call(document.querySelectorAll('[data-scroll]'), function(el){ el.addEventListener('click', function(){ var t=$(el.getAttribute('data-scroll')); if(t){ var y=t.getBoundingClientRect().top+window.pageYOffset-110; window.scrollTo({top:y,behavior:'smooth'}); setTimeout(function(){ var inp=$('orb-nome'); if(inp) inp.focus(); },600); } }); });

  (function(){ var m=$('orb-marquee'); if(!m) return; var words=['ACESSO ANTECIPADO','VENDEDOR AMBULANTE','META DIÁRIA','SUBA DE PATENTE','RANKING R$1.000','LUCRO LÍQUIDO REAL']; var html=''; for(var k=0;k<2;k++){ words.forEach(function(w){ html+='<span style="padding:0 28px">'+w+'</span><span style="color:#FAB005">\u25CF</span>'; }); } m.innerHTML=html; })();

  (function(){ var fab=$('orb-fab'); var form=$('orb-form'); if(!fab) return; fab.style.transition='opacity .3s ease'; function upd(){ if(!form||form.style.display==='none'){ fab.style.opacity='1'; fab.style.pointerEvents='auto'; return; } var r=form.getBoundingClientRect(); var vis=r.bottom>0&&r.top<window.innerHeight; fab.style.opacity=vis?'0':'1'; fab.style.pointerEvents=vis?'none':'auto'; } upd(); window.addEventListener('scroll',upd,{passive:true}); window.addEventListener('resize',upd); })();

  (function(){ if(mqNoHover) return; Array.prototype.forEach.call(document.querySelectorAll('[data-mag]'), function(el){ el.addEventListener('mousemove', function(e){ var r=el.getBoundingClientRect(); var x=e.clientX-(r.left+r.width/2); var y=e.clientY-(r.top+r.height/2); el.style.transform='translate('+(x*0.22)+'px,'+(y*0.3)+'px)'; }); el.addEventListener('mouseenter', function(){ el.style.boxShadow='0 8px 30px rgba(250,176,5,0.28)'; }); el.addEventListener('mouseleave', function(){ el.style.transform='translate(0,0)'; el.style.boxShadow='none'; }); }); })();

  var bumpLocalCount=null;
  (function(){ var TOTAL=500; var filled=parseInt(localStorage.getItem('orbis_filled')||'453',10); if(!isFinite(filled)||filled<453) filled=453; if(filled>TOTAL) filled=TOTAL; var heroEl=$('orb-fill-hero'),fillEl=$('orb-fill-text'),restEl=$('orb-rest-text'),progEl=$('orb-prog'); function render(){ var rest=Math.max(0,TOTAL-filled); if(heroEl) heroEl.textContent=String(filled); if(fillEl) fillEl.textContent=filled+(filled===1?' vaga preenchida':' vagas preenchidas'); if(restEl) restEl.textContent=rest===1?'falta 1 vaga':'faltam '+rest+' vagas'; if(progEl) progEl.style.width=Math.min(100,(filled/TOTAL)*100)+'%'; } render(); bumpLocalCount=function(){ filled=Math.min(TOTAL,filled+1); try{localStorage.setItem('orbis_filled',String(filled));}catch(e){} render(); }; })();

  (function(){ var form=$('orb-form'); var success=$('orb-form-success'); if(!form) return; var nomeEl=$('orb-nome'),foneEl=$('orb-fone'),emailEl=$('orb-email'),submitBtn=$('orb-submit'); var fields=[nomeEl,foneEl,emailEl]; function reset(el){ el.style.borderColor='rgba(255,255,255,0.16)'; el.style.background='rgba(255,255,255,0.04)'; el.style.boxShadow='none'; } function focusOn(el){ el.style.borderColor='#FAB005'; el.style.background='rgba(250,176,5,0.05)'; el.style.boxShadow='0 0 0 4px rgba(250,176,5,0.1)'; } function flash(el){ el.style.borderColor='#ff5a5a'; el.style.boxShadow='0 0 0 4px rgba(255,90,90,0.12)'; el.focus(); } fields.forEach(function(el){ el.addEventListener('focus',function(){focusOn(el);}); el.addEventListener('blur',function(){reset(el);}); }); form.addEventListener('submit', function(e){ e.preventDefault(); var nome=(nomeEl.value||'').trim(), fone=(foneEl.value||'').trim(), email=(emailEl.value||'').trim(); var foneDigits=fone.replace(/\D/g,''); if(nome.length<2){ flash(nomeEl); return; } if(foneDigits.length<10){ flash(foneEl); return; } if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ flash(emailEl); return; } var oldTxt=submitBtn?submitBtn.textContent:''; if(submitBtn){ submitBtn.textContent='Enviando...'; submitBtn.style.opacity='0.75'; submitBtn.disabled=true; } var ref=new URLSearchParams(window.location.search).get('ref'); fetch('https://qbcsjsdwjjpybvzbxszi.supabase.co/rest/v1/leads',{method:'POST',headers:{'Content-Type':'application/json','apikey':'sb_publishable_QHFeQuWwHWFOl_0dIbiB4A_6QQCmPyy','Authorization':'Bearer sb_publishable_QHFeQuWwHWFOl_0dIbiB4A_6QQCmPyy','Prefer':'return=minimal'},body:JSON.stringify({nome:nome,whatsapp:fone,email:email,ref:ref})}).then(function(res){ return res&&res.ok; }).catch(function(){ return false; }).then(function(ok){ if(submitBtn){ submitBtn.textContent=oldTxt; submitBtn.style.opacity='1'; submitBtn.disabled=false; } if(!ok){ if(submitBtn) submitBtn.textContent='Tentar de novo'; flash(emailEl); return; } form.style.display='none'; if(success){ success.style.display='block'; var card=success.firstElementChild; if(card){ card.style.animation='none'; void card.offsetWidth; card.style.animation='orbUnlock .7s cubic-bezier(.2,.8,.2,1) both, orbUnlockGlow 3.2s 0.7s ease-in-out infinite'; } } if(bumpLocalCount) bumpLocalCount(); }); }); })();

  (function(){ if(mqNoHover) return; if(!bar||!tabs.length) return; var hand=document.createElement('div'); hand.textContent='\uD83D\uDC46'; hand.style.cssText='position:absolute;left:0;top:0;font-size:26px;line-height:1;pointer-events:none;z-index:6;opacity:1;transform:translateX(-50%) translateY(0) scale(1);transition:none;filter:drop-shadow(0 4px 5px rgba(0,0,0,0.55))'; bar.appendChild(hand); var idx=0, stopped=false, timer=null; function place(btn){ hand.style.left=(btn.offsetLeft+btn.offsetWidth/2)+'px'; hand.style.top=(btn.offsetTop+btn.offsetHeight-4)+'px'; } function tap(){ hand.style.transform='translateX(-50%) translateY(-7px) scale(0.82)'; setTimeout(function(){ hand.style.transform='translateX(-50%) translateY(0) scale(1)'; },200); } place(tabs[0]); requestAnimationFrame(function(){ hand.style.transition='left .55s cubic-bezier(.4,0,.2,1), top .55s cubic-bezier(.4,0,.2,1), transform .22s ease'; }); function step(){ if(stopped) return; var btn=tabs[idx]; place(btn); timer=setTimeout(function(){ if(stopped) return; tap(); btn.click(); idx=(idx+1)%tabs.length; timer=setTimeout(step,1900); },700); } timer=setTimeout(step,1200); function stop(){ if(stopped) return; stopped=true; if(timer) clearTimeout(timer); hand.style.transition='opacity .4s ease'; hand.style.opacity='0'; setTimeout(function(){ if(hand.parentNode) hand.parentNode.removeChild(hand); },450); } tabs.forEach(function(t){ t.addEventListener('pointerdown', stop); }); })();

  (function(){
    var audioEl=document.getElementById('orb-audio'); if(!audioEl) return;
    var navBtn=document.getElementById('orb-sound');
    var fab=document.getElementById('orb-music-fab');
    var fabLabel=document.getElementById('orb-music-fab-label');
    var fabBars=document.getElementById('orb-music-fab-bars');
    var soundOn=false, targetVol=0.5, fadeTimer=null;
    function fadeTo(t,ms){ if(fadeTimer) clearInterval(fadeTimer); var steps=Math.max(1,Math.round(ms/40)); var start=audioEl.volume,i=0; fadeTimer=setInterval(function(){ i++; var v=start+(t-start)*(i/steps); audioEl.volume=Math.min(1,Math.max(0,v)); if(i>=steps){ clearInterval(fadeTimer); fadeTimer=null; if(t===0){ try{audioEl.pause();}catch(e){} } } },40); }
    function updateUI(on){
      if(navBtn){ navBtn.style.boxShadow=on?'0 0 0 1px rgba(250,176,5,0.55), 0 0 16px rgba(250,176,5,0.3)':'none'; var ic=document.getElementById('orb-sound-icon'); if(ic){ var b=ic.querySelectorAll('span'); for(var i=0;i<b.length;i++){ b[i].style.animation=on?('orbWave '+(0.7+i*0.12)+'s ease-in-out infinite'):'none'; } } }
      if(fabLabel) fabLabel.textContent=on?'M\u00fasica ligada':'Ligar m\u00fasica';
      if(fab) fab.style.animation=on?'none':'orbBob 2.8s ease-in-out infinite';
      if(fabBars){ var fb=fabBars.querySelectorAll('span'); for(var j=0;j<fb.length;j++){ fb[j].style.animation=on?('orbWave '+(0.7+j*0.12)+'s ease-in-out infinite'):'none'; } }
    }
    audioEl.loop=true; audioEl.volume=0;
    var tt=parseFloat(localStorage.getItem('orbis_music_t')||'0');
    if(tt&&isFinite(tt)){ audioEl.addEventListener('loadedmetadata', function(){ try{ if(tt<audioEl.duration) audioEl.currentTime=tt; }catch(e){} }); }
    audioEl.addEventListener('timeupdate', function(){ try{ localStorage.setItem('orbis_music_t', String(audioEl.currentTime)); }catch(e){} });
    function turnOn(){ soundOn=true; audioEl.muted=false; var p=audioEl.play(); if(p&&p.catch) p.catch(function(){}); fadeTo(targetVol,900); updateUI(true); }
    function turnOff(){ soundOn=false; fadeTo(0,450); updateUI(false); }
    function toggle(){ if(soundOn) turnOff(); else turnOn(); }
    if(fab) fab.addEventListener('click', function(e){ e.stopPropagation(); toggle(); });
    if(navBtn) navBtn.addEventListener('click', function(e){ e.stopPropagation(); toggle(); });
    updateUI(false);
  })();

  (function(){ var cvs=$('orbis-bg'); if(!cvs) return; var ctx=cvs.getContext('2d'); var W,H,cx,cy,dpr; var mouse={x:-9999,y:-9999,active:false}; function resize(){ dpr=Math.min(window.devicePixelRatio||1,2); W=window.innerWidth; H=window.innerHeight; cvs.width=W*dpr; cvs.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); cx=W/2; cy=H*0.46; } resize(); window.addEventListener('resize',resize); window.addEventListener('mousemove',function(e){ mouse.x=e.clientX; mouse.y=e.clientY; mouse.active=true; }); window.addEventListener('mouseleave',function(){ mouse.active=false; }); var base=Math.min(W,H); var N=Math.max(60,Math.min(90,Math.floor((W*H)/16000))); var particles=[]; var rings=[0.16,0.27,0.38,0.5,0.62]; for(var i=0;i<N;i++){ var ringR=rings[i%rings.length]*base*(0.85+Math.random()*0.5); particles.push({a:Math.random()*Math.PI*2,r:ringR,spd:(Math.random()<0.5?1:-1)*(0.04+Math.random()*0.10),size:Math.random()<0.12?1.8+Math.random()*1.6:0.7+Math.random()*1.4,amber:Math.random()<0.5,ox:0,oy:0,tw:Math.random()*Math.PI*2}); } function draw(){ ctx.clearRect(0,0,W,H); ctx.save(); ctx.translate(cx,cy); for(var k=0;k<rings.length;k++){ ctx.beginPath(); ctx.arc(0,0,rings[k]*base,0,Math.PI*2); ctx.strokeStyle='rgba(250,176,5,0.04)'; ctx.lineWidth=1; ctx.stroke(); } ctx.restore(); ctx.globalCompositeOperation='lighter'; for(var j=0;j<particles.length;j++){ var p=particles[j]; p.a+=p.spd*0.016; var x=cx+Math.cos(p.a)*p.r; var y=cy+Math.sin(p.a)*p.r*0.92; if(mouse.active){ var dx=x-mouse.x, dy=y-mouse.y; var d2=dx*dx+dy*dy; if(d2<16000){ var d=Math.sqrt(d2)||1; var f=(1-d/126)*26; p.ox+=(dx/d)*f*0.18; p.oy+=(dy/d)*f*0.18; } } p.ox*=0.9; p.oy*=0.9; x+=p.ox; y+=p.oy; p.tw+=0.04; var tw=0.6+Math.sin(p.tw)*0.4; var s=p.size*(1+(Math.abs(p.ox)+Math.abs(p.oy))*0.02); ctx.beginPath(); ctx.arc(x,y,s,0,Math.PI*2); if(p.amber){ ctx.fillStyle='rgba(252,196,60,'+(0.6*tw)+')'; ctx.shadowBlur=8; ctx.shadowColor='rgba(250,176,5,0.85)'; } else { ctx.fillStyle='rgba(255,250,235,'+(0.4*tw)+')'; ctx.shadowBlur=4; ctx.shadowColor='rgba(255,250,235,0.5)'; } ctx.fill(); } ctx.shadowBlur=0; ctx.globalCompositeOperation='source-over'; requestAnimationFrame(draw); } draw(); })();

})();
