// Derived from QSOLKCB/QUICKSCOPER v0.2.0 (Apache-2.0); adapted for PULL. See NOTICE.
import {mix, smooth, perspective, view, multiply, transform} from './math.js';
import {RULES} from './game.js';
const VS=`attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor;
uniform mat4 uVP; uniform vec3 uEye; uniform float uDust; uniform float uPointScale;
varying vec3 vColor; varying float vDepth; varying float vAlpha;
void main(){
  float sunlight=max(dot(aNormal,normalize(vec3(-0.5,0.85,0.35))),0.0);
  float sky=max(aNormal.y,0.0)*0.13;
  vColor=aColor*(0.57+sunlight*0.48+sky);
  vDepth=length(aPosition-uEye);
  gl_Position=uVP*vec4(aPosition,1.0);
  vAlpha=1.0;gl_PointSize=1.0;
  if(uDust>0.5){vColor=aColor;vAlpha=aNormal.y;gl_PointSize=clamp(aNormal.x*uPointScale/max(0.01,gl_Position.w),1.0,18.0);}
}`;
const FS=`precision mediump float;
varying vec3 vColor; varying float vDepth; varying float vAlpha; uniform float uFog; uniform float uOpacity;
void main(){float fog=1.0-exp(-vDepth*vDepth*0.000042*uFog);
 gl_FragColor=vec4(mix(vColor,vec3(0.72,0.81,0.77),min(fog,0.88)),vAlpha*uOpacity);}`;
