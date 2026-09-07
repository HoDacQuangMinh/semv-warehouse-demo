/* Warehouse activity model. Cargo has one owner; lifts and transfers happen
   only while stopped. Pedestrians clear an approaching forklift's path. */
(function (global) {
  'use strict';
  var RAD=Math.PI/180;
  function distance(a,b) { return Math.hypot(a.x-b.x,a.y-b.y); }
  function toward(a,b,step) {
    var length=distance(a,b), t=length ? Math.min(1,step/length) : 1;
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,arrived:t===1};
  }
  function turn(a,b,step) {
    var delta=((b-a+540)%360)-180;
    return Math.abs(delta)<=step ? b : a+Math.sign(delta)*step;
  }
  function forkPoint(f) { return {x:f.x+3.8*Math.cos(f.angle*RAD),y:f.y+3.8*Math.sin(f.angle*RAD),z:f.lift}; }
  function move(x,y,angle) { return {type:'move',x:x,y:y,angle:angle}; }
  function rotate(angle) { return {type:'turn',angle:angle}; }
  function lift(z) { return {type:'lift',z:z}; }
  function wait(condition) { return {type:'wait',condition:condition}; }
  function pickup(owner) { return {type:'pickup',owner:owner}; }
  function drop(owner) { return {type:'drop',owner:owner}; }
  function pause(seconds) { return {type:'pause',seconds:seconds}; }

  var RECEIVING=[
    wait('inbound-ready'),lift(2.3),move(6,26,90),pickup('truck-in'),lift(2.7),move(6,20,90),lift(1.32),drop('blue-buffer'),move(6,16,90),pause(1),
    move(6,20,90),pickup('blue-buffer'),lift(1.65),wait('blue-clear'),move(6,31,90),rotate(0),move(28,31,0),rotate(-90),
    wait('ground-free'),move(28,16,-90),lift(.85),drop('rack-ground'),move(28,25,-90),move(28,31,-90),
    rotate(180),move(18,31,180),wait('blue-clear'),move(6,31,180),rotate(-90),move(6,20,-90),rotate(90)
  ];
  var SHIPPING=[
    wait('ground-ready'),move(28,25,180),rotate(-90),move(28,16,-90),lift(.85),pickup('rack-ground'),lift(1.05),
    move(28,25,-90),rotate(0),move(68,25,0),rotate(-90),lift(7.45),move(68,19,-90),lift(7.12),drop('rack-upper'),
    lift(6.9),move(68,24,-90),pause(1.5),lift(7.12),move(68,19,-90),pickup('rack-upper'),lift(7.45),
    move(68,25,-90),lift(1.05),rotate(0),move(92,25,0),rotate(90),move(92,32,90),rotate(0),wait('green-clear'),
    move(105,32,0),rotate(-90),move(105,12,-90),lift(.85),drop('green-buffer'),move(105,16,-90),pause(1),
    move(105,12,-90),pickup('green-buffer'),lift(1.05),move(105,18,-90),rotate(90),wait('outbound-ready'),
    lift(2.7),move(105,26,90),lift(2.3),drop('truck-out'),move(105,18,90),lift(.85),wait('green-clear'),
    move(105,37,90),rotate(180),move(52,37,180),rotate(-90),move(52,25,-90),rotate(180)
  ];

  function create(options) {
    var opts=options || {};
    var people=(opts.people || []).map(function (p) {
      return {id:p.id,x:p.x,y:p.y,home:{x:p.x,y:p.y},route:p.route || [],target:1,speed:p.speed || 2.8,
        paused:false,walking:false,yieldTo:null,aside:null,returning:false};
    });
    var forklifts=[
      {id:'aisle-truck',x:6,y:20,angle:90,lift:.85,program:RECEIVING,step:0,elapsed:0,cargo:null,phase:'waiting',speed:4.5},
      {id:'shuttle',x:68,y:24,angle:-90,lift:.85,program:SHIPPING,step:18,elapsed:0,cargo:null,phase:'waiting',speed:4.5}
    ];
    var cargo=[{id:'pallet-0',owner:'rack-upper',x:68,y:15.2,z:7.12,angle:-90}], serial=0, delivered=0, trips=0;
    var trucks={receiving:{phase:'away',progress:.9,y:80},shipping:{phase:'away',progress:.9,y:80}};
    function owned(owner) { return cargo.find(function (p) { return p.owner===owner; }); }
    function ready(truck) { return truck.phase==='loading' && truck.progress>=.20 && truck.progress<.37; }
    function clear(truck) { return truck.phase==='away' && truck.progress<.89; }
    function condition(name,f) {
      if(name==='inbound-ready') return ready(trucks.receiving) && !owned('truck-in');
      if(name==='outbound-ready') return ready(trucks.shipping) && !owned('truck-out');
      if(name==='blue-clear') return clear(trucks.receiving);
      if(name==='green-clear') return clear(trucks.shipping);
      if(name==='ground-free') return !owned('rack-ground') && forklifts[1].x>38;
      if(name==='ground-ready') return !!owned('rack-ground') && forklifts[0].x<20;
      return true;
    }
    function advance(f) { f.step=(f.step+1)%f.program.length; f.elapsed=0; }
    function beginYield(person,f) {
      if(person.yieldTo || person.paused) return;
      var heading=f.angle*RAD, nx=-Math.sin(heading), ny=Math.cos(heading);
      // Step to the closer side of the lane, away from the vehicle centreline.
      var sign=(person.x-f.x)*nx+(person.y-f.y)*ny>=0 ? 1 : -1;
      var offset=4.2;
      person.aside={x:Math.max(2,Math.min(110,person.x+nx*sign*offset)),y:Math.max(2,Math.min(65,person.y+ny*sign*offset))};
      person.resume={x:person.x,y:person.y};
      person.yieldTo=f.id;
      person.returning=false;
    }
    function obstructing(person,f,next) {
      var dx=next.x-f.x,dy=next.y-f.y,len=Math.hypot(dx,dy);
      if(!len) return false;
      dx/=len;dy/=len;
      var along=(person.x-f.x)*dx+(person.y-f.y)*dy;
      var across=Math.abs((person.x-f.x)*dy-(person.y-f.y)*dx);
      return along>-1.5 && along<8.2 && across<2.7;
    }

    function update(dt,states) {
      dt=Math.max(0,Math.min(dt,.1));
      if(states) trucks=states;
      cargo=cargo.filter(function (p) {
        if(p.owner==='truck-out' && trucks.shipping.phase==='away') { delivered++; return false; }
        if(p.owner==='truck-out') {
          var angle=trucks.shipping.angle*RAD;
          p.x=trucks.shipping.x+Math.cos(angle)*7.2;
          p.y=trucks.shipping.y+Math.sin(angle)*7.2;
          p.angle=trucks.shipping.angle+90;
        }
        return true;
      });
      people.forEach(function (person) {
        person.walking=false;
        if(person.paused) return;
        if(person.yieldTo) {
          var f=forklifts.find(function (f) { return f.id===person.yieldTo; });
          if(!person.returning) {
            var result=toward(person,person.aside,dt*3.4);
            person.x=result.x;person.y=result.y;person.walking=!result.arrived;
            if(result.arrived && distance(person,f)>11) person.returning=true;
          } else {
            var back=toward(person,person.resume,dt*2.8);
            person.x=back.x;person.y=back.y;person.walking=!back.arrived;
            if(back.arrived) { person.yieldTo=null;person.aside=null; }
          }
          return;
        }
        if(person.route.length>1) {
          var target=person.route[person.target];
          var step=toward(person,{x:target[0],y:target[1]},dt*person.speed);
          person.x=step.x;person.y=step.y;person.walking=true;
          if(step.arrived) person.target=(person.target+1)%person.route.length;
        }
      });

      forklifts.forEach(function (f) {
        var action=f.program[f.step];
        f.phase=action.type; f.waitingFor=null;
        if(action.type==='wait') {
          f.phase='waiting';f.waitingFor=action.condition;
          if(condition(action.condition,f)) {
            if(action.condition==='inbound-ready') {
              cargo.push({id:'pallet-'+(++serial),owner:'truck-in',x:6,y:29.8,z:2.3});
            }
            advance(f);
          }
        } else if(action.type==='move') {
          var blocked=people.filter(function (p) { return obstructing(p,f,action); });
          if(blocked.length) {
            f.phase='yielding'; f.waitingFor=blocked[0].id;
            blocked.forEach(function (p) { beginYield(p,f); });
          } else {
            var step=toward(f,action,dt*f.speed);
            f.x=step.x;f.y=step.y;f.angle=action.angle;
            if(step.arrived) advance(f);
          }
        } else if(action.type==='turn') {
          f.angle=turn(f.angle,action.angle,dt*75);
          if(Math.abs(((f.angle-action.angle+540)%360)-180)<.01) advance(f);
        } else if(action.type==='lift') {
          var gap=action.z-f.lift;
          f.lift+=Math.sign(gap)*Math.min(Math.abs(gap),dt*2.4);
          f.phase=gap>=0 ? 'raising' : 'lowering';
          if(Math.abs(f.lift-action.z)<.001) advance(f);
        } else if(action.type==='pickup') {
          var pallet=owned(action.owner);
          if(pallet) { pallet.owner=f.id;f.cargo=pallet.id;advance(f); }
        } else if(action.type==='drop') {
          var pallet=owned(f.id);
          if(pallet) {
            var point=forkPoint(f);
            pallet.x=point.x;pallet.y=point.y;pallet.z=point.z;pallet.angle=f.angle;pallet.owner=action.owner;f.cargo=null;
            if(action.owner==='rack-ground') trips++;
            advance(f);
          }
        } else if(action.type==='pause') {
          f.elapsed+=dt;if(f.elapsed>=action.seconds) advance(f);
        }
        var pallet=owned(f.id);
        if(pallet) { var point=forkPoint(f);pallet.x=point.x;pallet.y=point.y;pallet.z=point.z; }
      });
    }
    return {people:people,forklifts:forklifts,update:update,cargo:function(){return cargo;},
      gateOpen:function () {var f=forklifts[0];return f.x<15 && f.y>20;},
      stats:function(){return {received:serial,stored:trips,delivered:delivered};}};
  }
  global.WarehouseLogistics={create:create,forkPoint:forkPoint};
})(window);
