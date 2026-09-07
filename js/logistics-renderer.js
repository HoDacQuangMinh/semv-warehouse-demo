/* SVG adapters for the activity model. Forks move vertically independently
   of the chassis; a carried pallet is drawn once at the fork attachment. */
(function (global) {
  'use strict';
  var NS='http://www.w3.org/2000/svg';
  function forklift() {
    return {specs:[
      [-2,-1.3,4.4,2.6,1.6,'machine',.9],[-2,-1.2,1.4,2.4,1.4,'machine',2.5],
      [-.6,-1.1,.22,.22,3.1,'tyre',2.5],[-.6,.9,.22,.22,3.1,'tyre',2.5],
      [1,-1.1,.22,.22,3.1,'tyre',2.5],[1,.9,.22,.22,3.1,'tyre',2.5],[-.8,-1.2,2.2,2.4,.25,'tyre',5.6],
      [2.1,-1,.25,.25,5.8,'steel',.6,'mast'],[2.1,.8,.25,.25,5.8,'steel',.6,'mast'],
      [2.25,-1,2.8,.26,.18,'tyre',0,'carriage'],[2.25,.75,2.8,.26,.18,'tyre',0,'carriage'],
      [2.15,-1.1,.35,2.2,.8,'steel',0,'carriage'],
      [-.1,-.6,.8,1.2,1.25,'vest',2.6],[-.05,-.4,.7,.8,.55,'skin',3.85],[-.15,-.5,.9,1,.25,'helmet',4.4]
    ],wheels:[[-1.3,1.35,.65,.65],[1.5,1.35,.65,.65]]};
  }
  function pallet() {
    return {specs:[[-1.45,-1.25,2.9,2.5,.25,'rib',0],[-1.35,-1.15,1.3,2.3,1.35,'load',.25],
      [.05,-1.15,1.3,2.3,1.35,'load',.25],[-1.35,-1.15,2.7,1.1,1.35,'load',1.6],[-1.35,.05,2.7,1.1,1.35,'load',1.6]],wheels:[]};
  }
  function create(mount,project,model) {
    var hall=mount.querySelector('.twin__hall');
    var foreground=mount.querySelector('[data-layout-area="gr"]');
    var blue=mount.querySelector('[data-container="receiving"]');
    var green=mount.querySelector('[data-container="shipping"]');
    var racks=Array.from(mount.querySelectorAll('.iso-rack-bank'));
    var cargoNodes=new Map();
    var gate=mount.querySelector('#dock-gate'),gateLift=0;
    var machines=model.forklifts.map(function (f) {
      var node=mount.querySelector('#'+f.id);
      var mesh=global.WarehouseVehicles.createMesh(node,{vehicle:forklift(),project:project,pivot:[0,0],wheelMirrorY:0});
      var light=document.createElementNS(NS,'circle');light.setAttribute('class','iso-yield-light');light.setAttribute('r','3');node.appendChild(light);
      return {node:node,mesh:mesh,light:light};
    });
    function place(node,p,isPallet) {
      var parent=hall,before=foreground;
      if(p.x<13 && p.y<28) before=blue;
      else if(p.x>99 && p.y<28) before=green;
      else if(p.y<23 && ((p.x>23&&p.x<44)||(p.x>63&&p.x<85))) {
        var rack=p.x<44 ? racks[0] : racks[1];
        parent=rack;
        before=rack.querySelector(isPallet && p.z>6 ? '[data-rack-level="upper"]' : '[data-rack-level="lower"]');
      }
      var layer=before || parent;
      if(node.depthLayer!==layer) { parent.insertBefore(node,before);node.depthLayer=layer; }
    }
    function draw(clock) {
      // The delivery clock opens the shutter for the truck. A crossing
      // forklift may also open it between deliveries, before reaching it.
      var progress=clock.receiving.progress;
      var dockLift=progress<.14 || progress>=.78 ? 0 : progress<.20 ? (progress-.14)/.06 : progress<=.68 ? 1 : 1-(progress-.68)/.10;
      var target=model.gateOpen() ? 1 : 0;
      gateLift+=Math.sign(target-gateLift)*Math.min(Math.abs(target-gateLift),clock.dt/800);
      gate.style.setProperty('transform','translateY('+(-54*Math.max(dockLift,gateLift))+ 'px)','important');
      gate.dataset.forkliftCrossing=String(target===1);
      model.forklifts.forEach(function (f,i) {
        var machine=machines[i];
        machine.mesh.draw(f);
        machine.node.dataset.operation=f.phase;
        machine.node.dataset.forkHeight=f.lift.toFixed(2);
        machine.node.dataset.cargo=f.cargo || '';
        machine.node.dataset.waitingFor=f.waitingFor || '';
        machine.node.classList.toggle('is-yielding',f.phase==='yielding');
        var beacon=project(f.x,f.y,6.4);machine.light.setAttribute('cx',beacon[0]);machine.light.setAttribute('cy',beacon[1]);
        place(machine.node,f,false);
      });
      var live=new Set();
      model.cargo().forEach(function (p) {
        live.add(p.id);
        var item=cargoNodes.get(p.id);
        if(!item) {
          var node=document.createElementNS(NS,'g');node.setAttribute('class','iso-handled-pallet');node.dataset.pallet=p.id;
          item={node:node,mesh:global.WarehouseVehicles.createMesh(node,{vehicle:pallet(),project:project,pivot:[0,0]})};
          cargoNodes.set(p.id,item);
        }
        var f=model.forklifts.find(function (f) {return f.id===p.owner;});
        var angle=f ? f.angle : p.angle || 0;
        item.mesh.draw({x:p.x,y:p.y,z:p.z,angle:angle,phase:p.owner});
        item.node.dataset.owner=p.owner;
        place(item.node,p,true);
      });
      cargoNodes.forEach(function (item,id) {if(!live.has(id)){item.node.remove();cargoNodes.delete(id);}});
    }
    return {draw:draw};
  }
  global.WarehouseLogisticsRenderer={create:create};
})(window);
