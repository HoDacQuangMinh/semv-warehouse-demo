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
    var dockTrucks=[mount.querySelector('#dock-truck'),mount.querySelector('#shipping')];
    var racks=Array.from(mount.querySelectorAll('.iso-rack-bank'));
    var cargoNodes=new Map();
    var gate=mount.querySelector('#dock-gate'),gateLift=0;
    var wrap=mount.querySelector('#wrapping-pallet'),film=mount.querySelector('#wrapping-film');
    var web=mount.querySelector('#wrapping-web'),carriage=mount.querySelector('#wrapping-carriage'),wrapTime=0;
    var palletHeight=.68,loadBottom=1.75+palletHeight,cartonHeight=2.8,layerPitch=2.88;
    var loadHeight=layerPitch+cartonHeight,bandWidth=1.55,half=3.13;
    var wrapSpecs=[];
    [-2.8,0,2.8].forEach(function (y) {
      wrapSpecs.push([-3.5,y-.3,7,.6,.16,'wrap-pallet',0]);
      [-2.9,0,2.9].forEach(function (x) {wrapSpecs.push([x-.3,y-.3,.6,.6,.35,'wrap-pallet',.16]);});
    });
    for(var board=0;board<5;board++) wrapSpecs.push([-3.5,-3.35+board*1.34,7,1.16,.17,'wrap-pallet',.51]);
    for(var level=0;level<2;level++) {
      for(var x=0;x<2;x++) for(var y=0;y<2;y++) {
        var bx=-3.1+x*3.14,by=-3.1+y*3.14,z=palletHeight+level*layerPitch;
        wrapSpecs.push([bx,by,3.06,3.06,cartonHeight,'wrap-carton',z]);
        // Visible carton seams and tape keep the two tiers from merging into
        // one solid cube. Alternate the tape direction on the upper tier.
        wrapSpecs.push(level ? [bx,by+1.39,3.06,.28,.02,'wrap-tape',z+cartonHeight]
          : [bx+1.39,by,.28,3.06,.02,'wrap-tape',z+cartonHeight]);
      }
    }
    var wrapMesh=global.WarehouseVehicles.createMesh(wrap,{vehicle:{specs:wrapSpecs,wheels:[]},project:project,pivot:[0,0]});
    var filmFaces=[];
    for(var side=0;side<4;side++) {
      var face=document.createElementNS(NS,'polygon');film.appendChild(face);filmFaces.push(face);
    }
    var seams=document.createElementNS(NS,'path');film.appendChild(seams);
    function drawWrapper(dt) {
      wrapTime+=dt/1000;
      var phase=wrapTime%14;
      var progress=phase<1 ? phase*phase/18 : phase<9 ? (phase-.5)/9 : phase<10 ? 1-Math.pow(10-phase,2)/18 : 1;
      var angle=progress*1080;
      wrap.dataset.wrappingPhase=phase<10 ? 'wrapping' : 'finished';
      wrapMesh.draw({x:63,y:53,z:1.75,angle:angle,phase:wrap.dataset.wrappingPhase});
      var wrappingOperator=mount.querySelector('#wrapping-operator');
      wrappingOperator.classList.toggle('is-wrapping',phase<10);
      wrappingOperator.dataset.workTime=phase.toFixed(3);
      // The film builds upward as the turntable rotates. Its feed follows the
      // rising carriage at the mast, while the finished load pauses for a beat.
      var height=bandWidth+progress*(loadHeight-bandWidth),rad=angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
      function point(x,y,z) {return project(63+x*c-y*s,53+x*s+y*c,z).join(',');}
      var corners=[[-half,-half],[half,-half],[half,half],[-half,half]];
      var visible=[s-c>0,c+s>0,c-s>0,-c-s>0];
      film.style.opacity=phase>13.3 ? String(Math.max(0,(14-phase)/.7)) : '1';
      filmFaces.forEach(function (face,i) {
        var a=corners[i],b=corners[(i+1)%4];
        face.style.visibility=visible[i] ? 'visible' : 'hidden';
        face.setAttribute('points',[point(a[0],a[1],loadBottom),point(b[0],b[1],loadBottom),point(b[0],b[1],loadBottom+height),point(a[0],a[1],loadBottom+height)].join(' '));
      });
      var lines='';
      var pitch=(loadHeight-bandWidth)/3;
      for(var turn=0;turn<4;turn++) {
        corners.forEach(function (a,i) {
          if(!visible[i]) return;
          var b=corners[(i+1)%4],low=loadBottom+.2+turn*pitch+i*pitch/4,high=low+pitch/4;
          if(low>=loadBottom+height) return;
          var t=Math.min(1,(loadBottom+height-low)/(high-low));
          lines+='M'+point(a[0],a[1],low)+'L'+point(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,low+(high-low)*t);
        });
      }
      seams.setAttribute('d',lines);
      // Feed the film onto a tangent corner, never through the cartons. The
      // winding direction selects the same outer tangent throughout a turn.
      var feedX=68.83,feedY=52.15,dx=feedX-63,dy=feedY-53;
      var localFeed=[dx*c+dy*s,-dx*s+dy*c];
      var contact=corners.find(function (a) {
        return corners.every(function (b) {
          return (a[0]-localFeed[0])*(b[1]-localFeed[1])-(a[1]-localFeed[1])*(b[0]-localFeed[0])>=-1e-8;
        });
      });
      var feedZ=loadBottom+height-bandWidth;
      var feed=project(feedX,feedY,feedZ),feedTop=project(feedX,feedY,feedZ+bandWidth);
      var returnProgress=Math.max(0,Math.min(1,(phase-12)/2));
      returnProgress=returnProgress*returnProgress*(3-2*returnProgress);
      var lift=(height-bandWidth)*(1-returnProgress);
      var origin=project(feedX,feedY,0),raised=project(feedX,feedY,lift);
      carriage.setAttribute('transform','translate(0,'+(raised[1]-origin[1])+')');
      carriage.dataset.filmBottom=(loadBottom+lift).toFixed(3);
      web.setAttribute('d','M'+feed.join(',')+'L'+point(contact[0],contact[1],feedZ)+'L'+point(contact[0],contact[1],feedZ+bandWidth)+'L'+feedTop.join(',')+'Z');
      web.style.visibility=phase<10 ? 'visible' : 'hidden';
      web.dataset.contactX=(63+contact[0]*c-contact[1]*s).toFixed(4);
      web.dataset.contactY=(53+contact[0]*s+contact[1]*c).toFixed(4);
      wrap.dataset.filmTop=(loadBottom+height).toFixed(3);
      wrap.dataset.loadTop=(loadBottom+loadHeight).toFixed(3);
      var marks=mount.querySelector('#wrapping-turntable-marks');
      marks.setAttribute('d','M'+point(5.3,0,1.752)+'L'+point(6.6,0,1.752)+'M'+point(-5.3,0,1.752)+'L'+point(-6.6,0,1.752));
    }
    var machines=model.forklifts.map(function (f) {
      var node=mount.querySelector('#'+f.id);
      var mesh=global.WarehouseVehicles.createMesh(node,{vehicle:forklift(),project:project,pivot:[0,0],wheelMirrorY:0,shadow:[-2,-1.4,7,2.8]});
      var light=document.createElementNS(NS,'circle');light.setAttribute('class','iso-yield-light');light.setAttribute('r','3');node.appendChild(light);
      return {node:node,mesh:mesh,light:light};
    });
    function place(node,p,isPallet) {
      var parent=hall,before=foreground;
      if(p.x<13 && p.y<28) before=blue;
      else if(p.x>99 && p.y<28) before=green;
      else if(p.y<18.5 && ((p.x>23&&p.x<44)||(p.x>63&&p.x<85))) {
        var rack=p.x<44 ? racks[0] : racks[1];
        parent=rack;
        before=rack.querySelector(isPallet && p.z>6 ? '[data-rack-level="upper"]' : '[data-rack-level="lower"]');
      }
      var layer=before || parent;
      if(node.depthLayer!==layer) { parent.insertBefore(node,before);node.depthLayer=layer; }
    }
    function draw(clock) {
      drawWrapper(clock.dt);
      // The delivery clock opens the shutter for the truck. A crossing
      // forklift may also open it between deliveries, before reaching it.
      var progress=clock.receiving.progress;
      var dockLift=progress<.14 || progress>=.78 ? 0 : progress<.20 ? (progress-.14)/.06 : progress<=.68 ? 1 : 1-(progress-.68)/.10;
      var target=model.gateOpen() ? 1 : 0;
      gateLift+=Math.sign(target-gateLift)*Math.min(Math.abs(target-gateLift),clock.dt/800);
      gate.style.setProperty('transform','translateY('+(-83*Math.max(dockLift,gateLift))+ 'px)','important');
      gate.dataset.forkliftCrossing=String(target===1);
      gate.dataset.clearanceLift=gateLift.toFixed(6);
      gate.dataset.dockProgress=progress.toFixed(6);
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
        var dockIndex=Math.abs(p.x-6)<3.1 ? 0 : Math.abs(p.x-105)<3.1 ? 1 : -1;
        var insideTrailer=dockIndex>=0 && p.y>26.8 && p.y<40 && dockTrucks[dockIndex].dataset.vehiclePhase==='loading';
        if(p.owner==='truck-in' || p.owner==='truck-out' || insideTrailer) {
          var truck=dockTrucks[p.owner==='truck-in' ? 0 : p.owner==='truck-out' ? 1 : dockIndex];
          if(item.node.nextSibling!==truck) hall.insertBefore(item.node,truck);
          item.node.depthLayer=null;
        } else place(item.node,p,true);
      });
      cargoNodes.forEach(function (item,id) {if(!live.has(id)){item.node.remove();cargoNodes.delete(id);}});
    }
    return {draw:draw};
  }
  global.WarehouseLogisticsRenderer={create:create,forklift:forklift,pallet:pallet};
})(window);
