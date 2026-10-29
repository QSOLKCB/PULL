// Original geometry: The Long Meadow clay range.
import {boxAt, seededRandom} from './math.js';
function createWorld() {
    const geometry = [], solids = [], trees = [], hills = [];
    const box = (x,y,z,w,h,d,color,solid=false) => {
      geometry.push({x,y,z,w,h,d,color});
      if(solid) solids.push(boxAt(x,y,z,w,h,d));
    };
    box(0,-0.25,-45,250,0.5,250,[0.32,0.42,0.23]);
    box(0,-0.03,8,11,0.08,9,[0.65,0.64,0.49]);
    box(0,0.018,7.5,3.3,0.06,2.8,[0.43,0.48,0.38]);
    box(0,0.055,6.13,3.4,0.035,0.07,[0.96,0.86,0.6]);
    box(0,0.03,-8,4,0.04,22,[0.38,0.46,0.27]);
    for (let side of [-1,1]) {
      box(side*19,1.7,-24,5,3.4,4,[0.25,0.34,0.28],true);
      box(side*19,3.55,-24,5.7,0.3,4.8,[0.19,0.26,0.23],true);
      box(side*18.8,2.25,-21.96,2,0.44,0.1,[0.06,0.12,0.12]);
      box(side*18.8,1.38,-21.8,2.4,0.12,0.45,[0.83,0.46,0.22]);
      box(side*7,0.72,4,2.2,0.16,0.75,[0.4,0.27,0.16]);
      for(let offset of [-0.8,0.8]) box(side*7+offset,0.33,4,0.1,0.65,0.55,[0.16,0.23,0.2]);
      for(let z=4;z>-66;z-=5){
        box(side*27,0.7,z,0.17,1.4,0.17,[0.59,0.53,0.38],true);
        box(side*27,1.02,z-2.4,0.09,0.1,5,[0.67,0.61,0.45],true);
        box(side*27,0.5,z-2.4,0.09,0.1,5,[0.67,0.61,0.45],true);
      }
    }
    for(let z=-16;z>=-56;z-=10) for(let side of [-1,1]) box(side*7,0.1,z,0.25,0.2,0.25,[0.88,0.76,0.51]);
    const random = seededRandom(911);
    for(let i=0;i<100;i++) {
      const x=(random()-0.5)*210,z=-62-random()*67;
      trees.push({x,z,h:4+random()*9,r:1.4+random()*2.9,shade:random()});
    }
    for(let i=0;i<24;i++) hills.push({x:-150+i*13,z:-135-random()*14,h:16+random()*23,r:23+random()*18});
    return {geometry,solids,trees,hills};
  }
export {createWorld};
