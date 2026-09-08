/* Detailed artwork used only by the view transition. The warehouse vehicles
   and the station-completion sprite keep their own independent renderers. */
(function (global) {
  'use strict';

  function wheel(x,y,r,front) {
    var tread='',bolts='';
    for(var i=0;i<24;i++) {
      var a=i*Math.PI/12,c=Math.cos(a),s=Math.sin(a);
      tread+='<path d="M'+(c*r*.82).toFixed(2)+','+(s*r*.82).toFixed(2)
        +'L'+(c*r*.94-s*2.2).toFixed(2)+','+(s*r*.94+c*2.2).toFixed(2)+'"/>';
    }
    for(var b=0;b<6;b++) {
      var angle=b*Math.PI/3;
      bolts+='<circle cx="'+(Math.cos(angle)*r*.25).toFixed(2)+'" cy="'+(Math.sin(angle)*r*.25).toFixed(2)+'" r="2.3" fill="#c9d0d1" stroke="#515c63" stroke-width="1.2"/>';
    }
    return '<g transform="translate('+x+' '+y+')" class="tf-wheel '+(front?'tf-wheel--front':'tf-wheel--rear')+'">'
      +'<circle r="'+r+'" fill="url(#tf-rubber)" stroke="#101519" stroke-width="2"/>'
      +'<circle r="'+(r*.77)+'" fill="none" stroke="#52595e" stroke-opacity=".65" stroke-width="1.3"/>'
      +'<circle r="'+(r*.58)+'" fill="url(#tf-rim)" stroke="#10191f" stroke-width="3"/>'
      +'<circle r="'+(r*.43)+'" fill="#56616a" stroke="#a8b1b5" stroke-width="2"/>'
      +'<g class="tf-wheel-rotation"><g fill="none" stroke="#565b5e" stroke-width="2" stroke-linecap="round" opacity=".65">'+tread+'</g>'
      +bolts+'<path d="M-5 -13h10v26H-5z" fill="#3b474f"/></g>'
      +'<circle r="'+(r*.16)+'" fill="url(#tf-metal)" stroke="#222d35" stroke-width="2"/>'
      +'</g>';
  }

  function carton(x,y,w,h) {
    var d=19;
    return '<g stroke="#896c44" stroke-width=".8" stroke-linejoin="round">'
      +'<path d="M'+x+' '+y+'l'+d+' -12h'+w+'l-'+d+' 12z" fill="url(#tf-cardboard-top)"/>'
      +'<path d="M'+(x+w)+' '+y+'l'+d+' -12v'+h+'l-'+d+' 12z" fill="#97734c"/>'
      +'<path d="M'+x+' '+y+'h'+w+'v'+h+'h-'+w+'z" fill="url(#tf-cardboard)"/>'
      +'<path d="M'+(x+w*.46)+' '+y+'l19 -12h9l-19 12v'+h+'h-9z" fill="#d9bd8e" stroke="none"/>'
      +'<path d="M'+(x+3)+' '+(y+h-3)+'h'+(w-6)+'" stroke="#8b6b43" opacity=".45"/>'
      +'</g>';
  }

  var SVG=`<svg class="transition-forklift" viewBox="0 0 800 460" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="tf-paint" x1="0" y1="0" x2=".15" y2="1"><stop stop-color="#f2b941"/><stop offset=".48" stop-color="#d99b25"/><stop offset="1" stop-color="#a76812"/></linearGradient>
    <linearGradient id="tf-paint-top" x2=".7" y2="1"><stop stop-color="#f6cf76"/><stop offset="1" stop-color="#d49a31"/></linearGradient>
    <linearGradient id="tf-paint-end"><stop stop-color="#865311"/><stop offset=".55" stop-color="#b77b19"/><stop offset="1" stop-color="#d8a03a"/></linearGradient>
    <linearGradient id="tf-chassis" x2=".3" y2="1"><stop stop-color="#52616b"/><stop offset=".45" stop-color="#303c45"/><stop offset="1" stop-color="#172128"/></linearGradient>
    <linearGradient id="tf-metal"><stop stop-color="#343f49"/><stop offset=".23" stop-color="#8c9aa2"/><stop offset=".4" stop-color="#e0e7e7"/><stop offset=".57" stop-color="#899aa4"/><stop offset="1" stop-color="#303d47"/></linearGradient>
    <linearGradient id="tf-rail"><stop stop-color="#17212a"/><stop offset=".25" stop-color="#72808b"/><stop offset=".38" stop-color="#293741"/><stop offset=".82" stop-color="#45535e"/><stop offset="1" stop-color="#121b22"/></linearGradient>
    <radialGradient id="tf-rubber" cx=".37" cy=".25" r=".77"><stop stop-color="#41494f"/><stop offset=".65" stop-color="#262d32"/><stop offset="1" stop-color="#10161b"/></radialGradient>
    <radialGradient id="tf-rim" cx=".33" cy=".25"><stop stop-color="#d3dadd"/><stop offset=".6" stop-color="#87949b"/><stop offset="1" stop-color="#4e5e68"/></radialGradient>
    <radialGradient id="tf-shadow"><stop stop-color="#0c1720" stop-opacity=".42"/><stop offset="1" stop-color="#0c1720" stop-opacity="0"/></radialGradient>
    <linearGradient id="tf-seat" x2=".7" y2="1"><stop stop-color="#41494e"/><stop offset=".5" stop-color="#1a2228"/><stop offset="1" stop-color="#080f14"/></linearGradient>
    <linearGradient id="tf-cardboard" x2=".2" y2="1"><stop stop-color="#c6a573"/><stop offset="1" stop-color="#b28c58"/></linearGradient>
    <linearGradient id="tf-cardboard-top"><stop stop-color="#dfc49a"/><stop offset="1" stop-color="#c3a276"/></linearGradient>
    <linearGradient id="tf-amber" x2="0" y2="1"><stop stop-color="#fff2a5"/><stop offset=".35" stop-color="#ffc34b"/><stop offset="1" stop-color="#a95a0a"/></linearGradient>
    <radialGradient id="tf-beacon-glow"><stop stop-color="#ffd968" stop-opacity=".7"/><stop offset="1" stop-color="#ffc543" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="397" cy="426" rx="338" ry="25" fill="url(#tf-shadow)"/>
  <ellipse cx="178" cy="426" rx="51" ry="6" fill="#101820" opacity=".16"/>
  <ellipse cx="424" cy="426" rx="66" ry="7" fill="#101820" opacity=".2"/>

  <!-- The far axle and floor pan give the side profile real depth. -->
  <ellipse cx="451" cy="364" rx="40" ry="48" fill="#141e25" stroke="#35434c" stroke-width="3"/>
  <path d="M125 356l25-21h323l28 37-36 25H132z" fill="#18232b"/>
  <path d="M132 360h341v24H132z" fill="url(#tf-chassis)"/>

  <g class="tf-body">
    <!-- Far guard posts, seat, controls and the seated driver. -->
    <path d="M249 87l-6 185M428 84l-12 199" fill="none" stroke="#34414b" stroke-width="9"/>
    <path d="M252 103l165-2-7 172-151-2z" fill="#a6c1cb" opacity=".055"/>
    <path d="M268 265h69l-7 28h-54z" fill="#121c23"/>
    <path d="M265 188q-11 0-11 12l6 49 20 6 1-17-4-44q-1-6-12-6z" fill="url(#tf-seat)" stroke="#56616a" stroke-width="1.5"/>
    <path d="M271 244q28-7 66 0l-2 18h-61q-9-2-3-18z" fill="url(#tf-seat)"/>
    <path d="M267 200l5 34M282 251h43" fill="none" stroke="#6f797c" stroke-opacity=".45" stroke-width="2"/>
    <path d="M306 238l43 11q9 2 11 13l13 38-15 5-19-38-40-3z" fill="#394a55"/>
    <path d="M295 241l34 15-3 44 12 11-7 6-22-9-2-40-20-12z" fill="#263944"/>
    <path d="M355 301l17-3 12 8 1 7h-30zM308 302l14-2 18 11-2 7h-29z" fill="#18232b"/>
    <path d="M291 195q11-12 31-9l15 17 3 30-41 15-12-27z" fill="#405563"/>
    <path d="M297 190l23-4 12 21 7 26-39 12-9-37z" fill="#d8ad35"/>
    <path d="M300 193l9 31M320 190l9 28M298 226l36-11" fill="none" stroke="#e4e7ca" stroke-width="4"/>
    <path d="M318 174v15l13 5 4-13-4-12z" fill="#b28462"/>
    <path d="M312 145q2-16 20-14 12 2 13 18l-1 5 6 8-7 3-2 11-13 4-13-11z" fill="#cda481"/>
    <path d="M312 148l9-2-1 18 6 11-11-6z" fill="#a67755"/>
    <path d="M309 143q-2-22 19-22 18 0 19 22l7 4-1 5-45-3z" fill="#dce0d8" stroke="#aeb9b7" stroke-width="1"/>
    <path d="M327 123l-1 19M308 144l42 2" stroke="#f3f4e9" stroke-width="3" fill="none"/>
    <path d="M327 194l21 25 25-9 5 8-32 14q-4 1-7-4l-22-23z" fill="#3f5360"/>
    <path d="M372 210l8-5 6 3 1 6-10 5z" fill="#cda481"/>
    <path d="M373 277l4-53" stroke="url(#tf-metal)" stroke-width="7"/>
    <g transform="rotate(-25 377 213)" fill="none" stroke="#19272f" stroke-width="4">
      <ellipse cx="377" cy="213" rx="20" ry="7"/><path d="M358 213h38M377 207v13" stroke-width="2"/>
    </g>
    <path d="M388 288l6-36M400 287l7-30" stroke="#79888f" stroke-width="3"/>
    <circle cx="394" cy="249" r="5" fill="#19232a"/><circle cx="407" cy="255" r="4" fill="#19232a"/>

    <!-- Cast counterweight, removable battery cover, footwell and fender. -->
    <path d="M122 235l21-17q8-7 28-7h58l36 28-20 13z" fill="url(#tf-paint-top)" stroke="#b57f27" stroke-width="1"/>
    <path d="M118 237q-16 7-19 25l-7 68q0 32 20 46h104l31-27 4-94-24-18z" fill="url(#tf-paint)" stroke="#9b651c" stroke-width="1.4"/>
    <path d="M98 264q-12 42 1 85l14 21 24-7-10-116-12-6z" fill="url(#tf-paint-end)"/>
    <path d="M147 255h80l7 73h-88z" fill="#dcaa42" stroke="#af7a29" stroke-width="1.3"/>
    <path d="M155 263h63M157 271h58M159 279h54M161 287h49M163 295h45" stroke="#6e501f" stroke-width="3" opacity=".75"/>
    <path d="M227 255l40 15 12 41h92l25-27 39 8 35 34 6 48H242l-24-31z" fill="url(#tf-paint)" stroke="#93611d" stroke-width="1.4"/>
    <path d="M254 266l31 10h71l31-11 12 25-28 25h-97z" fill="url(#tf-chassis)"/>
    <path d="M274 314h94l-4 14h-86z" fill="#75828a"/>
    <path d="M282 319h70M285 323h62" stroke="#25343e" stroke-width="2"/>
    <path d="M363 340q7-44 44-50 38-6 57 31l11 48-17-1q-6-44-39-45-33 0-39 44h-27z" fill="#29363f"/>
    <path d="M360 338q13-47 53-48 32 2 47 31" fill="none" stroke="#f2c460" stroke-width="5"/>
    <path d="M116 375h138l15 9h-146zM468 365l15-2v15h-18z" fill="#17232b"/>
    <path d="M246 339h91v22h-91z" fill="#ca8c25" stroke="#92651f"/>
    <path d="M247 365l67 2M151 334h50" stroke="#f1cc79" stroke-width="2" opacity=".65"/>
    <path d="M254 367h14m6 0h7m-140-21h8" stroke="#837c66" stroke-width="2"/>
    <g fill="#687680" stroke="#37454e" stroke-width="1"><circle cx="150" cy="315" r="2.5"/><circle cx="218" cy="315" r="2.5"/><circle cx="252" cy="347" r="2.5"/><circle cx="329" cy="347" r="2.5"/></g>
    <rect x="101" y="268" width="10" height="19" rx="3" fill="#661f18"/><rect x="102" y="270" width="7" height="7" rx="2" fill="#d86842"/>
    <path d="M231 278l13 23h-26z" fill="#ecd279" stroke="#464234" stroke-width="1.3"/><path d="M231 285v7m0 3v2" stroke="#464234" stroke-width="2"/>

    <!-- Near guard posts and the slatted overhead guard. -->
    <path d="M230 96l-7 155 11 26M414 95l-9 193" fill="none" stroke="#1e2c36" stroke-width="10" stroke-linejoin="round"/>
    <path d="M227 102l-6 145M411 102l-8 179" fill="none" stroke="#71818a" stroke-width="2"/>
    <path d="M209 90l25-18h199l14 10-20 16H216z" fill="url(#tf-chassis)" stroke="#192630" stroke-width="1.5"/>
    <path d="M211 91h217v11H211z" fill="#25343f"/>
    <path d="M233 77h186M251 79l-11 9m42-9-11 9m43-9-11 9m43-9-11 9m43-9-11 9m42-9-11 9" fill="none" stroke="#8b999f" stroke-width="2" opacity=".75"/>
    <path d="M218 92h197" stroke="#8f9ea7" stroke-opacity=".8" stroke-width="1.4"/>
    <rect x="390" y="99" width="17" height="10" rx="2" fill="#151f26"/><rect x="392" y="101" width="12" height="6" rx="1" fill="#e4e4ce"/>
    <path d="M423 122l15-5 2 25-14 2z" fill="#1b2831" stroke="#627781"/><path d="M426 126l9-3 1 16-9 1z" fill="#849da8"/>
    <ellipse class="tf-beacon-glow" cx="317" cy="60" rx="32" ry="26" fill="url(#tf-beacon-glow)"/>
    <path d="M306 70h24v7h-24z" fill="#1a2932"/>
    <path d="M309 68l1-14q7-7 14 0l2 14z" fill="url(#tf-amber)" stroke="#ba832b" stroke-width="1"/>
    <path d="M313 55v10" stroke="#fff3bd" stroke-width="2" opacity=".8"/>

    <!-- Tilt ram, nested mast channels, chains and low travel carriage. -->
    <path d="M427 313l56 27" stroke="#1d2a33" stroke-width="15" stroke-linecap="round"/>
    <path d="M457 327l37 18" stroke="url(#tf-metal)" stroke-width="7"/>
    <path d="M467 73h18l21 282h-19zM496 64h16l23 291h-18z" fill="url(#tf-rail)" stroke="#14212a" stroke-width="1.5"/>
    <path d="M477 77l20 270M503 70l23 279" fill="none" stroke="#b7c2c7" stroke-width="2"/>
    <path d="M471 85l28-8M480 199l30-7M487 307l29-6" stroke="#33444f" stroke-width="10"/>
    <path d="M489 115l16 218" stroke="#14232d" stroke-width="7"/><path d="M489 115l16 218" stroke="#8d989d" stroke-width="2" stroke-dasharray="3 4"/>
    <path d="M503 124l15 201" stroke="url(#tf-metal)" stroke-width="7"/>
    <path d="M462 308q-19-130 23-168l11 168" fill="none" stroke="#17232b" stroke-width="5"/>
    <path d="M460 306q-15-128 25-165" fill="none" stroke="#626e75" stroke-width="1.3"/>
    <g fill="url(#tf-rim)" stroke="#17252e" stroke-width="3"><circle cx="484" cy="153" r="7"/><circle cx="495" cy="294" r="7"/><circle cx="510" cy="189" r="6"/></g>
    <g class="tf-carriage">
      <path d="M513 185l14-9 12 176-16 8z" fill="#344751" stroke="#14232c" stroke-width="2"/>
      <path d="M526 178l35 4 8 164-33 6z" fill="#334650" fill-opacity=".12" stroke="#394c56" stroke-width="4"/>
      <path d="M537 185l8 158M549 187l8 156M528 221l35 2M530 266l35 1M534 313h33" stroke="#54656b" stroke-width="3"/>
      <path d="M493 329h44v28h-41z" fill="url(#tf-chassis)" stroke="#182831" stroke-width="2"/>
      <path d="M531 335l10 6 217-3 15-5-9 14-234 3z" fill="#485c68"/>
      <path d="M517 343h12v20h233l13-5-7 13H517z" fill="url(#tf-metal)" stroke="#243742" stroke-width="1.2"/>
      <path d="M545 345l19-13h197l-19 13z" fill="#b89a69"/>
      <path d="M545 345h197v19H545z" fill="#987746" stroke="#71542f"/>
      <path d="M742 345l19-13v19l-19 13z" fill="#765934"/>
      <path d="M552 349h39v10h-39zM612 349h43v10h-43zM681 349h48v10h-48z" fill="#453c2b"/>
      <path d="M547 344h192M548 361h191" stroke="#d0b17c" stroke-width="3"/>
      ${carton(554,278,84,64)}${carton(640,278,89,64)}
      ${carton(560,216,79,60)}${carton(641,216,84,60)}
      <path d="M581 216l19-12M581 216v127M700 216l19-12M700 216v127" fill="none" stroke="#505445" stroke-width="3.5" opacity=".85"/>
      <path d="M647 302h28v20h-28z" fill="#e4d6b8"/>
      <path d="M652 306v10m3-10v10m3-10v10m4-10v10m3-10v10m4-10v10" stroke="#53564c" stroke-width="1.5"/>
      <path d="M569 326v-12m-4 4 4-4 4 4m5 8v-12m-4 4 4-4 4 4" fill="none" stroke="#665d46" stroke-width="1.5"/>
    </g>
  </g>
  ${wheel(174,387,39,false)}
  ${wheel(419,375,51,true)}
</svg>`;

  global.TransitionForklift={markup:function () {return SVG;}};
})(window);
