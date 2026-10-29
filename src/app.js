import {Game, RULES} from './game.js';
import {Renderer} from './renderer.js';
import {Sound} from './audio.js';
import {XboxInput} from './controller.js';
import {clamp, seededRandom} from './math.js';
const $ = id => document.getElementById(id), canvas = $('game'), overlay = $('effects'), ctx = overlay.getContext('2d');
  const sound = new Sound(), controller = new XboxInput(), random = seededRandom(741);
  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Optional storage. */ } },
  };
  const prefs = {profile:'mouse', sensitivity:1, padSensitivity:1, deadzone:0.16, volume:0.5, musicVolume:0.1,
    invert:false, reduced:matchMedia('(prefers-reduced-motion: reduce)').matches, lowQuality:false};
  const saved = storage.get('pull.settings.v1', {});
  const ranges = {sensitivity:[0.3,2.5],padSensitivity:[0.3,2.5],deadzone:[0.05,0.35],volume:[0,1],musicVolume:[0,1]};
  if (saved && typeof saved === 'object') {
    for (const [key, [lo, hi]] of Object.entries(ranges)) if (Number.isFinite(saved[key])) prefs[key] = clamp(saved[key],lo,hi);
    for (const key of ['invert','reduced','lowQuality']) if (typeof saved[key] === 'boolean') prefs[key] = saved[key];
    if (['mouse','xbox'].includes(saved.profile)) prefs.profile = saved.profile;
  }
  let best = storage.get('pull.best.v1',0); if (!Number.isSafeInteger(best) || best < 0) best = 0;
  let game = new Game(), renderer, state = 'menu', aim = false, pad = {}, graphicsLost = false;
  let last = performance.now(), accumulator = 0, hudClock = 0, hitTimer = 0, messageTimer = 0, finishTimer = -1;
  const effects = {particles:[],tracers:[],labels:[]}, pool = [], keys = new Set();

  function showError(message) { $('error').textContent = message; $('error').hidden = false; }
  function clearInput() { aim = false; keys.clear(); controller.reset(); game.cancelInput(); pad = {connected:pad.connected}; }
  function resetEffects() {
    pool.push(...effects.particles); effects.particles.length = 0; effects.tracers.length = 0; effects.labels.length = 0;
    hitTimer = 0; messageTimer = 0; finishTimer = -1; $('callout').hidden = true;
  }
  function setScreen(next) {
    state = next;
    for (const name of ['menu','pause','results']) $(name).hidden = next !== (name === 'pause' ? 'paused' : name);
    $('hud').hidden = next !== 'playing'; document.body.classList.toggle('playing', next === 'playing');
    if (next !== 'playing') sound.stopMusic();
  }
  function syncPrefs() {
    $('profile').value = prefs.profile; $('settings-profile').value = prefs.profile;
    for (const key of Object.keys(ranges)) {
      $(key).value = prefs[key]; $(`${key}-output`).value = ['volume','musicVolume','deadzone'].includes(key) ? `${Math.round(prefs[key]*100)}%` : prefs[key].toFixed(2);
    }
    for (const key of ['invert','reduced','lowQuality']) $(key).checked = prefs[key];
    sound.setVolume(prefs.volume); sound.setMusicVolume(prefs.musicVolume); storage.set('pull.settings.v1',prefs);
    $('controls').textContent = prefs.profile === 'xbox' ? 'RT FIRE · LT AIM · X RELOAD · MENU PAUSE' : 'LMB FIRE · RMB AIM · R RELOAD · ESC PAUSE';
    $('pull-instruction').textContent = prefs.profile === 'xbox' ? 'Press A or RT to call PULL' : 'Press SPACE or click to call PULL';
  }
  for (const key of [...Object.keys(ranges),'invert','reduced','lowQuality']) $(key).addEventListener('input',()=>{
    prefs[key] = $(key).type === 'checkbox' ? $(key).checked : Number($(key).value); syncPrefs();
  });
  for (const id of ['profile','settings-profile']) $(id).addEventListener('change',()=>{ prefs.profile = $(id).value; clearInput(); syncPrefs(); });
  function updateBest() { $('best').textContent = `PERSONAL BEST ${best ? best.toLocaleString() : '—'}`; }
  function releasePointer() { if (document.pointerLockElement === canvas) document.exitPointerLock(); }
  function requestPlay() {
    if (!renderer || graphicsLost) return;
    sound.start(); $('lock-message').textContent = ''; clearInput();
    if (prefs.profile === 'xbox') {
      if (!pad.connected) { $('lock-message').textContent = 'Connect a standard controller and press a button, then select Back to the line.'; return; }
      last = performance.now(); accumulator = 0; setScreen('playing'); return;
    }
    const failed = () => { if (state === 'paused') $('lock-message').textContent = 'Mouse capture was blocked. Click Back to the line to retry, or open the game directly in a desktop browser.'; };
    if (!canvas.requestPointerLock) { failed(); return; }
    try { canvas.requestPointerLock()?.catch(failed); } catch { failed(); }
  }
  function startRun() {
    if (!renderer || graphicsLost) return;
    game = new Game(Date.now() >>> 0); game.drainEvents(); clearInput(); resetEffects(); sound.musicIndex = 0;
    setScreen('paused'); requestPlay(); updateHUD();
  }
  function pauseGame() {
    if (state !== 'playing') return;
    clearInput(); accumulator = 0; setScreen('paused'); releasePointer(); $('resume').focus();
  }
  function mainMenu() {
    clearInput(); setScreen('menu'); releasePointer(); game = new Game(); game.drainEvents(); resetEffects(); updateBest(); $('start').focus();
  }
  function nextRound() {
    if (!game.nextRound()) return;
    clearInput(); resetEffects(); consumeEvents(); setScreen('paused'); requestPlay(); updateHUD();
  }
  function trigger() {
    if (state !== 'playing') return;
    if (game.phase === 'ready') game.pull(); else game.requestShot();
    consumeEvents(); updateHUD();
  }
  $('start').onclick = startRun; $('restart').onclick = startRun; $('results-restart').onclick = startRun;
  $('resume').onclick = requestPlay; $('quit').onclick = mainMenu; $('results-menu').onclick = mainMenu;
  $('next').onclick = nextRound; $('pause-button').onclick = pauseGame;
  $('settings-open').onclick = $('pause-settings').onclick = () => { sound.start(); $('settings').showModal(); };
  $('help-open').onclick = () => $('help').showModal();
  document.addEventListener('pointerdown',()=>{ if (sound.context?.state !== 'running') sound.start(); },{passive:true});
  document.addEventListener('pointerlockchange',()=>{
    if (document.pointerLockElement === canvas) {
      if (state === 'paused') { clearInput(); last = performance.now(); accumulator = 0; setScreen('playing'); }
      else if (state !== 'playing') releasePointer();
    } else if (state === 'playing' && prefs.profile === 'mouse') pauseGame();
  });
  document.addEventListener('pointerlockerror',()=>{ if(state === 'paused') $('lock-message').textContent = 'Click Back to the line to capture the mouse. If embedded, open PULL directly in a new tab.'; });
  window.addEventListener('blur',pauseGame);
  document.addEventListener('visibilitychange',()=>{ if (document.hidden) pauseGame(); });
  window.addEventListener('keydown',e=>{
    if (state !== 'playing') return;
    if (['Escape','KeyP','Tab'].includes(e.code)) { e.preventDefault(); pauseGame(); return; }
    if (['Space','KeyR','KeyM','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'Space' && game.phase === 'ready') { game.pull(); consumeEvents(); }
    if (e.code === 'KeyR') { game.reload(); consumeEvents(); }
    if (e.code === 'KeyM') announce(sound.toggle()?'SOUND OFF':'SOUND ON','',0.8);
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('mousemove',e=>{
    if (state !== 'playing' || prefs.profile !== 'mouse' || document.pointerLockElement !== canvas) return;
    const scale = 0.0021 * prefs.sensitivity * (1 - game.weapon.ads * 0.35);
    game.look(e.movementX * scale,-e.movementY * scale * (prefs.invert?-1:1));
  });
  window.addEventListener('mousedown',e=>{
    if (state !== 'playing' || prefs.profile !== 'mouse' || document.pointerLockElement !== canvas) return;
    e.preventDefault(); if (e.button === 2) aim = true; if (e.button === 0) trigger();
  });
  window.addEventListener('mouseup',e=>{ if (e.button === 2) aim = false; });
  window.addEventListener('contextmenu',e=>{ if (state === 'playing') e.preventDefault(); });
  function pollController() {
    const connected = pad.connected;
    try { pad = controller.sample(navigator.getGamepads?.(),prefs.deadzone); } catch { pad = {connected:false}; }
    $('controller-status').textContent = pad.connected ? 'Controller ready. Release controls after starting or resuming.' : 'Connect a standard Xbox controller, then press a button.';
    if (prefs.profile !== 'xbox') return;
    if (state === 'playing' && ((connected && !pad.connected) || pad.replaced)) {
      pauseGame(); $('lock-message').textContent = 'Controller disconnected or changed. Reconnect, release all controls, then resume.'; return;
    }
    if (!pad.connected || document.hidden || !document.hasFocus()) return;
    if (state === 'playing') {
      if (pad.pause) { pauseGame(); return; }
      aim = pad.aim;
      if (pad.fire || (pad.accept && game.phase === 'ready')) trigger();
      if (pad.reload) { game.reload(); consumeEvents(); }
      return;
    }
    const dialog = document.querySelector('dialog[open]');
    if (dialog && pad.back) { dialog.close(); return; }
    if (!dialog && state === 'paused' && pad.pause) { requestPlay(); return; }
    const root = dialog || $(state === 'paused' ? 'pause' : state === 'results' ? 'results' : 'menu');
    const controls = [...root.querySelectorAll('button,input,select')].filter(n=>!n.disabled && n.getClientRects().length);
    let index = controls.indexOf(document.activeElement);
    if (pad.up || pad.down) { index = (index + (pad.up?-1:1) + controls.length) % controls.length; controls[index]?.focus(); }
    const node = controls[index];
    if ((pad.left || pad.right) && node) {
      if (node.tagName === 'SELECT') { node.selectedIndex = (node.selectedIndex+(pad.left?-1:1)+node.options.length)%node.options.length; node.dispatchEvent(new Event('change')); }
      if (node.type === 'range') { node.value = clamp(Number(node.value)+(pad.left?-1:1)*Number(node.step||0.05),Number(node.min),Number(node.max)); node.dispatchEvent(new Event('input')); }
    }
    if (pad.accept && !node?.matches('select,input[type=range]')) {
      (node || $(state === 'menu'?'start':state === 'paused'?'resume':'next')).click();
      if (node?.type === 'checkbox') node.dispatchEvent(new Event('input'));
    }
  }
  function announce(title, subtitle='',seconds=1.4) {
    $('callout').querySelector('strong').textContent = title; $('callout').querySelector('small').textContent = subtitle;
    $('callout').hidden = false; messageTimer = seconds;
  }
  function fragments(t) {
    const count = prefs.reduced?6:prefs.lowQuality?14:28, cap = prefs.reduced?40:prefs.lowQuality?140:320;
    for (let i=0;i<count && effects.particles.length<cap;i++) {
      const p=pool.pop()||{},angle=random()*Math.PI*2,speed=1.5+random()*5;
      Object.assign(p,{x:t.x,y:t.y,z:t.z,vx:Math.cos(angle)*speed,vy:1+random()*4,vz:Math.sin(angle)*speed,
        life:0.65+random()*0.7,size:0.05+random()*0.08,color:i%3?[1,0.43,0.08]:[0.28,0.26,0.15]}); effects.particles.push(p);
    }
  }
  function consumeEvents() {
    for (const e of game.drainEvents()) {
      if (e.type === 'shot') {
        sound.play('shot');
        if (!prefs.reduced) effects.tracers.push({origin:e.origin.map((v,i)=>v+e.direction[i]*1.2+(i===1?-0.08:0)),point:e.origin.map((v,i)=>v+e.direction[i]*35),life:0.045});
        if (e.hits.length) {
          sound.play('hit'); hitTimer = 0.15;
          for (const t of e.hits) { fragments(t); effects.labels.push({point:[t.x,t.y,t.z],life:0.85,text:'+100'}); }
          if (e.hits.length>1) { sound.play('collateral'); announce(`${e.hits.length} IN ONE!`,`+${(e.hits.length-1)*RULES.doubleBonus} MULTI-CLAY BONUS`); }
        }
      } else if (e.type === 'reload') sound.play('reload');
      else if (['loaded','eject','insert','launch'].includes(e.type)) sound.play(e.type);
      else if (e.type === 'pull') { sound.play('start'); announce('PULL!','EYES UP.'); }
      else if (e.type === 'escape') announce('CLAY AWAY','−15 · COMING BACK AROUND',1.1);
      else if (e.type === 'clear') { sound.play('clear'); announce('ROUND CLEARED','NICE SHOOTING.',0.8); finishTimer = 0.85; }
    }
  }
  function updateEffects(dt) {
    let write=0;
    for (const p of effects.particles) {
      p.life-=dt; p.vy-=8*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt;
      if(p.life>0) effects.particles[write++]=p; else pool.push(p);
    } effects.particles.length=write;
    for (const array of [effects.tracers,effects.labels]) {
      write=0; for (const e of array) { e.life-=dt; if(e.life>0) array[write++]=e; } array.length=write;
    }
    hitTimer=Math.max(0,hitTimer-dt); messageTimer=Math.max(0,messageTimer-dt);
    $('callout').hidden=messageTimer===0;
    if(finishTimer>=0) { finishTimer-=dt; if(finishTimer<=0) { finishTimer=-1; showResults(); } }
  }
  function updateHUD() {
    const w=game.weapon,s=game.stats;
    $('round-label').textContent=`ROUND ${String(game.round).padStart(2,'0')}`;
    $('goal-label').textContent=`${game.goal.toLocaleString()} ${game.goal===1?'CLAY':'CLAYS'} TO CLEAR`;
    $('score').textContent=String(game.score).padStart(6,'0');
    $('live-cost').textContent=`RELOADS ${s.reloads} · −${s.reloads*RULES.reloadPenalty} PTS`;
    $('progress-label').textContent=`${s.hits.toLocaleString()} / ${game.goal.toLocaleString()}`;
    $('progress-bar').style.width=`${s.hits/game.goal*100}%`;
    $('flight-label').textContent=game.phase==='ready'?'WAITING FOR YOUR CALL':`${game.targets.length} AIRBORNE · ${game.remaining.toLocaleString()} TO GO · ${s.escapes} ESCAPED`;
    $('ammo-count').textContent=`${game.ammo} / 2`;
    for(let i=0;i<2;i++)$(`shell-${i}`).classList.toggle('spent',!w.chambers[i]);
    const progress=w.reload>0?1-w.reload/RULES.reload:0;
    $('weapon-status').textContent=w.reload>0?(progress<0.22?'BREAK OPEN':progress<0.48?'EJECT SPENT SHELLS':progress<0.76?'INSERT FRESH SHELLS':'SNAP SHUT'):game.ammo===2?'BOTH BARRELS READY':game.ammo===1?'ONE BARREL READY':'EMPTY · RELOADING';
    $('reload-bar').style.width=`${progress*100}%`;
    $('pull-prompt').hidden=game.phase!=='ready'; $('reticle').hidden=game.phase==='ready'; $('hitmarker').hidden=hitTimer<=0;
    const spread=RULES.hipSpread+(RULES.aimSpread-RULES.hipSpread)*w.ads;
    const diameter=Math.max(10,canvas.clientHeight*spread/Math.tan((renderer?.fov||74)*Math.PI/360));
    $('reticle').style.width=`${diameter}px`; $('reticle').style.height=`${diameter}px`;
    $('reticle').style.opacity=w.reload>0?'0.25':'1';
  }
  function showResults() {
    const r=game.history.at(-1); if(!r) return;
    if(game.total>best) { best=game.total; storage.set('pull.best.v1',best); updateBest(); }
    $('clear-label').textContent=`ROUND ${String(r.round).padStart(2,'0')} COMPLETE`;
    $('result-title').textContent=r.escapes===0&&r.shots===r.hitShots?'CLEAN BREAK.':'ROUND IN THE BAG.';
    $('round-score').textContent=r.total.toLocaleString(); $('run-score').textContent=game.total.toLocaleString();
    const rows=[['Clays broken',`${r.hits} × 100`,r.targetPoints],['Multi-clay bonus',`${r.extraHits} × 40`,r.multiPoints],['Round cleared','',r.clearBonus],['Reload cost',`${r.reloads} × 35`,-r.reloadCost],['Escaped clays',`${r.escapes} × 15`,-r.escapeCost]];
    $('scorecard').replaceChildren();
    for(const [label,detail,points] of rows) {
      const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
      dt.textContent=`${label}${detail?' · '+detail:''}`; dd.textContent=`${points<0?'−':'+'}${Math.abs(points).toLocaleString()}`;
      if(points<0) dd.className='cost'; div.append(dt,dd); $('scorecard').append(div);
    }
    const accuracy=r.shots?Math.round(r.hitShots/r.shots*100):0;
    const terminal=game.round>=RULES.maxRound;
    $('next-description').textContent=terminal?`Range complete. ${accuracy}% shot accuracy this round.`:`${accuracy}% shot accuracy · Next up: ${(game.goal*2).toLocaleString()} clays. Two fresh shells.`;
    $('next').disabled=terminal;
    clearInput(); setScreen('results'); releasePointer(); (terminal?$('results-restart'):$('next')).focus();
  }
  function drawOverlay() {
    if(!ctx) return;
    const width=canvas.clientWidth,height=canvas.clientHeight,scale=Math.min(devicePixelRatio||1,1.6);
    if(overlay.width!==Math.round(width*scale)||overlay.height!==Math.round(height*scale)) { overlay.width=Math.round(width*scale); overlay.height=Math.round(height*scale); }
    ctx.setTransform(scale,0,0,scale,0,0); ctx.clearRect(0,0,width,height);
    if(state!=='playing') return;
    ctx.textAlign='center'; ctx.font='bold 15px Arial';
    for(const label of effects.labels) {
      const point=renderer.project(label.point); if(!point)continue;
      ctx.globalAlpha=Math.min(1,label.life*2); ctx.fillStyle='#ffdfa3';ctx.shadowColor='#1b301b';ctx.shadowBlur=3;
      ctx.fillText(label.text,point[0],point[1]-(1-label.life)*30);
    }
    ctx.globalAlpha=1;ctx.shadowBlur=0;
  }
  function frame(now) {
    const elapsed=Math.min(0.05,Math.max(0,(now-last)/1000)); last=now; pollController();
    if(state==='playing') {
      accumulator=Math.min(accumulator+elapsed,RULES.step*6);
      while(accumulator>=RULES.step && state==='playing') {
        const scale=RULES.step*(1-game.weapon.ads*0.35);
        if(prefs.profile==='xbox') game.look((pad.lookX||0)*2.15*prefs.padSensitivity*scale,-(pad.lookY||0)*1.7*prefs.padSensitivity*scale*(prefs.invert?-1:1));
        else game.look((Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')))*scale, (Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown')))*scale);
        game.step(RULES.step,{aim}); consumeEvents(); updateEffects(RULES.step); accumulator-=RULES.step;
      }
      sound.music(state==='playing',Math.min(3,game.round/4)); hudClock+=elapsed;
      if(hudClock>0.05) { updateHUD(); hudClock=0; }
    } else accumulator=0;
    if(renderer&&!graphicsLost) { renderer.render(game,effects,{menu:state==='menu',time:prefs.reduced?0:now/1000,quality:prefs.lowQuality?0:1,reduced:prefs.reduced}); drawOverlay(); }
    requestAnimationFrame(frame);
  }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault(); graphicsLost=true; pauseGame(); $('start').disabled=true; showError('The graphics context was lost. Reload PULL to restore the range. Your saved best is safe.');});
  canvas.addEventListener('webglcontextrestored',()=>{showError('Graphics are available again. Reload this page to rebuild the range.');});
  try { renderer=new Renderer(canvas,game.world); } catch(error) { showError(error.message); $('start').disabled=true; }
  syncPrefs(); updateBest(); game.drainEvents(); requestAnimationFrame(frame);
  if('serviceWorker' in navigator && location.protocol!=='file:') {
    navigator.serviceWorker.register('./sw.js').then(async registration=>{
      await navigator.serviceWorker.ready; $('offline').textContent='OFFLINE READY';
      registration.addEventListener('updatefound',()=>{ const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)$('offline').textContent='UPDATE READY · CLOSE ALL PULL TABS TO APPLY';}); });
    }).catch(()=>{$('offline').textContent='ONLINE PLAY · OFFLINE CACHE UNAVAILABLE';});
  }
