import test from 'node:test';
import assert from 'node:assert/strict';
import {XboxInput,stick} from '../src/controller.js';
import {musicStep,noteHz,pulse} from '../src/music.js';
const pad=()=>({index:0,id:'Test Xbox',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))});
  const press=(p,i,v=1)=>{p.buttons[i]={value:v,pressed:v>0.5};};
  test('controller trigger edges and neutral guards prevent firing on resume',()=>{
    const c=new XboxInput(),p=pad();press(p,7);assert.equal(c.sample([p]).fire,false);
    press(p,7,0);c.sample([p]);press(p,7);assert.equal(c.sample([p]).fire,true);assert.equal(c.sample([p]).fire,false);
    c.reset();assert.equal(c.sample([p]).fire,false);press(p,7,0);c.sample([p]);press(p,7);assert.equal(c.sample([p]).fire,true);
  });
  test('replacement and disconnect clear held controls; nonstandard mappings are rejected',()=>{
    const c=new XboxInput(),p=pad();c.sample([p]);press(p,7);c.sample([p]);c.sample([]);assert.equal(c.sample([p]).fire,false);
    press(p,7,0);c.sample([p]);p.id='Replacement';press(p,7);assert.equal(c.sample([p]).replaced,true);assert.equal(c.sample([p]).fire,false);
    p.mapping='';assert.equal(c.sample([p]).connected,false);
  });
  test('radial deadzone rejects drift and bounds stick diagonals',()=>{
    assert.deepEqual(stick(0.1,0.1),[0,0]);assert.deepEqual(stick(NaN,1),[0,0]);assert.ok(Math.abs(Math.hypot(...stick(1,1))-1)<1e-12);
  });
  test('soundtrack is deterministic and mathematically pitched',()=>{
    assert.equal(noteHz(69),440);assert.equal(noteHz(81),880);
    assert.equal(Array.from({length:16},(_,i)=>pulse(i,5)).filter(Boolean).length,5);
    assert.deepEqual(musicStep(32,3),musicStep(32,3));
    for(let i=0;i<100;i++)for(const n of musicStep(i,2))assert.ok(noteHz(n.note)>20&&noteHz(n.note)<10000);
  });
