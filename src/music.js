// Derived from QSOLKCB/QUICKSCOPER v0.2.0 (Apache-2.0); adapted for PULL. See NOTICE.
// Original generative score: Euclidean pulses, major-pentatonic modular melody,
// and equal-tempered pitch (440 * 2^((note - 69) / 12)). No downloaded audio.
export const MUSIC_STEP=60/94/4;
export const noteHz=note=>440*2**((note-69)/12);
export const pulse=(step,hits,steps=16)=>((step%steps+steps)%steps*hits)%steps<hits;
export function musicStep(step,intensity=0){
  const bar=Math.floor(step/16),beat=step%16,root=[45,50,47,52][Math.floor(bar/2)%4];
  const notes=[];
  if(beat%4===0)notes.push({note:root-12,duration:0.18,type:'sine',volume:0.28,end:35,drum:true});
  if(pulse(step,5))notes.push({note:root,duration:0.21,type:'triangle',volume:0.19});
  if(pulse(step,3+(intensity>=3?2:0))){
    const degree=[0,2,4,7,9][(step*7+bar*3)%5];
    notes.push({note:root+24+degree,duration:0.14,type:'sine',volume:0.085});
  }
  if(beat%4===2||(intensity>=2&&beat%2===1))notes.push({note:98+(beat%3)*2,duration:0.025,type:'triangle',volume:0.025});
  return notes;
}