// Unit cube triangles, expanded once. Dynamic boxes write directly into a reused
// typed array, avoiding per-face position/normal arrays and Float32Array copies.
const CUBE=[];
for(const [normal,corners] of [
 [[0,1,0],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]],
 [[0,-1,0],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]],
 [[0,0,1],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],
 [[0,0,-1],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]],
 [[1,0,0],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]],
 [[-1,0,0],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]]
])for(const i of [0,1,2,0,2,3])CUBE.push(...corners[i],...normal);
export class Mesh {
  constructor(capacity=32768){this.data=new Float32Array(capacity);this.length=0;}
  clear(){this.length=0;return this;}
  reserve(count){if(this.length+count<=this.data.length)return;let size=this.data.length;while(size<this.length+count)size*=2;const next=new Float32Array(size);next.set(this.data);this.data=next;}
  vertex(p,n,c){this.reserve(9);const d=this.data;let i=this.length;d[i++]=p[0];d[i++]=p[1];d[i++]=p[2];d[i++]=n[0];d[i++]=n[1];d[i++]=n[2];d[i++]=c[0];d[i++]=c[1];d[i++]=c[2];this.length=i;}
  quad(a,b,c,d,n,color){this.vertex(a,n,color);this.vertex(b,n,color);this.vertex(c,n,color);this.vertex(a,n,color);this.vertex(c,n,color);this.vertex(d,n,color);}
  box(x,y,z,w,h,depth,color,angle=0){
    this.reserve(324);const sn=Math.sin(angle),cs=Math.cos(angle),data=this.data;let j=this.length;
    for(let i=0;i<CUBE.length;i+=6){
      const a=CUBE[i]*w/2,b=CUBE[i+1]*h/2,c=CUBE[i+2]*depth/2,nx=CUBE[i+3],ny=CUBE[i+4],nz=CUBE[i+5];
      data[j++]=x+a*cs+c*sn;data[j++]=y+b;data[j++]=z-a*sn+c*cs;
      data[j++]=nx*cs+nz*sn;data[j++]=ny;data[j++]=-nx*sn+nz*cs;
      data[j++]=color[0];data[j++]=color[1];data[j++]=color[2];
    }
    this.length=j;
  }
  cylinder(x,y,z,r,length,color,segments=12){
    // Along Z; used for the barrel, optic housing and muzzle.
    for(let i=0;i<segments;i++) {
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
      const pa=[x+Math.cos(a)*r,y+Math.sin(a)*r],pb=[x+Math.cos(b)*r,y+Math.sin(b)*r];
      this.quad([...pa,z-length/2],[...pb,z-length/2],[...pb,z+length/2],[...pa,z+length/2],[Math.cos((a+b)/2),Math.sin((a+b)/2),0],color);
      for(const [end,n] of [[z-length/2,-1],[z+length/2,1]]) {
        for(const p of [[x,y,end],[...pa,end],[...pb,end]])this.vertex(p,[0,0,n],color);
      }
    }
  }
  line(a,b,width,color){
    // Camera-independent crossed ribbons for short-lived bullet tracers.
    for(const offset of [[width,0,0],[0,width,0]]) {
      const p=(v,s)=>v.map((n,i)=>n+offset[i]*s);
      this.quad(p(a,-1),p(b,-1),p(b,1),p(a,1),[0,1,0],color);
    }
  }
}
function cone(mesh,x,y,z,r,h,color,segments=8){
  for(let i=0;i<segments;i++){
    const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
    const normal=[Math.cos((a+b)/2)*0.85,0.45,Math.sin((a+b)/2)*0.85];
    for(const p of [[x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x,y+h,z],[x+Math.cos(b)*r,y,z+Math.sin(b)*r]])mesh.vertex(p,normal,color);
  }
}
function rotateX(mesh,start,angle,pivotY=0,pivotZ=0){
  const d=mesh.data,c=Math.cos(angle),s=Math.sin(angle);
  for(let i=start;i<mesh.length;i+=9){
    const y=d[i+1]-pivotY,z=d[i+2]-pivotZ,ny=d[i+4],nz=d[i+5];
    d[i+1]=pivotY+y*c-z*s;d[i+2]=pivotZ+y*s+z*c;d[i+4]=ny*c-nz*s;d[i+5]=ny*s+nz*c;
  }
}
function shader(gl,type,source){
  const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(`Shader compilation failed: ${log}`);}return s;
}
export class Renderer {
  constructor(canvas,world){
    this.canvas=canvas;
    const gl=canvas.getContext('webgl2',{antialias:true,alpha:false})||canvas.getContext('webgl',{antialias:true,alpha:false});
    if(!gl)throw new Error('WebGL is unavailable. Enable hardware acceleration or try a desktop browser with WebGL support.');
    this.gl=gl;
    // WebGL 1 GLSL also works in a WebGL 2 context when no version directive is used.
    const vs=shader(gl,gl.VERTEX_SHADER,VS),fs=shader(gl,gl.FRAGMENT_SHADER,FS),program=gl.createProgram();
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);this.program=program;
    this.attributes=['aPosition','aNormal','aColor'].map(n=>gl.getAttribLocation(program,n));
    this.vp=gl.getUniformLocation(program,'uVP');this.eye=gl.getUniformLocation(program,'uEye');this.fog=gl.getUniformLocation(program,'uFog');
    this.dust=gl.getUniformLocation(program,'uDust');this.pointScale=gl.getUniformLocation(program,'uPointScale');
    this.opacity=gl.getUniformLocation(program,'uOpacity');
    this.dynamicMesh=new Mesh(65536);this.weaponMesh=new Mesh();this.dustMesh=new Mesh(4096);
    const mesh=new Mesh();
    for(const b of world.geometry)mesh.box(b.x,b.y,b.z,b.w,b.h,b.d,b.color);
    for(const h of world.hills) cone(mesh,h.x,0,h.z,h.r,h.h,[0.39,0.48,0.42],7);
    for(const t of world.trees){
      mesh.box(t.x,t.h*0.22,t.z,0.45,t.h*0.44,0.45,[0.28,0.25,0.17]);
      cone(mesh,t.x,t.h*0.18,t.z,t.r,t.h*0.82,[0.17+t.shade*0.07,0.29+t.shade*0.08,0.19+t.shade*0.04],7);
      cone(mesh,t.x,t.h*0.42,t.z,t.r*0.72,t.h*0.7,[0.24+t.shade*0.06,0.36+t.shade*0.07,0.23],7);
    }
    for(let i=0;i<12;i++) mesh.box(-100+i*19,48+(i%3)*5,-153,16+(i%4)*7,1.5,4,[0.94,0.94,0.82]);
    this.staticBuffer=gl.createBuffer();this.staticCount=mesh.length/9;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.staticBuffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.data.subarray(0,mesh.length),gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    this.width=0;this.height=0;this.lastVP=null;
  }
  resize(quality=1){
    const c=this.canvas,dpr=Math.min(devicePixelRatio||1,quality===0?1:1.6);
    const w=Math.round(c.clientWidth*dpr),h=Math.round(c.clientHeight*dpr);
    if(c.width!==w||c.height!==h){c.width=w;c.height=h;this.gl.viewport(0,0,w,h);}
    this.width=w;this.height=h;
  }
  bind(buffer){
    const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    this.attributes.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,i*12);});
  }
  drawMesh(mesh,points=false){
    if(!mesh.length)return;
    const gl=this.gl;mesh.buffer??=gl.createBuffer();this.bind(mesh.buffer);
    if(!mesh.gpuCapacity||mesh.gpuCapacity<mesh.data.byteLength){mesh.gpuCapacity=mesh.data.byteLength;gl.bufferData(gl.ARRAY_BUFFER,mesh.gpuCapacity,gl.DYNAMIC_DRAW);}
    gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh.data.subarray(0,mesh.length));gl.drawArrays(points?gl.POINTS:gl.TRIANGLES,0,mesh.length/9);
  }

  render(game,effects,{menu=false,time=0,quality=1,reduced=false}={}){
    this.resize(quality);const gl=this.gl,p=game.player,w=game.weapon;
    const eye=[p.x,p.y,p.z],yaw=menu?Math.sin(time*0.06)*0.06:p.yaw,pitch=menu?0.12:p.pitch;
    const fov=menu?74:mix(74,53,smooth(w.ads)); this.fov=fov;
    gl.clearColor(0.65,0.79,0.83,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const vp=multiply(perspective(fov*Math.PI/180,this.width/this.height,0.06,260),view(eye,yaw,pitch));this.lastVP=vp;
    gl.uniformMatrix4fv(this.vp,false,vp);gl.uniform3fv(this.eye,eye);gl.uniform1f(this.fog,1);gl.uniform1f(this.dust,0);gl.uniform1f(this.opacity,1);
    this.bind(this.staticBuffer);gl.drawArrays(gl.TRIANGLES,0,this.staticCount);
    const mesh=this.dynamicMesh.clear();
    for(const t of game.targets)this.clay(mesh,t);
    if(menu){
      this.clay(mesh,{x:6+Math.sin(time*0.25)*4,y:9+Math.cos(time*0.25)*1.8,z:-22,spin:time,color:0});
      this.clay(mesh,{x:14+Math.sin(time*0.2)*2,y:7,z:-33,spin:time*1.3,color:1});
    }
    for(const trail of effects.tracers)mesh.line(trail.origin,trail.point,0.009,[1,0.91,0.64]);
    this.drawMesh(mesh);
    if(effects.particles.length){
      const dust=this.dustMesh.clear();
      for(const p of effects.particles)dust.vertex([p.x,p.y,p.z],[p.size,Math.min(1,p.life*2),0],p.color);
      gl.uniform1f(this.dust,1);gl.uniform1f(this.pointScale,this.height/(2*Math.tan(fov*Math.PI/360)));
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);this.drawMesh(dust,true);
      gl.depthMask(true);gl.disable(gl.BLEND);gl.uniform1f(this.dust,0);
    }
    gl.clear(gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(this.vp,false,perspective(64*Math.PI/180,this.width/this.height));
    gl.uniform3fv(this.eye,[0,0,0]);gl.uniform1f(this.fog,0);
    this.drawMesh(this.weapon(game,reduced,menu));
  }
  clay(mesh,t){
    const start=mesh.length,color=t.color===1?[1,0.68,0.19]:[1,0.32,0.065];
    mesh.cylinder(0,0,0,0.55,0.15,[0.19,0.2,0.13],18);
    mesh.cylinder(0,0,-0.09,0.51,0.055,color,18);
    mesh.cylinder(0,0,-0.13,0.36,0.03,[1,0.62,0.2],18);
    rotateX(mesh,start,0.95+Math.sin(t.spin)*0.22);
    const d=mesh.data;
    for(let i=start;i<mesh.length;i+=9){d[i]+=t.x;d[i+1]+=t.y;d[i+2]+=t.z;}
  }
  weapon(game,reduced,menu){
    const mesh=this.weaponMesh.clear(),w=game.weapon,ads=menu?0:smooth(w.ads);
    const progress=w.reload>0?1-w.reload/RULES.reload:0;
    const open=w.reload>0?smooth(progress/0.22)*(1-smooth((progress-0.76)/0.24)):0;
    const recoil=reduced?0:w.recoil;
    const x=mix(0.27,0,ads),y=mix(-0.27,-0.092,ads)+open*0.12-recoil*0.014,z=-0.34-open*0.3+recoil*0.07;
    const steel=[0.16,0.2,0.2],edge=[0.48,0.52,0.49],silver=[0.68,0.7,0.64],wood=[0.38,0.19,0.085],grain=[0.52,0.29,0.13],glove=[0.29,0.32,0.22];
    mesh.box(0,-0.055,0.16,0.11,0.14,0.46,wood);
    mesh.box(0,-0.07,0.38,0.12,0.19,0.045,[0.13,0.16,0.13]);
    mesh.box(0,-0.015,-0.12,0.12,0.15,0.24,silver);
    mesh.box(0,0.07,-0.1,0.1,0.03,0.18,steel);
    mesh.box(0.026,0.095,-0.1,0.022,0.02,0.1,edge);
    mesh.box(0,-0.14,-0.025,0.065,0.02,0.13,steel);
    mesh.box(0,-0.10,0.035,0.065,0.1,0.02,steel);
    mesh.box(0,-0.1,-0.085,0.065,0.09,0.015,steel);
    mesh.box(0.005,-0.095,-0.03,0.015,0.055,0.02,edge);
    mesh.box(0.059,-0.01,-0.13,0.006,0.07,0.12,[0.43,0.47,0.42]);
    for(let i=0;i<4;i++)mesh.box(0.064,-0.025+i*0.012,-0.13,0.003,0.003,0.09,grain);
    mesh.box(0.045,-0.115,0.045,0.105,0.115,0.14,glove);
    mesh.box(0.11,-0.23,0.19,0.14,0.15,0.32,[0.2,0.27,0.21]);
    const barrelStart=mesh.length;
    // Two vertically stacked barrels; hinge the entire barrel/fore-end group.
    for(let i=0;i<2;i++){
      const by=i===0?-0.028:0.028;
      mesh.cylinder(0,by,-0.68,0.029,0.92,steel,14);
      mesh.cylinder(0,by,-1.145,0.03,0.02,edge,14);
      mesh.cylinder(0,by,-1.157,0.023,0.005,[0.025,0.035,0.03],14);
      mesh.cylinder(0,by,-0.208,0.024,0.009,[0.035,0.045,0.035],14);
      if(w.chambers[i]||(progress<0.28&&w.reload))mesh.cylinder(0,by,-0.198,0.021,0.008,[0.81,0.62,0.26],14);
    }
    mesh.box(0,0.064,-0.66,0.027,0.014,0.93,edge);
    for(let i=0;i<6;i++)mesh.box(0,0.053,-0.3-i*0.14,0.018,0.025,0.025,steel);
    mesh.box(0,0.091,-1.095,0.014,0.027,0.04,[1,0.32,0.09]);
    mesh.box(0,-0.075,-0.48,0.095,0.1,0.43,wood);
    for(let i=0;i<7;i++)mesh.box(0,-0.128,-0.32-i*0.045,0.087,0.004,0.012,grain);
    mesh.box(-0.045,-0.12,-0.47,0.13,0.10,0.19,glove);
    mesh.box(-0.1,-0.24,-0.26,0.14,0.14,0.38,[0.24,0.3,0.21]);
    rotateX(mesh,barrelStart,-open*0.7,0,-0.22);
    // A tactical reload ejects only spent shells.
    if(w.reload&&progress>0.25&&progress<0.62){
      const eject=(progress-0.25)/0.37;
      for(const i of w.spent){
        const by=i===0?-0.028:0.028;
        mesh.cylinder(0.02+eject*0.16,by+eject*0.22,-0.19+eject*0.55,0.021,0.09,[0.73,0.15,0.08]);
        mesh.cylinder(0.02+eject*0.16,by+eject*0.22,-0.14+eject*0.55,0.023,0.018,[0.88,0.65,0.27]);
      }
    }
    if(w.reload&&progress>0.48&&progress<0.8){
      const start=mesh.length,insert=smooth((progress-0.48)/0.32);
      for(const i of w.spent){
        const by=i===0?-0.028:0.028;
        mesh.cylinder(0,by,-0.11+(1-insert)*0.25,0.022,0.13,[0.8,0.18,0.07]);
        mesh.cylinder(0,by,-0.04+(1-insert)*0.25,0.023,0.018,[0.86,0.65,0.27]);
      }
      rotateX(mesh,start,-open*0.7,0,-0.22);
    }
    if(w.recoil>0.65&&!reduced){
      const by=w.lastBarrel===0?-0.028:0.028;
      mesh.box(0,by,-1.25,0.1*w.recoil,0.1*w.recoil,0.18,[1,0.79,0.32]);
    }
    for(let i=0;i<mesh.length;i+=9){mesh.data[i]+=x;mesh.data[i+1]+=y;mesh.data[i+2]+=z;}
    return mesh;
  }
  project(point){
    if(!this.lastVP)return null;const p=transform(this.lastVP,point);
    if(p[3]<=0)return null;return [(p[0]/p[3]*0.5+0.5)*this.canvas.clientWidth,(-p[1]/p[3]*0.5+0.5)*this.canvas.clientHeight];
  }
}
