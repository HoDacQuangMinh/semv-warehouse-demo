/* A single shipment across two short, interruptible scenes. All movement uses
   one visible-time clock; ownership changes only at matching attachment points. */
(function(global) {
  'use strict';
  var NS='http://www.w3.org/2000/svg',active=null;
  var clamp=function(n){return Math.max(0,Math.min(1,n));};
  function ease(n){n=clamp(n);return n*n*(3-2*n);}
  function range(t,a,b){return ease((t-a)/(b-a));}
  function project(x,y,z){return [240+(x-y)*9,78+(x+y)*4.3-z*12];}
  function play(kind) {
    if(active) active(false);
    if(global.Forklift.prefersReducedMotion()) return Promise.resolve(true);
    return new Promise(function(resolve) {
      var layer=document.createElement('div');layer.id='handoff';layer.className='handoff';
      layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-labelledby','handoff-title');
      layer.innerHTML='<div class="handoff__panel"><div class="handoff__top"><span class="handoff__eyebrow">BX-00001 · '+(kind==='gr' ? '01 → 02' : '02 → 03')+'</span>'
        +'<button type="button" class="btn btn-ghost" data-skip></button></div><h2 id="handoff-title"></h2>'
        +'<p class="handoff__status" role="status"></p><svg viewBox="-65 55 835 460" aria-hidden="true"><g data-floor></g>'
        +'<g data-rack></g><g data-machine></g><g data-fork></g><g data-load></g><g data-film></g>'
        +'<g data-rack-front></g><g data-person><g class="op-walk"></g></g><g data-wrapper-person><g class="op-walk"></g></g></svg>'
        +'<div class="handoff__track"><span></span></div><p class="handoff__next"></p></div>';
      document.body.appendChild(layer);
      var locked=Array.from(document.querySelectorAll('main,.topbar')).map(function(node){var value=node.inert;node.inert=true;return [node,value];});
      var previousFocus=document.activeElement;
      var media=matchMedia('(prefers-reduced-motion: reduce)');
      var frame=0,last=0,time=0,ended=false,lastStatus='';
      function finish(continueFlow) {
        if(ended) return;ended=true;cancelAnimationFrame(frame);
        document.removeEventListener('keydown',keys,true);document.removeEventListener('visibilitychange',visibility);
        document.removeEventListener('languagechange',relabel);media.removeEventListener('change',motion);
        locked.forEach(function(pair){pair[0].inert=pair[1];});layer.remove();active=null;
        if(previousFocus && previousFocus.isConnected) previousFocus.focus({preventScroll:true});
        resolve(continueFlow);
      }
      active=finish;
      var skip=layer.querySelector('[data-skip]');skip.addEventListener('click',function(){finish(true);});
      function keys(event){
        if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(true);}
        if(event.key==='Tab'){event.preventDefault();skip.focus();}
      }
      function motion(){if(media.matches)finish(true);}
      function visibility(){cancelAnimationFrame(frame);last=0;if(!document.hidden)frame=requestAnimationFrame(draw);}
      function relabel(){
        layer.querySelector('h2').textContent=global.I18N.t('handoff.'+kind+'.title');
        skip.textContent=global.I18N.t('handoff.skip');
        layer.querySelector('.handoff__next').textContent=global.I18N.t('handoff.'+kind+'.next');
        if(lastStatus)layer.querySelector('[role=status]').textContent=global.I18N.t('handoff.'+lastStatus);
      }
      relabel();skip.focus();
      document.addEventListener('keydown',keys,true);document.addEventListener('visibilitychange',visibility);
      document.addEventListener('languagechange',relabel);media.addEventListener('change',motion);
      var svg=layer.querySelector('svg');
      function mesh(selector,specs){return global.WarehouseVehicles.createMesh(svg.querySelector(selector),{vehicle:{specs:specs,wheels:[]},project:project,pivot:[0,0]});}
      var floorSpecs=[[1,7,63,27,.55,'floor',.2]];
      [9,31].forEach(function(y){floorSpecs.push([3,y,59,.13,.02,'machine',.76]);});
      for(var i=0;i<5;i++)floorSpecs.push([12+i*9,26,3,.16,.02,'machine',.77]);
      mesh('[data-floor]',floorSpecs).draw({x:0,y:0,angle:0,phase:'floor'});
      var rack=[];
      [24,33].forEach(function(x){
        [13,19].forEach(function(y){rack.push([x-.22,y-.22,.8,.8,.14,'steel',.75]);});
        rack.push([x,13,.35,.35,10.36,'rack-post',.89]);
      });
      [2.3,6,10].forEach(function(z){rack.push([24,13,9,6,.28,'rack',z]);});
      rack.push([25,14,2.6,3.7,2.3,'load',6.28],[29,14,2.6,3.7,2.3,'load',6.28]);
      mesh('[data-rack]',rack).draw({x:0,y:0,angle:0,phase:'rack'});
      mesh('[data-rack-front]',[[24,19,.35,.35,10.36,'rack-post',.89],[33,19,.35,.35,10.36,'rack-post',.89],[24,19,9,.3,.35,'rack',6]])
        .draw({x:0,y:0,angle:0,phase:'rack-front'});
      function label(text,x,y){var n=document.createElementNS(NS,'text');n.textContent=text;var p=project(x,y,.8);n.setAttribute('x',p[0]);n.setAttribute('y',p[1]);n.setAttribute('class','handoff__floor-label');svg.querySelector('[data-floor]').appendChild(n);}
      label('GR',6,30);label('PutAway',24,30);label('Pallet Interlocking',45,32);
      // Low pallet deck beneath the same carton throughout the handoff.
      var palletSpecs=[[-1.4,-1.1,2.8,2.2,.15,'wrap-pallet',0],[-1.3,-1,.35,2,.22,'wrap-pallet',.15],[.95,-1,.35,2,.22,'wrap-pallet',.15],[-1.4,-1.1,2.8,2.2,.15,'wrap-pallet',.37]];
      var boxSpecs=[[-.78,-.75,1.56,1.5,1.5,'wrap-carton',0],[-.12,-.75,.24,1.5,.025,'wrap-tape',1.5]];
      var loadMesh=mesh('[data-load]',kind==='gr' ? boxSpecs : palletSpecs.concat(boxSpecs.map(function(b){var c=b.slice();c[6]+=.52;return c;})));
      if(kind==='gr') {
        var deck=document.createElementNS(NS,'g');svg.querySelector('[data-rack]').appendChild(deck);
        global.WarehouseVehicles.createMesh(deck,{vehicle:{specs:palletSpecs,wheels:[]},project:project,pivot:[0,0]}).draw({x:28,y:18.15,z:2.58,angle:0,phase:'empty-pallet'});
      }
      var machine=svg.querySelector('[data-machine]');
      function groundPad(x,y,w,d){
        var shape=document.createElementNS(NS,'polygon');
        shape.setAttribute('points',[[x,y],[x+w,y],[x+w,y+d],[x,y+d]].map(function(p){return project(p[0],p[1],.76).join(',');}).join(' '));
        shape.setAttribute('class','iso-contact-shadow');svg.querySelector('[data-floor]').appendChild(shape);
      }
      [24,33].forEach(function(x){[13,19].forEach(function(y){groundPad(x-.3,y-.3,1,1);});});
      groundPad(54.7,16.7,2.3,2.6);
      var tableTop=[],contact=[],radius=2.45;
      for(var segment=0;segment<48;segment++) {
        var a=segment*Math.PI/24,b=(segment+1)*Math.PI/24;
        function rim(angle,z,r){return project(50+Math.cos(angle)*r,18+Math.sin(angle)*r,z).join(',');}
        tableTop.push(rim(a,1.15,radius));contact.push(rim(a,.76,radius+.15));
        if(Math.cos((a+b)/2)+Math.sin((a+b)/2)>0){
          var wall=document.createElementNS(NS,'polygon');wall.setAttribute('class','iso-wrapper-side');
          wall.setAttribute('points',[rim(a,.75,radius),rim(b,.75,radius),rim(b,1.15,radius),rim(a,1.15,radius)].join(' '));machine.appendChild(wall);
        }
      }
      var contactNode=document.createElementNS(NS,'polygon');contactNode.setAttribute('points',contact.join(' '));contactNode.setAttribute('class','iso-contact-shadow');svg.querySelector('[data-floor]').appendChild(contactNode);
      var turntable=document.createElementNS(NS,'polygon');turntable.setAttribute('points',tableTop.join(' '));
      turntable.setAttribute('class','iso-wrapper-top');machine.appendChild(turntable);
      var mast=document.createElementNS(NS,'g');machine.appendChild(mast);
      global.WarehouseVehicles.createMesh(mast,{vehicle:{specs:[[54.6,16.6,2.5,2.8,.25,'machine',.75],[55,17,1.7,2,7.8,'machine',1],[54.7,16.6,.3,.35,7.8,'steel',.9],[56.1,18.9,.8,.3,1.2,'steel',3],[56.3,19.22,.3,.05,.3,'reflective',3.5]],wheels:[]},project:project,pivot:[0,0]})
        .draw({x:0,y:0,angle:0,phase:'wrapper'});
      var person={home:{x:0,y:0},heading:0,travel:0,route:[],walking:false,carrying:true,carryHeight:1.02,crouch:.8};
      var personNode=svg.querySelector('[data-person]');
      var rig=global.WarehouseOperators.create(personNode,project,person,{clothes:'crew-c'});
      var attendant={home:{x:59,y:23},heading:-135,travel:0,route:[],walking:false};
      var attendantNode=svg.querySelector('[data-wrapper-person]');
      var attendantRig=global.WarehouseOperators.create(attendantNode,project,attendant,{clothes:'crew-d',task:'wrap'});
      var forkNode=svg.querySelector('[data-fork]');
      var fork=global.WarehouseVehicles.createMesh(forkNode,{vehicle:global.WarehouseLogisticsRenderer.forklift(),project:project,pivot:[0,0],wheelMirrorY:0});
      forkNode.style.display=kind==='gr' ? 'none' : '';
      personNode.style.display=kind==='gr' ? '' : 'none';
      var film=svg.querySelector('[data-film]');
      var filmFaces=Array.from({length:4},function(){var f=document.createElementNS(NS,'polygon');film.appendChild(f);return f;});
      var feed=document.createElementNS(NS,'path');film.appendChild(feed);
      var roll=document.createElementNS(NS,'g');machine.appendChild(roll);
      var rollSide=document.createElementNS(NS,'path'),rollTop=document.createElementNS(NS,'ellipse');
      rollSide.setAttribute('fill','#c4d4cd');rollSide.setAttribute('stroke','#82958a');rollSide.setAttribute('stroke-width','.5');
      rollTop.setAttribute('fill','#edf4ef');rollTop.setAttribute('rx','3.2');rollTop.setAttribute('ry','1.5');
      roll.appendChild(rollSide);roll.appendChild(rollTop);
      function draw(now){
        if(ended || document.hidden)return;
        if(media.matches){finish(true);return;}
        var dt=last ? Math.min(80,now-last) : 0;last=now;time+=dt/1000;
        var t=time,status,load={x:28,y:18.15,z:3.1,angle:0,phase:'rack'};
        if(kind==='gr') {
          var px=7+21*range(t,1.6,4.7),py=19.5;
          person.heading=-90*range(t,4.7,5.4);
          person.walking=t>1.6 && t<4.7;person.travel=px-7;
          person.crouch=.8*(1-range(t,.35,1.35));person.carryHeight=1.02+2.08*range(t,.35,1.35);
          person.carrying=t<6.1;
          var rad=person.heading*Math.PI/180;
          load={x:px+1.35*Math.cos(rad),y:py+1.35*Math.sin(rad),z:person.carryHeight,angle:person.heading,phase:t<.35?'receiving':t<5.5?'operator':'rack'};
          if(t>=5.5) {load.x=28;load.y=18.15;load.angle=-90;load.z=3.1;}
          var pos=project(px,py,0),origin=project(0,0,0);
          personNode.setAttribute('transform','translate('+(pos[0]-origin[0])+','+(pos[1]-origin[1])+')');rig.draw(dt,false);
          status=t<1.6?'carry.pick':t<5.5?'carry.walk':'carry.store';
        } else {
          var f={x:28,y:26-4.05*range(t,0,1.1),angle:-90,lift:2.58,phase:'retrieve'};
          if(t>=1.1){f.lift=2.58+.32*range(t,1.1,1.6);f.y=21.95+5.05*range(t,1.6,2.8);}
          if(t>=2.8){f.y=27;f.angle=-90+90*range(t,2.8,3.5);f.lift=2.9-1.65*range(t,2.8,3.5);}
          if(t>=3.5){f.angle=0;f.x=28+22*range(t,3.5,5.5);f.phase='transport';}
          if(t>=5.5){f.x=50;f.angle=-90*range(t,5.5,6.2);}
          if(t>=6.2){f.angle=-90;f.y=27-5.2*range(t,6.2,7.2);}
          if(t>=7.2){f.y=21.8;f.lift=1.25-.1*range(t,7.2,7.5);f.phase='place';}
          if(t>=7.5){f.lift=1.05;f.y=21.8+5.2*range(t,7.5,8.5);f.phase='clear';}
          if(t<1.1)load={x:28,y:18.15,z:2.58,angle:-90,phase:'rack'};
          else if(t<7.5){var a=f.angle*Math.PI/180;load={x:f.x+3.8*Math.cos(a),y:f.y+3.8*Math.sin(a),z:f.lift,angle:f.angle,phase:'forklift'};}
          else load={x:50,y:18,z:1.15,angle:-90+720*range(t,8.6,12.2),phase:t<8.6?'turntable':'wrapping'};
          fork.draw(f);forkNode.dataset.cargoOwner=load.phase;
          status=t<2.8?'pallet.retrieve':t<7.5?'pallet.transfer':t<8.6?'pallet.clear':'pallet.wrap';
        }
        loadMesh.draw(load);svg.querySelector('[data-load]').dataset.owner=load.phase;
        var wrapping=kind!=='gr' && t>=8.6;
        var rollBottom=1.67+(wrapping ? 1.14*range(t,8.6,12.2) : 0);
        var bottom=project(55,18,rollBottom),top=project(55,18,rollBottom+.4);
        rollSide.setAttribute('d','M'+(top[0]-3.2)+','+top[1]+'L'+(bottom[0]-3.2)+','+bottom[1]+'a3.2 1.5 0 0 0 6.4 0L'+(top[0]+3.2)+','+top[1]+'Z');
        rollTop.setAttribute('cx',top[0]);rollTop.setAttribute('cy',top[1]);
        attendantNode.classList.toggle('is-wrapping',wrapping);attendantNode.dataset.workTime=String(Math.max(0,t-8));attendantRig.draw(dt,false);
        film.style.display=wrapping ? '' : 'none';
        if(wrapping){
          var height=.4+1.14*range(t,8.6,12.2),rad=load.angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
          var corners=[[-.81,-.78],[.81,-.78],[.81,.78],[-.81,.78]];
          function point(p,z){return project(50+p[0]*c-p[1]*s,18+p[0]*s+p[1]*c,z).join(',');}
          filmFaces.forEach(function(face,i){var a=corners[i],b=corners[(i+1)%4];face.setAttribute('points',[point(a,1.67),point(b,1.67),point(b,1.67+height),point(a,1.67+height)].join(' '));});
          var local=[5*c,-5*s];
          var corner=corners.find(function(a){return corners.every(function(b){return (a[0]-local[0])*(b[1]-local[1])-(a[1]-local[1])*(b[0]-local[0])>=-1e-8;});});
          feed.setAttribute('d','M'+project(55,18,1.67+height-.4).join(',')+'L'+point(corner,1.67+height-.4)+'L'+point(corner,1.67+height)+'L'+project(55,18,1.67+height).join(',')+'Z');
          if(t>=12.2)feed.style.display='none';
        }
        if(lastStatus!==status){lastStatus=status;relabel();}
        var duration=kind==='gr'?7:13;
        layer.querySelector('.handoff__track span').style.transform='scaleX('+clamp(t/duration)+')';
        if(t>=duration){finish(true);return;}
        frame=requestAnimationFrame(draw);
      }
      frame=requestAnimationFrame(draw);
    });
  }
  global.WarehouseHandoff={play:play,cancel:function(){if(active)active(false);},isActive:function(){return !!active;}};
})(window);
