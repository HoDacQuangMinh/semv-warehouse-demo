/* Articulated people in plan coordinates. Footfalls follow distance travelled,
   and every limb is projected with the same camera as the warehouse. */
(function (global) {
  'use strict';
  var NS='http://www.w3.org/2000/svg', TAU=Math.PI*2, STRIDE=2.1;
  function clamp(n) { return Math.max(0,Math.min(1,n)); }
  function smooth(n) { n=clamp(n);return n*n*(3-2*n); }
  function envelope(t,start,end) { return smooth((t-start)/.7)*smooth((end-t)/.7); }
  function mix(a,b,t) { return a+(b-a)*t; }
  function add(a,b) { return a.map(function (n,i) {return n+b[i];}); }
  function scale(a,s) { return a.map(function (n) {return n*s;}); }
  function cross(a,b) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
  function normal(a) { return scale(a,1/(Math.hypot.apply(null,a)||1)); }

  // During stance, local foot speed exactly cancels travel. Only the returning
  // foot lifts. A stopped operator settles both soles back onto the floor.
  function foot(distance,offset,weight) {
    var phase=((distance/STRIDE+offset)%1+1)%1, edge=STRIDE*.55/2;
    if(phase<.55) return {y:(edge-phase*STRIDE)*weight,z:0,stance:true};
    var t=(phase-.55)/.45;
    return {y:mix(-edge,edge,smooth(t))*weight,z:Math.pow(Math.sin(Math.PI*t),2)*.24*weight,stance:false};
  }

  function create(node,project,person,options) {
    var opts=options || {},body=node.querySelector('.iso-member-body, .op-walk');
    var parts=[],clock=opts.seed || 0,settledTime=0;
    var weight=0,greetingTime=0,lastGreeting='',lastOrder='';
    var armAngles=[0,0],headAngle=0,facing=person.heading;
    body.textContent='';
    body.classList.add('op-rig');
    function part(id,material,cls) {
      var group=document.createElementNS(NS,'g');
      group.setAttribute('class',cls || '');group.dataset.bodyPart=id;body.appendChild(group);
      var faces=Array.from({length:6},function (_,i) {
        var face=document.createElementNS(NS,'polygon');
        face.setAttribute('class','iso-'+material+'-'+(i===0?'top':i===1?'right':'left'));
        group.appendChild(face);return face;
      });
      var result={id:id,group:group,faces:faces,visible:[],points:[]};parts.push(result);return result;
    }
    var clothes=opts.clothes || 'trouser';
    var legs=[-1,1].map(function (side,i) { return {
      thigh:part('thigh-'+i,clothes,'op-leg'),shin:part('shin-'+i,clothes,'op-leg'),boot:part('boot-'+i,'tyre')
    }; });
    var hips=part('hips',clothes),torso=part('vest','vest');
    var belt=part('reflective-belt','reflective'),stripes=[part('reflective-left','reflective'),part('reflective-right','reflective')];
    var neck=part('neck','skin'),head=part('head','skin'),brim=part('helmet-brim','helmet'),helmet=part('helmet','helmet');
    var hair=opts.ponytail ? part('ponytail','hair') : null;
    var arms=[-1,1].map(function (side,i) {return {
      upper:part('upper-arm-'+i,clothes,i ? 'iso-member-arm op-arm' : 'op-arm-back'),
      lower:part('forearm-'+i,clothes),hand:part('hand-'+i,'skin')
    };});
    var scanner=opts.task==='scan' ? part('scanner','tyre') : null;
    var screen=scanner ? part('scanner-screen','glass') : null;

    function draw(dt,still) {
      var elapsed=still ? 0 : dt/1000;
      clock+=elapsed;
      var greeting=node.classList.contains('is-greeting'),serial=node.dataset.greetingSerial || '';
      var speaking=node.classList.contains('is-speaking');
      if(serial!==lastGreeting) {greetingTime=0;lastGreeting=serial;}
      if(greeting) greetingTime+=elapsed;
      var walking=!still && person.walking;
      var blend=1-Math.exp(-elapsed*12);
      weight=still ? 0 : mix(weight,walking ? 1 : 0,blend);
      var busy=!walking && !person.turning && !person.yieldTo && !person.paused && !greeting && !still;
      settledTime=busy ? settledTime+elapsed : 0;
      var taskTime=opts.task==='wrap' ? Number(node.dataset.workTime || 0) : person.route.length ? settledTime : clock%9.5;
      var wrapping=node.classList.contains('is-wrapping');
      var task=busy ? envelope(taskTime,.7,opts.task==='wrap' ? 5.4 : 3.8) : 0;
      if(opts.task==='wrap' && !wrapping) task=0;
      var wave=greeting && !still ? envelope(greetingTime,.15,2.5) : 0;
      var travel=person.travel || 0;
      var phase=travel/STRIDE*TAU,breath=still ? 0 : Math.sin(clock*1.3)*.018;
      var bob=-weight*(.065+Math.cos(phase*2)*.045)-(person.crouch || 0),lean=weight*.07;
      var glance=busy ? Math.sin(clock*.7)*.12 : 0;
      headAngle=still ? 0 : mix(headAngle,greeting ? .12 : speaking ? Math.sin(clock*2)*.09 : glance,blend);
      var targetHeading=greeting && !still ? 45 : person.heading;
      var headingGap=((targetHeading-facing+540)%360)-180;
      facing=still ? person.heading : facing+Math.sign(headingGap)*Math.min(Math.abs(headingGap),elapsed*210);
      var heading=facing*Math.PI/180;
      var c=Math.cos(heading),s=Math.sin(heading);
      function world(v) {
        return [person.home.x+v[0]*s+v[1]*c,person.home.y-v[0]*c+v[1]*s,v[2]];
      }
      function cuboid(part,center,dimensions,axes) {
        axes=axes || [[1,0,0],[0,1,0],[0,0,1]];
        var corners=[];
        for(var z=-1;z<=1;z+=2) for(var y=-1;y<=1;y+=2) for(var x=-1;x<=1;x+=2) {
          corners.push(world(add(center,add(scale(axes[0],x*dimensions[0]/2),add(scale(axes[1],y*dimensions[1]/2),scale(axes[2],z*dimensions[2]/2))))));
        }
        var projected=corners.map(function (corner) {return project.apply(null,corner).join(',');});
        // Outward winding lets hidden faces disappear during a turn.
        var indices=[[4,5,7,6],[1,3,7,5],[2,6,7,3],[0,4,6,2],[0,1,5,4],[0,2,3,1]];
        indices.forEach(function (ids,i) {
          var a=corners[ids[0]],b=corners[ids[1]],d=corners[ids[2]];
          var n=cross(b.map(function (v,j){return v-a[j];}),d.map(function (v,j){return v-a[j];}));
          var visible=n[0]+n[1]+n[2]>0;
          if(part.visible[i]!==visible) {part.faces[i].style.display=visible ? '' : 'none';part.visible[i]=visible;}
          if(visible) {
            var points=ids.map(function (id) {return projected[id];}).join(' ');
            if(part.points[i]!==points) {part.faces[i].setAttribute('points',points);part.points[i]=points;}
          }
        });
        var at=world(center);part.depth=at[0]+at[1]+at[2];
      }
      function bone(part,a,b,width,depth) {
        var z=normal(b.map(function (v,i) {return v-a[i];}));
        var x=normal(cross([0,1,0],z)),y=cross(z,x);
        cuboid(part,scale(add(a,b),.5),[width,depth,Math.hypot.apply(null,b.map(function(v,i){return v-a[i];}))],[x,y,z]);
      }
      var hipZ=2.44+bob;
      legs.forEach(function (leg,i) {
        var side=i ? 1 : -1,step=foot(travel,i*.5,weight);
        var ankle=[side*.43,step.y,1.01+step.z],hip=[side*.43,lean,hipZ];
        var delta=ankle.map(function(v,j){return v-hip[j];}),length=Math.hypot.apply(null,delta);
        var bend=Math.sqrt(Math.max(0,.72*.72-length*length/4));
        var forward=normal([0,-delta[2],delta[1]]);
        var knee=add(scale(add(hip,ankle),.5),scale(forward,bend));
        bone(leg.thigh,hip,knee,.38,.43);bone(leg.shin,knee,ankle,.32,.37);
        cuboid(leg.boot,[ankle[0],ankle[1]+.12,.9+step.z],[.43,.74,.24]);
      });
      cuboid(hips,[0,lean,hipZ],[1.12,.69,.38]);
      var chest=2.91+bob+breath;
      cuboid(torso,[0,lean,chest],[1.45,.83,1.26]);
      cuboid(belt,[0,lean,chest-.31],[1.47,.86,.11]);
      [-1,1].forEach(function (side,i) {cuboid(stripes[i],[side*.41,lean+.425,chest+.2],[.12,.025,.78]);});
      cuboid(neck,[0,lean,3.6+bob+breath],[.34,.35,.25]);
      var hc=Math.cos(headAngle),hs=Math.sin(headAngle),headAxes=[[hc,hs,0],[-hs,hc,0],[0,0,1]];
      var nod=task*.065;
      cuboid(head,[0,lean+nod,3.89+bob+breath],[.81,.73,.61],headAxes);
      cuboid(brim,[0,lean+.05+nod,4.23+bob+breath],[1.09,1.01,.12],headAxes);
      cuboid(helmet,[0,lean+nod,4.38+bob+breath],[.94,.86,.22],headAxes);
      if(hair) cuboid(hair,[0,lean-.46,3.64+bob+breath],[.42,.25,.66],headAxes);
      var hands=[];
      arms.forEach(function (arm,i) {
        var side=i ? 1 : -1;
        var swing=Math.sin(phase+i*Math.PI)*.34*weight;
        var target=swing;
        if(!walking) target=task*(opts.task==='scan' ? 1.0 : .62)*(i ? 1 : .35);
        if(speaking && !still) target+=(.32+Math.sin(clock*3)*.12)*(i ? 1 : .3);
        if(i===1 && wave) target=wave*(2.4+Math.sin(greetingTime*TAU*2.1)*.21);
        armAngles[i]=still ? 0 : mix(armAngles[i],target,blend);
        var angle=armAngles[i],shoulder=[side*.88,lean,3.35+bob+breath];
        var elbow=[shoulder[0]+side*wave*(i ? .16 : 0),shoulder[1]+Math.sin(angle)*.56,shoulder[2]-Math.cos(angle)*.56];
        var foreAngle=angle+.16+task*.46;
        var hand=[elbow[0]+(i ? wave*.24 : 0),elbow[1]+Math.sin(foreAngle)*.51,elbow[2]-Math.cos(foreAngle)*.51];
        if(person.carrying) {
          elbow=[side*.72,.48,3.02+bob];
          hand=[side*.66,1.04,(person.carryHeight || 2.3)+.4];
        }
        bone(arm.upper,shoulder,elbow,.29,.34);bone(arm.lower,elbow,hand,.25,.28);
        cuboid(arm.hand,hand,[.27,.3,.27]);hands.push(hand);
      });
      if(scanner) {
        cuboid(scanner,add(hands[1],[0,.16,.13]),[.34,.42,.22]);
        cuboid(screen,add(hands[1],[0,.16,.245]),[.24,.28,.015]);
      }
      var ordered=parts.slice().sort(function(a,b){return a.depth-b.depth;});
      var order=ordered.map(function(p){return p.id;}).join(',');
      if(order!==lastOrder) {ordered.forEach(function(p){body.appendChild(p.group);});lastOrder=order;}
      node.dataset.operatorHeading=facing.toFixed(1);
      node.dataset.operatorAction=greeting ? 'greeting' : person.yieldTo ? (walking ? 'stepping-aside' : 'waiting')
        : walking ? 'walking' : person.turning ? 'turning' : task>.05 ? (opts.task==='wrap' ? 'wrapping' : 'checking') : 'idle';
    }
    return {draw:draw};
  }
  global.WarehouseOperators={create:create,foot:foot};
})(window);
