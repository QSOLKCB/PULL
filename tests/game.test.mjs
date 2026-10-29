import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,RULES,targetCount,roundScore,shotPattern,raySphere} from '../src/game.js';
import {boxAt} from '../src/math.js';
const tick=(g,n,input={})=>{for(let i=0;i<n;i++)g.step(RULES.step,input);};
  function active(round=4){const g=new Game(17);g.round=round-1;g.beginRound();g.pull();g.pending=0;g.player.pitch=0;return g;}
  const clay=(id=1,x=0,y=1.72,z=-22)=>({id,x,y,z,vx:0,vy:0,vz:0,age:0,spin:0,color:0});
  function aimAt(g,t){const dx=t.x-g.player.x,dy=t.y-g.player.y,dz=t.z-g.player.z;g.player.yaw=Math.atan2(dx,-dz);g.player.pitch=Math.atan2(dy,Math.hypot(dx,dz));}
  test('rounds start at one and double without bitwise overflow',()=>{
    assert.deepEqual([1,2,3,4,5,6].map(targetCount),[1,2,4,8,16,32]);
    assert.equal(targetCount(33),4294967296);assert.equal(targetCount(43),2**42);
    for(const n of [0,-1,1.1,44,NaN,Infinity])assert.throws(()=>targetCount(n),RangeError);
  });
  test('clays wait for an explicit pull; calling twice never creates extra targets',()=>{
    const g=new Game();tick(g,600);assert.equal(g.targets.length,0);assert.equal(g.ammo,2);
    assert.equal(g.requestShot(),false);assert.equal(g.pull(),true);assert.equal(g.pull(),false);
    tick(g,60);assert.equal(g.targets.length,1);assert.equal(g.pending,0);
  });
  test('two quick trigger presses consume lower then upper barrel',()=>{
    const g=active();g.requestShot();assert.deepEqual(g.weapon.chambers,[false,true]);
    tick(g,20);g.requestShot();assert.deepEqual(g.weapon.chambers,[false,false]);
    assert.equal(g.stats.shots,2);assert.deepEqual(g.drainEvents().filter(e=>e.type==='shot').map(e=>e.barrel),[0,1]);
  });
  test('empty shotgun automatically reloads once, after the shot delay, in under a second',()=>{
    const g=active();g.requestShot();tick(g,20);g.requestShot();tick(g,25);
    assert.equal(g.stats.reloads,0);tick(g,2);assert.equal(g.stats.reloads,1);
    assert.ok(g.weapon.reload>0);assert.equal(g.requestShot(),false);tick(g,111);assert.equal(g.ammo,0);
    tick(g,3);assert.equal(g.ammo,2);assert.equal(g.weapon.reload,0);assert.equal(g.stats.reloads,1);
    g.requestShot();assert.equal(g.stats.shots,3);
  });
  test('manual top-up retains live chamber, ejects only spent shell and charges once',()=>{
    const g=active();assert.equal(g.reload(),false);g.requestShot();assert.equal(g.reload(),true);
    assert.deepEqual(g.weapon.spent,[0]);assert.equal(g.ammo,1);assert.equal(g.reload(),false);
    tick(g,114);assert.equal(g.ammo,2);assert.equal(g.stats.reloads,1);
    const events=g.drainEvents();for(const type of ['reload','eject','insert','loaded'])assert.equal(events.filter(e=>e.type===type).length,1,type);
  });
  test('one early press is buffered, spam never repeats or shortens the firing interval',()=>{
    const g=active();g.requestShot();assert.equal(g.requestShot(),false);tick(g,8);
    assert.equal(g.requestShot(),true);assert.equal(g.requestShot(),false);tick(g,10);assert.equal(g.stats.shots,1);
    tick(g,2);assert.equal(g.stats.shots,2);tick(g,240);assert.equal(g.stats.shots,2);
  });
  test('pausing input and starting reload cancel queued shots',()=>{
    for(const cancel of [g=>g.cancelInput(),g=>g.reload()]){
      const g=active();g.requestShot();tick(g,8);g.requestShot();cancel(g);tick(g,240);assert.equal(g.stats.shots,1);
    }
  });
  test('a pellet can only break its nearest clay; a clay counts once per shot',()=>{
    const g=active();g.targets=[clay(1),clay(2,0,1.72,-30)];g.requestShot();
    assert.equal(g.stats.hits,1);assert.equal(g.stats.hitShots,1);assert.equal(g.targets[0].id,2);
  });
  test('spread can break multiple neighbouring clays and adds a multi-clay bonus',()=>{
    const g=active();g.targets=[clay(1,-0.6),clay(2,0.6)];g.requestShot();
    assert.equal(g.stats.hits,2);assert.equal(g.stats.hitShots,1);assert.equal(g.stats.extraHits,1);
    assert.equal(roundScore(g.stats).total,240);
  });
  test('visible world solids occlude pellets',()=>{
    const g=active();g.targets=[clay()];g.world.solids=[boxAt(0,1.72,-5,5,5,1)];g.requestShot();assert.equal(g.stats.hits,0);
  });
  test('shot directions are normalized, keep a centre pellet and respect forward direction',()=>{
    const rays=shotPattern(0,0,0.026,1.2);assert.equal(rays.length,13);assert.deepEqual(rays[0],[0,0,-1]);
    for(const d of rays)assert.ok(Math.abs(Math.hypot(...d)-1)<1e-12);
    assert.equal(raySphere([0,0,0],[0,0,-1],[0,0,-5],1),4);
    assert.equal(raySphere([0,0,0],[0,0,-1],[0,0,5],1),null);
    assert.equal(raySphere([0,0,0],[0,0,-1],[10,0,-5],1),null);
  });
  test('the final shot clears a round before auto reload, and score is awarded only once',()=>{
    const g=active(1);g.targets=[clay()];g.requestShot();assert.equal(g.phase,'cleared');assert.equal(g.total,350);
    tick(g,500);assert.equal(g.stats.reloads,0);assert.equal(g.total,350);assert.equal(g.requestShot(),false);
    assert.equal(g.nextRound(),true);assert.equal(g.round,2);assert.equal(g.goal,2);assert.equal(g.ammo,2);
    assert.equal(g.nextRound(),false);assert.equal(g.phase,'ready');assert.equal(g.total,350);
  });
  test('round scoring subtracts every reload, includes relaunch penalties and floors at zero',()=>{
    const s={hits:4,extraHits:0,reloads:1,escapes:0};assert.equal(roundScore(s,true).total,615);
    assert.equal(roundScore({...s,reloads:2},true).total,580);
    assert.equal(roundScore({...s,escapes:1},true).total,600);
    assert.equal(roundScore({...s,reloads:50},true).total,0);
    assert.equal(roundScore(s).clearBonus,0);
  });
  test('escaped clays relaunch without inflating the round target count',()=>{
    const g=new Game(8);g.pull();tick(g,1200);assert.ok(g.stats.escapes>=1);
    assert.equal(g.pending+g.targets.length+g.stats.hits,g.goal);assert.equal(g.goal,1);
    assert.equal(g.phase,'active');
  });
  test('the numeric safety boundary still has bounded active objects and exact counters',()=>{
    const g=new Game();g.round=42;g.beginRound();g.pull();
    for(let i=0;i<12000;i++){
      g.step(RULES.step);assert.ok(g.targets.length<=RULES.maxActive);
      assert.equal(g.pending+g.targets.length+g.stats.hits,g.goal);g.drainEvents();
    }
    assert.equal(g.goal,2**42);assert.ok(Number.isSafeInteger(g.score));
  });
  test('seeded launches and identical shot inputs are deterministic',()=>{
    const a=new Game(123),b=new Game(123);a.pull();b.pull();
    for(let i=0;i<900;i++){
      a.step(RULES.step,{aim:true});b.step(RULES.step,{aim:true});
      if(i%29===0){a.requestShot();b.requestShot();}
    }
    assert.deepEqual(a.targets,b.targets);assert.deepEqual(a.stats,b.stats);assert.deepEqual(a.weapon,b.weapon);
  });
  test('first six naturally launched rounds can be cleared with real reloads and fresh round ammo',()=>{
    const g=new Game(765);
    for(let round=1;round<=6;round++){
      assert.equal(g.round,round);assert.equal(g.ammo,2);g.pull();
      for(let i=0;i<18000&&g.phase==='active';i++){
        g.step(RULES.step,{aim:true});
        if(g.targets.length&&g.ammo&&g.weapon.reload===0&&g.weapon.cooldown===0){aimAt(g,g.targets[0]);g.requestShot();}
        assert.equal(g.pending+g.targets.length+g.stats.hits,g.goal);g.drainEvents();
      }
      assert.equal(g.phase,'cleared',`round ${round}`);assert.equal(g.stats.hits,2**(round-1));
      assert.ok(g.stats.hitShots<=g.stats.shots);assert.equal(g.stats.escapes,0);
      if(round>=3)assert.ok(g.stats.reloads>0);
      assert.equal(g.score,g.total);g.nextRound();
    }
    assert.equal(g.history.length,6);assert.equal(g.goal,64);
  });
  test('restart is independent and contains no old ammo, score, clays or reload state',()=>{
    const g=active();g.requestShot();g.reload();tick(g,30);const next=new Game(17);
    assert.equal(next.phase,'ready');assert.equal(next.round,1);assert.equal(next.ammo,2);assert.equal(next.score,0);
    assert.equal(next.weapon.reload,0);assert.equal(next.targets.length,0);assert.equal(next.history.length,0);
  });
  test('invalid delta is ignored, oversized steps are bounded, aim stays inside the range',()=>{
    const g=new Game();g.step(NaN);g.step(-1);assert.equal(g.time,0);g.step(9);assert.equal(g.time,0.05);
    g.look(100,-100);assert.equal(g.player.yaw,1.35);assert.equal(g.player.pitch,-0.25);
  });
