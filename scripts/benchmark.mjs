import {performance} from 'node:perf_hooks';
import {Game,RULES} from '../src/game.js';
const game=new Game(123);game.round=42;game.beginRound();game.pull();
  const start=performance.now();let peak=0;
  for(let i=0;i<72000;i++){
    game.step(RULES.step);peak=Math.max(peak,game.targets.length);game.drainEvents();
  }
  console.log(JSON.stringify({simulatedSeconds:600,elapsedMs:Math.round(performance.now()-start),round:game.round,targetsInRound:game.goal,peakAirborne:peak,cap:RULES.maxActive}));
  if(peak>RULES.maxActive||game.pending+game.targets.length+game.stats.hits!==game.goal)process.exit(1);
