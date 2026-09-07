import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import vm from 'node:vm';

const context=vm.createContext({window:{}});
for(const file of ['vehicles','logistics']) vm.runInContext(await readFile(`js/${file}.js`,'utf8'),context);
const {WarehouseVehicles:vehicles,WarehouseLogistics:logistics}=context.window;
const model=logistics.create({people:[
  {id:'admin',x:27,y:25,speed:2.6,route:[[27,25],[50,25],[50,39],[80,39],[98,43],[98,65],[76,65],[76,43],[55,43],[37,43],[37,37],[18,37],[18,28],[27,25]]},
  {id:'blue',x:18,y:5,speed:1.8,route:[[18,5],[18,23]]},
  {id:'green',x:93,y:5,speed:1.8,route:[[93,5],[93,23]]},
  {id:'center',x:50,y:5,speed:2.1,route:[[50,5],[50,23]]},
  {id:'bach',x:89,y:23},
]});
const histories=new Map(),positions=new Map(),visits=new Set(),yielded=new Set();
let stops=0,cleared=0,minimumSeparation=Infinity,checks=0;
for(let frame=0;frame<12000;frame++) {
  const time=frame*.05;
  const state=(period,x,receiving)=>({...vehicles.pose(time%period/period,x,receiving),progress:time%period/period});
  const before=model.forklifts.map(f=>({x:f.x,y:f.y,angle:f.angle,lift:f.lift,cargo:f.cargo}));
  const oldPeople=model.people.map(p=>({yieldTo:p.yieldTo,x:p.x,y:p.y}));
  model.update(.05,{receiving:state(24,6,true),shipping:state(48,105,false)});
  const separation=Math.hypot(model.forklifts[0].x-model.forklifts[1].x,model.forklifts[0].y-model.forklifts[1].y);
  minimumSeparation=Math.min(minimumSeparation,separation);
  assert.ok(separation>5,'Forklifts must reserve the shared rack bay until it is clear');
  model.people.forEach((person,i)=>{
    if(person.yieldTo) yielded.add(person.id);
    if(oldPeople[i].yieldTo && !person.yieldTo) cleared++;
  });
  const admin=model.people[0];
  if(admin.y>60) visits.add('front');
  if(admin.x>95) visits.add('returns');
  if(admin.x<20) visits.add('receiving');
  if(admin.x>70 && admin.x<80 && admin.y>45) visits.add('interlocking');
  for(const [i,f] of model.forklifts.entries()) {
    assert.ok(Math.hypot(f.x-before[i].x,f.y-before[i].y)<=.226,'No vehicle teleporting');
    if(f.phase==='yielding') {
      assert.equal(f.x,before[i].x);assert.equal(f.y,before[i].y);stops++;
    }
    if(f.phase==='raising' || f.phase==='lowering') {
      assert.equal(f.x,before[i].x);assert.equal(f.y,before[i].y);
      assert.ok(Math.abs(f.lift-before[i].lift)<=.121,'Fork height changes continuously');
    }
    if(f.cargo) {
      const pallet=model.cargo().find(p=>p.id===f.cargo);
      const attachment=logistics.forkPoint(f);
      assert.equal(pallet.owner,f.id);
      assert.ok(Math.hypot(pallet.x-attachment.x,pallet.y-attachment.y)<.001);
      assert.equal(pallet.z,f.lift);
    }
  }
  assert.equal(new Set(model.cargo().map(p=>p.id)).size,model.cargo().length,'One drawing owner per pallet');
  for(const pallet of model.cargo()) {
    const history=histories.get(pallet.id) || [];
    if(history.at(-1)!==pallet.owner) {
      const previous=positions.get(pallet.id);
      if(previous) assert.ok(Math.hypot(pallet.x-previous.x,pallet.y-previous.y,pallet.z-previous.z)<.3,'Transfers must happen at the forks, with no teleporting');
      history.push(pallet.owner);histories.set(pallet.id,history);
    }
    positions.set(pallet.id,{...pallet});
    if(pallet.owner==='rack-upper') assert.equal(pallet.z,7.12);
    if(pallet.owner==='truck-out') assert.ok(state(48,105,false).progress>=.2,'Only load a docked truck');
  }
  checks++;
}
assert.ok(stops>0 && cleared>0 && yielded.size>=2,'Stop, step aside, resume, and return must all run');
assert.equal(visits.size,4,'The admin route must visit all sides of the warehouse');
assert.ok(model.stats().delivered>=3,'Multiple complete deliveries must finish without a deadlock');
assert.deepEqual(histories.get('pallet-1'),['truck-in','aisle-truck','blue-buffer','aisle-truck','rack-ground','shuttle','rack-upper','shuttle','green-buffer']);
await mkdir('artifacts/logistics',{recursive:true});
const report={checks,virtualMinutes:10,...model.stats(),stoppedFrames:stops,yieldingOperators:[...yielded],cleared,minimumForkliftSeparation:minimumSeparation,palletOne:histories.get('pallet-1')};
await writeFile('artifacts/logistics/model-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
