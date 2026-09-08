/* Warehouse architecture and surface detail, projected with the same geometry
   as the working equipment. Decorative layers never intercept a station tap. */
(function (global) {
  'use strict';
  function create(options) {
    var project=options.point,box=options.box;
    function p(x,y,z) {return project(x,y,z).join(',');}
    function polygon(points,cls) {return '<polygon class="'+cls+'" points="'+points.join(' ')+'"/>';}
    function pad(x,y,w,d,cls,z) {return polygon([p(x,y,z || .78),p(x+w,y,z || .78),p(x+w,y+d,z || .78),p(x,y+d,z || .78)],cls);}
    function path(points,cls) {return '<path class="'+cls+'" d="M'+points.join('L')+'"/>';}
    function escape(value) {return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
    function sign(x,y,z,label,cls,size) {
      var at=project(x,y,z);
      return '<text class="'+cls+'" transform="matrix(.866 .5 0 1 '+at[0]+' '+at[1]+')" text-anchor="middle" font-size="'+size+'">'+escape(label)+'</text>';
    }
    function definitions() {
      var speckles='',seed=19;
      for(var i=0;i<85;i++) {
        seed=(seed*16807)%2147483647;var x=seed%64;
        seed=(seed*16807)%2147483647;var y=seed%64;
        speckles+='<circle cx="'+x+'" cy="'+y+'" r="'+(i%3 ? '.35' : '.65')+'"/>';
      }
      return '<defs>'
        + '<clipPath id="warehouse-floor-clip">'+pad(0,0,112,66,'')+'</clipPath>'
        + '<pattern id="warehouse-concrete" width="64" height="64" patternUnits="userSpaceOnUse"><g class="iso-concrete-speckle">'+speckles+'</g></pattern>'
        + '<linearGradient id="warehouse-floor-light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".18"/><stop offset=".55" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#142a37" stop-opacity=".16"/></linearGradient>'
        + '<filter id="warehouse-cast-soft" x="-15%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="1.8"/></filter>'
        + '<filter id="warehouse-base-soft" x="-15%" y="-25%" width="140%" height="170%"><feGaussianBlur stdDeviation="9"/></filter>'
        + '</defs>';
    }
    function foundation() {
      return '<g class="iso-environment">'+pad(1.5,2.5,112,66,'iso-foundation-shadow',-2)
        + box(0,0,112,66,2.2,'foundation',-1.5)+'</g>';
    }
    function floorFinish() {
      var out=pad(0,0,112,66,'iso-concrete-texture')+pad(0,0,112,66,'iso-floor-light');
      out+=path([p(.6,65.3,.8),p(111.3,65.3,.8),p(111.3,.6,.8)],'iso-perimeter-line');
      [25,56,84].forEach(function(x) {
        [[32,1],[38,-1]].forEach(function(lane) {
          var y=lane[0],s=lane[1];
          out+=polygon([[x-2*s,y-.3],[x+.6*s,y-.3],[x+.6*s,y-1.1],[x+2*s,y],[x+.6*s,y+1.1],[x+.6*s,y+.3],[x-2*s,y+.3]].map(function(a){return p(a[0],a[1],.81);}), 'iso-traffic-arrow');
        });
      });
      for(var y=29.5;y<41;y+=1.65) out+=pad(38,y,3.5,.8,'iso-crosswalk');
      [6,105].forEach(function(x) {
        [x-2,x+2].forEach(function(lane) {
          out+=path([p(lane,29,.8),p(lane,43,.8),p(lane+3,49,.8)],'iso-tyre-mark');
        });
      });
      return '<g class="iso-environment" clip-path="url(#warehouse-floor-clip)">'+out+'</g>';
    }
    function shadows() {
      var out='';
      [[0,1,13,26,14],[99,1,13,26,14],
        [12,47,9.6,11.4,13],[26,47,9.6,11.4,11],[86,48,9.3,11.2,10],
        [40,49,4,13,4.5],[44,58,8,4,4.5],[71,50,3.2,4,23]].forEach(function(a) {
        var x=a[0],y=a[1],w=a[2],d=a[3],sx=a[4]*.48,sy=a[4]*.27;
        out+=polygon([[x,y],[x+w,y],[x+w+sx,y+sy],[x+w+sx,y+d+sy],[x+sx,y+d+sy],[x,y+d]].map(function(v){return p(v[0],v[1],.8);}), 'iso-cast-shadow');
        out+=pad(x-.2,y-.2,w+.4,d+.4,'iso-contact-shadow');
      });
      // Open racks contact the floor at their six feet, not across a solid
      // rectangular block. Upright shadows meet each footplate exactly.
      [23,63].forEach(function(x){
        out+='<g class="iso-rack-shadow">';
        [0,10.5,21].forEach(function(dx){[3,17].forEach(function(y){
          var px=x+dx,sx=16*.48,sy=16*.27;
          out+=polygon([[px,y],[px+.7,y],[px+.7+sx,y+sy],[px+.7+sx,y+.7+sy],[px+sx,y+.7+sy],[px,y+.7]].map(function(v){return p(v[0],v[1],.78);}), 'iso-rack-upright-shadow');
          out+=pad(px-.55,y-.4,1.9,1.9,'iso-contact-shadow');
        });});
        out+=pad(x+15.5*.48,3+15.5*.27,21,14,'iso-rack-deck-shadow');
        out+='</g>';
      });
      var turntable=[];
      for(var i=0;i<48;i++){var a=i*Math.PI/24;turntable.push(p(63+7.38*Math.cos(a),53+7.38*Math.sin(a),.74));}
      out+='<g class="iso-wrapper-grounding">'+polygon(turntable,'iso-contact-shadow')
        +pad(69.85,48.85,5.3,8.3,'iso-contact-shadow')+'</g>';
      return '<g class="iso-environment iso-equipment-shadows" clip-path="url(#warehouse-floor-clip)">'+out+'</g>'
        + '<g id="warehouse-moving-shadows" class="iso-environment" clip-path="url(#warehouse-floor-clip)"></g>';
    }
    function areaGuides() {
      var areas=[
        ['gr',10,43,27,21],
        ['putaway',21.5,1,65.5,27],
        ['interlock',39,43,39,21],
        ['returnables',84.5,46.5,25,17.5]
      ];
      return '<g class="iso-environment iso-area-guides" aria-hidden="true">'+areas.map(function(area) {
        return '<g data-guide-area="'+area[0]+'">'+pad(area[1],area[2],area[3],area[4],'iso-area-guide',.82)+'</g>';
      }).join('')+'</g>';
    }
    function shell(label) {
      var out=box(0,-2,112,1.8,15.5,'wall',.7);
      for(var z=2;z<16;z+=1.8) out+=box(0,-.22,112,.13,.12,'wallrib',z);
      out+=box(-1.5,0,1.4,42,3.6,'wall',.7)+box(-1.65,0,1.65,42,.25,'beamrail',4.3);
      [0,16,53,91,111].forEach(function(x) {
        out+=box(x-.35,-.2,1.5,1.5,.7,'steel',.7);
        out+=box(x,-.1,.65,.85,16,'column',.7);
        out+=box(x-.2,-.15,1.1,.22,16,'beamrail',.7);
        out+=box(x-.2,.68,1.1,.22,16,'beamrail',.7);
      });
      out+=box(0,-.1,112,.75,.65,'beamrail',16.2);
      out+=path([p(3,.75,11.2),p(109,.75,11.2)],'iso-service-pipe');
      [18,52,89].forEach(function(x) {
        out+=box(x,-.1,4,2,.45,'steel',14.2);
        out+=pad(x+.25,.1,3.5,1.55,'iso-luminaire',14.16);
      });
      out+=box(39,-.04,28,.22,3.4,'signboard',11.8);
      out+=sign(53,.2,12.65,label,'iso-building-sign',12);
      // A rear-wall service cabinet and fire station add scale without taking
      // space from the pedestrian routes or forklift turning areas.
      out+=box(55,.3,2.4,1,4.7,'steel',1)+box(58,.3,1,1,2.6,'safety',1.2);
      return '<g class="iso-environment iso-building-shell">'+out+'</g>';
    }
    function rackStock(x,level,z) {
      var out='';
      var slots=level===0 ? [12.2] : level===1 ? [2,12.2] : [12.2];
      slots.forEach(function(dx) {
        var at=x+dx,depth=level===2 ? 7.5 : 10.2;
        out+=box(at,depth,6.3,4.8,.3,'wood',z+.42);
        out+=box(at+.15,depth+.1,2.8,4.5,2.5,'load',z+.72);
        out+=box(at+3.15,depth+.1,2.8,4.5,2.5,'load',z+.72);
        out+=pad(at+1.35,depth+.1,.35,4.5,'iso-carton-tape',z+3.23);
        out+=pad(at+4.35,depth+.1,.35,4.5,'iso-carton-tape',z+3.23);
        out+=polygon([p(at+.65,depth+4.61,z+1.4),p(at+1.75,depth+4.61,z+1.4),p(at+1.75,depth+4.61,z+2.1),p(at+.65,depth+4.61,z+2.1)],'iso-stock-label');
      });
      return '<g class="iso-stored-stock">'+out+'</g>';
    }
    function rackDetails(x,id) {
      var out='';
      [0,10.5,21].forEach(function(dx) {
        out+=box(x+dx-.25,17,1.2,1.2,1.8,'machine',.7);
        out+=box(x+dx-.15,17.1,1,1,.35,'tyre',1.35);
      });
      out+=sign(x+10.5,17.76,14.9,id,'iso-rack-id',8);
      return out;
    }
    function dockDetails(x,id) {
      var out='';
      [x+.5,x+11.5].forEach(function(at) {
        out+=box(at,26.6,.8,.85,1.6,'tyre',.7);
        out+=box(at+.12,26.75,.55,.6,.24,'machine',1.65);
      });
      out+=sign(x+6.5,27.15,12.2,id,'iso-dock-id',10);
      return out;
    }
    return {definitions:definitions,foundation:foundation,floorFinish:floorFinish,shadows:shadows,areaGuides:areaGuides,shell:shell,rackStock:rackStock,rackDetails:rackDetails,dockDetails:dockDetails};
  }
  global.WarehouseEnvironment={create:create};
})(window);
