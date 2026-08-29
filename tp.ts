// Reproduce the WaypointCar position math to find the discontinuity.
function sim(carSpeed: number, segLen: number, frames: number) {
  let t = 0, idx = 0, speed = 0;
  const segs = [{ ax:0,az:0,bx:segLen,bz:0 }, { ax:segLen,az:0,bx:segLen,bz:segLen }];
  let posX = 0, posZ = 0, lastX=0, lastZ=0, maxJump=0;
  for (let f=0; f<frames; f++) {
    const delta = 1/60;
    const a = segs[idx]; const b = segs[Math.min(idx+1, segs.length-1)];
    const length = Math.hypot(b.bx-a.ax, b.bz-a.az) || 1;
    // accelerate
    speed = Math.min(carSpeed, speed + 3.5*delta);
    let v = speed;
    t += (v*delta)/length;
    if (t >= 1) { idx += 1; t -= 1; }
    // position uses OLD a/b (still this frame's a/b = segs[idx BEFORE increment]... actually a/b computed before increment)
    const x = a.ax + (b.bx-a.ax)*t;
    const z = a.az + (b.bz-a.az)*t;
    posX = x; posZ = z;
    if (f>0) maxJump = Math.max(maxJump, Math.hypot(posX-lastX, posZ-lastZ));
    lastX=posX; lastZ=posZ;
  }
  return maxJump;
}
// fast car on a short segment
console.log("max jump (short seg, fast):", sim(3.2, 1.2, 200).toFixed(3));
console.log("max jump (short seg, slow):", sim(1.0, 1.2, 200).toFixed(3));

// Check planRoute single-node result
import { layoutCity, buildStreets } from "./app/src/layout";
import { findIntersections } from "./app/src/traffic";
import { buildRoadGraph, planRoute } from "./app/src/roadgraph";
const sessions=(n:number)=>Array.from({length:n},(_,i)=>({id:`s${i}`,tokensIn:10,tokensOut:5,timeCreated:i}));
const projects=Array.from({length:30},(_,i)=>({id:`p${i}`,name:`P${i}`,sessions:sessions(3+i%5)}));
const blocks=layoutCity(projects); const streets=buildStreets(blocks); const its=findIntersections(streets);
const graph=buildRoadGraph(streets,its);
let singleCount=0, undefB=0;
for (let s=0;s<graph.nodes.length;s++) {
  const r = planRoute(graph, s, s); // start==goal
  if (r.length===1) singleCount++;
  // goal same as start
}
console.log("planRoute(start,start) returns length-1 count:", singleCount);
console.log("nodes:", graph.nodes.length);
