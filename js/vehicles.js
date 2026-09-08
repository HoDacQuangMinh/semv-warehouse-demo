/* Turn in plan coordinates, then project: the cab stays upright while the
   truck turns, reverses to its dock, loads, and drives away cab first. */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function mix(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
  function ease(t) { t=Math.max(0,Math.min(1,t));return t*t*(3-2*t); }

  function pose(progress, dockX, receiving) {
    var side = receiving ? -1 : 1;
    var dockAt = receiving ? .14 : .20, leaveAt = receiving ? .68 : .60;
    var turnAt = receiving ? .04 : .05, reverseAt = receiving ? .09 : .13;
    var exitTurnAt = receiving ? .76 : .70, goneAt = receiving ? .84 : .80;
    var bendX = dockX + side * 21;
    var parked = {x:dockX, y:37, angle:-90, phase:'loading'};
    if (progress < turnAt) {
      return {x:mix(bendX + side * 22,bendX,progress / turnAt),y:53,angle:receiving ? -180 : 0,phase:'approaching'};
    }
    if (progress < reverseAt) {
      var t = (progress - turnAt) / (reverseAt - turnAt);
      var a = (-90 - side * t * 90) * Math.PI / 180;
      return {x:bendX + Math.cos(a) * 21,y:74 + Math.sin(a) * 21,
        angle:mix(receiving ? -180 : 0,-90,t),phase:'turning'};
    }
    if (progress < dockAt) {
      return {x:dockX,y:mix(74,37,ease((progress - reverseAt) / (dockAt - reverseAt))),angle:-90,phase:'reversing'};
    }
    if (progress < leaveAt) { return parked; }
    if (progress < exitTurnAt) {
      return {x:dockX,y:mix(37,64,ease((progress - leaveAt) / (exitTurnAt - leaveAt))),angle:-90,phase:'departing'};
    }
    var exitT = Math.min(1,(progress - exitTurnAt) / (goneAt - exitTurnAt));
    var exitA = (receiving ? exitT * 90 : 180 - exitT * 90) * Math.PI / 180;
    return {x:bendX + Math.cos(exitA) * 21,y:64 + Math.sin(exitA) * 21,
      angle:mix(-90,receiving ? 0 : -180,exitT),phase:progress < goneAt ? 'turning-out' : 'away'};
  }

  function createMesh(node, options) {
    var opts = options;
    var shadow=null;
    if(opts.shadow) {
      var layer=node.closest('svg').querySelector('#warehouse-moving-shadows');
      if(layer) {
        shadow=document.createElementNS(NS,'polygon');shadow.setAttribute('class','iso-vehicle-shadow');layer.appendChild(shadow);
      }
    }
    var parts = opts.vehicle.specs.map(function (spec) {
      var group = document.createElementNS(NS,'g');
      var faces = ['top','right','left'].map(function (face) {
        var polygon = document.createElementNS(NS,'polygon');
        polygon.setAttribute('class','iso-' + spec[5] + '-' + face);
        group.appendChild(polygon);
        return polygon;
      });
      node.appendChild(group);
      return {spec:spec,group:group,faces:faces};
    });
    var wheelGroup = document.createElementNS(NS,'g');
    node.appendChild(wheelGroup);
    var wheels = opts.vehicle.wheels.map(function (spec) {
      var tyre = document.createElementNS(NS,'polygon');
      var hub = document.createElementNS(NS,'polygon');
      tyre.setAttribute('class','iso-tyre-disc'); hub.setAttribute('class','iso-hub-disc');
      wheelGroup.appendChild(tyre); wheelGroup.appendChild(hub);
      return {spec:spec,tyre:tyre,hub:hub};
    });
    var previous = '', previousAngle = null,previousDoors=null;

    function draw(state) {
      var signature = [state.x,state.y,state.angle,state.lift || 0,state.z || 0,state.doors || 0].map(function (n) { return n.toFixed(2); }).join(',');
      node.dataset.vehiclePhase = state.phase;
      if (signature === previous) { return; }
      previous = signature;
      node.dataset.vehicleX = state.x.toFixed(2);
      node.dataset.vehicleY = state.y.toFixed(2);
      node.dataset.vehicleHeading = state.angle.toFixed(2);
      var a = state.angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      function world(x,y) {
        x -= opts.pivot ? opts.pivot[0] : 4.1; y -= opts.pivot ? opts.pivot[1] : 3;
        return [state.x + x * c - y * s,state.y + x * s + y * c];
      }
      var joint=null;
      function point(x,y,z) {
        if(joint) {
          var angle=(state.doors || 0)*Math.PI*1.5*joint.sign,dx=x-joint.x,dy=y-joint.y;
          x=joint.x+dx*Math.cos(angle)-dy*Math.sin(angle);
          y=joint.y+dx*Math.sin(angle)+dy*Math.cos(angle);
        }
        var xy = world(x,y);
        return opts.project(xy[0],xy[1],z).join(',');
      }
      if(shadow) {
        var footprint=opts.shadow;
        shadow.setAttribute('points',[[0,0],[footprint[2],0],[footprint[2],footprint[3]],[0,footprint[3]]].map(function (corner) {
          var at=world(footprint[0]+corner[0],footprint[1]+corner[1]);
          return opts.project(at[0]+1,at[1]+.6,.79).join(',');
        }).join(' '));
        shadow.style.opacity=state.phase==='away' ? '0' : '';
      }
      parts.forEach(function (part) {
        var b = part.spec, x=b[0], y=b[1], w=b[2], d=b[3];
        joint=typeof b[7]==='object' ? b[7] : null;
        var z=(b[6] || 0)+(b[7]==='carriage' ? state.lift || 0 : state.z || 0);
        var top=z+b[4]+(b[7]==='mast' ? Math.max(0,(state.lift || 0)-3) : 0);
        var faceAngle=a+(joint ? (state.doors || 0)*Math.PI*1.5*joint.sign : 0);
        var faceX = Math.cos(faceAngle) + Math.sin(faceAngle) >= 0 ? x + w : x;
        var faceY = Math.cos(faceAngle) - Math.sin(faceAngle) >= 0 ? y + d : y;
        part.faces[0].setAttribute('points',[point(x,y,top),point(x+w,y,top),point(x+w,y+d,top),point(x,y+d,top)].join(' '));
        part.faces[1].setAttribute('points',[point(faceX,y,top),point(faceX,y+d,top),point(faceX,y+d,z),point(faceX,y,z)].join(' '));
        part.faces[2].setAttribute('points',[point(x,faceY,top),point(x+w,faceY,top),point(x+w,faceY,z),point(x,faceY,z)].join(' '));
        var cx=x+w/2,cy=y+d/2;
        if(joint){var ja=(state.doors || 0)*Math.PI*1.5*joint.sign,jx=cx-joint.x,jy=cy-joint.y;
          cx=joint.x+jx*Math.cos(ja)-jy*Math.sin(ja);cy=joint.y+jx*Math.sin(ja)+jy*Math.cos(ja);}
        var center = world(cx,cy);
        part.depth = center[0] + center[1] + z * .001;
      });
      joint=null;
      if (previousAngle !== state.angle || previousDoors!==state.doors) {
        parts.slice().sort(function (a,b) { return a.depth-b.depth; }).forEach(function (part) { node.insertBefore(part.group,wheelGroup); });
        previousAngle = state.angle;
        previousDoors=state.doors;
      }
      wheels.forEach(function (wheel) {
        var w=wheel.spec, sideY=c-s >= 0 ? w[1] : (opts.wheelMirrorY===undefined ? 6 : opts.wheelMirrorY)-w[1];
        function circle(radius) {
          var points=[];
          for(var i=0;i<16;i++) {
            var angle=i*Math.PI/8;
            points.push(point(w[0]+radius*Math.cos(angle),sideY,w[2]+radius*Math.sin(angle)));
          }
          return points.join(' ');
        }
        wheel.tyre.setAttribute('points',circle(w[3]));
        wheel.hub.setAttribute('points',circle(w[3]*.4));
      });
    }
    return {draw:draw};
  }

  function create(node, opts) {
    var mesh=createMesh(node,opts), current,heldAnimation=null,dockHold=null,departureRequested=false;
    function draw(progress) {
      current=pose(progress,opts.x,opts.receiving);
      current.progress=progress;
      var dockAt=.20,leaveAt=opts.receiving ? .68 : .60;
      current.doors=ease((progress-dockAt)/.035)*(1-ease((progress-(leaveAt-.04))/.035));
      node.dataset.doorOpen=current.doors.toFixed(3);
      mesh.draw(current);
    }
    draw(.4);
    return {
      state:function () { return current; },
      holdDock:function (needed) {
        var animation=node.getAnimations()[0];
        if(dockHold && dockHold!==animation) dockHold=null;
        if(dockHold && !needed) { dockHold.play();dockHold=null; }
        if(animation && needed && animation.playState==='running' && current.phase==='loading' && current.progress>=.48) {
          animation.pause();dockHold=animation;
        }
        node.dataset.loadingHold=String(!!dockHold);
      },
      clearLane:function (needed) {
        var animation=node.getAnimations()[0];
        node.dataset.lanePriority=String(needed);
        if(heldAnimation && heldAnimation!==animation) heldAnimation=null;
        if(!animation) return;
        if(!needed && heldAnimation) {animation.play();heldAnimation=null;}
        node.dataset.trafficHold=String(!!heldAnimation);
        if(!needed || (animation.playState!=='running' && heldAnimation!==animation)) return;
        var timing=animation.effect.getTiming(),duration=timing.duration,delay=timing.delay;
        var progress=((((animation.currentTime || 0)-delay)%duration+duration)%duration)/duration;
        var state=pose(progress,opts.x,opts.receiving);
        // A parked truck can start its departure without a position jump.
        // Keep it away until the forklift has reversed clear of the entrance.
        if(!needed || state.phase!=='loading') departureRequested=false;
        if(state.phase==='loading' && !departureRequested) {
          // Leave time to close both doors before the tractor pulls away.
          animation.currentTime+=Math.max(0,.56-progress)*duration;departureRequested=true;
        }
        else if(state.phase==='away' && !heldAnimation) {
          animation.pause();heldAnimation=animation;node.dataset.trafficHold='true';
        }
      },
      update:function (still) {
        var animation=node.getAnimations()[0];
        if(still || !animation) { draw(.4); return; }
        var duration=animation.effect.getTiming().duration;
        var delay=animation.effect.getTiming().delay;
        draw((((animation.currentTime || 0)-delay)%duration+duration)%duration/duration);
      }
    };
  }
  global.WarehouseVehicles={create:create,createMesh:createMesh,pose:pose};
})(window);
