import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,Renderer} from '../src/renderer.js';
import {Game,RULES} from '../src/game.js';
import {perspective,transform,multiply,view} from '../src/math.js';
// CPU geometry checks; these do not compile GPU shaders.
test('shotgun geometry stays finite and visible through every reload stage',()=>{
    const renderer=Object.create(Renderer.prototype);renderer.weaponMesh=new Mesh();
    for(const aspect of [16/9,4/3])for(const progress of [-1,0.2,0.35,0.55,0.8,0.95]){
      const g=new Game();g.weapon.reload=progress<0?0:RULES.reload*(1-progress);
      g.weapon.spent=[0,1];g.weapon.chambers=progress<0?[true,true]:[false,false];
      const mesh=renderer.weapon(g,false,false),vp=perspective(64*Math.PI/180,aspect);
      assert.equal(mesh.length%27,0);let visible=0;
      for(let i=0;i<mesh.length;i+=9){
        assert.ok(mesh.data.subarray(i,i+9).every(Number.isFinite));
        const p=transform(vp,mesh.data.subarray(i,i+3));
        if(p[3]>0&&Math.abs(p[0])<p[3]&&Math.abs(p[1])<p[3])visible++;
      }
      assert.ok(visible/(mesh.length/9)>0.7,`visible geometry at ${progress}, aspect ${aspect}`);
    }
  });
  test('ADS sight bead aligns with the shot centre at both common aspect ratios',()=>{
    const renderer=Object.create(Renderer.prototype);renderer.weaponMesh=new Mesh();
    const g=new Game();g.weapon.ads=1;const mesh=renderer.weapon(g,true,false);
    const bead=[];
    for(let i=0;i<mesh.length;i+=9)if(mesh.data[i+6]===1&&Math.abs(mesh.data[i+7]-0.32)<1e-6&&Math.abs(mesh.data[i+8]-0.09)<1e-6)bead.push([...mesh.data.subarray(i,i+3)]);
    assert.ok(bead.length>0);const center=[0,1,2].map(axis=>bead.reduce((s,p)=>s+p[axis],0)/bead.length);
    for(const aspect of [16/9,4/3]){
      const p=transform(perspective(64*Math.PI/180,aspect),center);
      assert.ok(Math.abs(p[0]/p[3])<0.005);assert.ok(Math.abs(p[1]/p[3])<0.005);
    }
  });
  test('world projection centres a clay on its matching shot direction',()=>{
    const eye=[0,1.72,8],point=[-5,8,-22],dx=point[0]-eye[0],dy=point[1]-eye[1],dz=point[2]-eye[2];
    const yaw=Math.atan2(dx,-dz),pitch=Math.atan2(dy,Math.hypot(dx,dz));
    const p=transform(multiply(perspective(74*Math.PI/180,16/9),view(eye,yaw,pitch)),point);
    assert.ok(p[3]>0);assert.ok(Math.abs(p[0]/p[3])<1e-6);assert.ok(Math.abs(p[1]/p[3])<1e-6);
  });
