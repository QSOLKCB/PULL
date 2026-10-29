import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,RULES} from '../src/game.js';
import {createWorld} from '../src/world.js';
import {rayBox} from '../src/math.js';

test('every rendered perimeter post and rail blocks a crossing pellet ray',()=>{
  const world=createWorld(),fence=world.geometry.filter(b=>Math.abs(b.x)===27);
  assert.ok(fence.length>0);
  for(const b of fence){
    const side=Math.sign(b.x),origin=[side*26.8,b.y,b.z],direction=[side,0,0];
    const hit=world.solids.some(s=>rayBox(origin,direction,s,0.4)!==null);
    assert.ok(hit,`fence surface at ${b.x}, ${b.y}, ${b.z}`);
  }
});

function fenceShot(side,y,z){
  const g=new Game(1);g.pull();g.pending=0;
  // Close to the fence, the whole pellet pattern fits inside the chosen rail
  // or post. This isolates collision from pellets legitimately passing a gap.
  Object.assign(g.player,{x:side*26,y,z,yaw:side*Math.PI/2,pitch:0});
  g.targets=[{id:1,x:side*29,y,z,vx:0,vy:0,vz:0,age:0,spin:0,color:0}];
  g.requestShot();return g;
}

test('posts and both rails stop full shots on either side of the range',()=>{
  for(const side of [-1,1])for(const [part,y,z] of [['post',0.7,-6],['upper rail',1.02,-8.4],['lower rail',0.5,-8.4]]){
    const g=fenceShot(side,y,z);
    assert.equal(g.stats.shots,1);
    assert.equal(g.stats.hits,0,`${side}: ${part}`);
    assert.equal(g.stats.hitShots,0);assert.equal(g.score,0);
    assert.equal(g.targets.length,1);assert.equal(g.phase,'active');
  }
});

test('shots through fence gaps and over posts remain unobstructed',()=>{
  for(const side of [-1,1])for(const [y,z] of [[0.76,-8.4],[1.65,-6]]){
    const g=fenceShot(side,y,z);
    assert.equal(g.stats.hits,1);assert.equal(g.phase,'cleared');assert.equal(g.total,350);
  }
});

test('round 20 seed 1 clay 17 cannot score through the right-hand rail',()=>{
  function naturalShot(ignoreFence=false){
    const g=new Game(1);g.round=19;g.beginRound();g.pull();
    for(let i=0;i<2339;i++)g.step(RULES.step,{aim:true});
    const t=g.targets.find(t=>t.id===17);
    assert.ok(t);assert.ok(Math.hypot(t.x-28.4,t.y-1.02,t.z+28.15)<0.01);
    const p=g.player,dx=t.x-p.x,dy=t.y-p.y,dz=t.z-p.z;
    // This grazing aim hits only pellets occluded by the rail. A centre shot
    // can legitimately break the clay with pellets passing above/below it.
    p.yaw=Math.atan2(dx,-dz)-0.028;
    p.pitch=Math.atan2(dy,Math.hypot(dx,dz))-0.008;
    if(ignoreFence)g.world.solids=g.world.solids.filter(s=>Math.abs((s.min[0]+s.max[0])/2)!==27);
    g.drainEvents();g.requestShot();
    return g.drainEvents().find(e=>e.type==='shot').hits.map(t=>t.id);
  }
  assert.deepEqual(naturalShot(),[]);
  assert.deepEqual(naturalShot(true),[17]);
});
