/* Four particle stories, one screen-wide formation layer and one animation clock. */
(() => {
  'use strict';
  const W=600,H=270,TAU=Math.PI*2,FORMATION=3,PACKET_RADIUS=12,PACKET_COUNT=44;
  const clamp=t=>Math.max(0,Math.min(1,t));
  const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
  const lerp=(a,b,t)=>a+(b-a)*t;
  function path(points){
    let length=0;
    const segments=points.slice(1).map((b,i)=>{const a=points[i],size=Math.hypot(b[0]-a[0],b[1]-a[1]);const segment={a,b,size,start:length};length+=size;return segment;});
    return {points,at(progress){const distance=clamp(progress)*length;const segment=segments.find(s=>distance<=s.start+s.size)||segments.at(-1);const q=segment.size?(distance-segment.start)/segment.size:0;return{x:lerp(segment.a[0],segment.b[0],q),y:lerp(segment.a[1],segment.b[1],q)};}};
  }
  const paths={
    brand:[path([[100,140],[300,140]]),path([[300,140],[410,140],[410,155],[505,155]])],
    product:[path([[103,140],[301,140]]),path([[301,140],[503,140]]),path([[503,140],[544,140],[544,173]])],
    workflow:[path([[100,174],[130,174],[130,144],[271,144]]),path([[271,144],[340,144]]),path([[340,144],[393,144],[465,56],[505,56]]),path([[505,56],[505,135]]),path([[505,135],[505,211]])],
    ai:[path([[103,141],[150,141],[251,145],[291,145]]),path([[291,145],[340,145]]),path([[340,145],[359,145],[460,162],[484,165]]),path([[484,165],[531,175]])],
  };
  const overlay=document.getElementById('work-formation');
  const screen=overlay&&overlay.getContext('2d',{alpha:true});
  if(!screen)return;
  const scenes=[];
  let frame=0,last=null,suspended=false,pixel=2,viewportWidth=0,viewportHeight=0;
  const blocked=()=>suspended||document.hidden||document.documentElement.classList.contains('menu-open');
  function fitScreen(){
    const bounds=overlay.getBoundingClientRect();
    viewportWidth=bounds.width||window.innerWidth;viewportHeight=bounds.height||window.innerHeight;pixel=Math.min(3,Math.max(2,window.devicePixelRatio||1));
    overlay.width=Math.max(1,Math.round(viewportWidth*pixel));overlay.height=Math.max(1,Math.round(viewportHeight*pixel));
    screen.setTransform(pixel,0,0,pixel,0,0);
  }
  function makeScene(id,draw){
    const canvas=document.getElementById(id+'-scene');
    const ctx=canvas&&canvas.getContext('2d',{alpha:true});
    if(!ctx)return;
    const diagram=canvas.closest('.work-diagram');
    const labels=diagram.querySelectorAll('.work-diagram-labels span');
    const scene={id,canvas,ctx,draw,visible:false,elapsed:0,scale:1,targets:[],particles:null,capturing:false};
    const d={ready:false};
    d.dot=(x,y,r=1,a=.6)=>{
      if(scene.capturing){scene.targets.push({x,y,r,a});return;}
      ctx.globalAlpha=clamp(a);ctx.beginPath();ctx.arc(x,y,Math.max(r,.62*pixel/scene.scale),0,TAU);ctx.fill();
    };
    d.line=(points,a=.5,spacing=4,r=1)=>{
      for(let n=1;n<points.length;n++){
        const [x,y]=points[n-1],[xx,yy]=points[n],len=Math.hypot(xx-x,yy-y),count=Math.max(1,Math.ceil(len/spacing));
        for(let i=0;i<count;i++)d.dot(lerp(x,xx,i/count),lerp(y,yy,i/count),r,a);
      }
    };
    d.circle=(x,y,r,a=.5)=>{const n=Math.ceil(TAU*r/3.9);for(let i=0;i<n;i++){const q=i/n*TAU;d.dot(x+Math.cos(q)*r,y+Math.sin(q)*r,1,a);}};
    d.rect=(x,y,w,h,a=.55,r=7)=>{
      const points=[];
      [[x+w-r,y+r,-Math.PI/2],[x+w-r,y+h-r,0],[x+r,y+h-r,Math.PI/2],[x+r,y+r,Math.PI]].forEach(([cx,cy,start])=>{
        for(let i=0;i<=6;i++){const q=start+i/6*Math.PI/2;points.push([cx+Math.cos(q)*r,cy+Math.sin(q)*r]);}
      });points.push(points[0]);d.line(points,a);
    };
    d.sphere=(x,y,r,t,a=.55,n=100)=>{
      for(let i=0;i<n;i++){const v=1-2*(i+.5)/n,ring=Math.sqrt(1-v*v),angle=i*2.3999632297+t*.32,z=Math.sin(angle)*ring;
        d.dot(x+Math.cos(angle)*ring*r,y+v*r,.8+(.5+z*.5)*.45,a*(.3+(.5+z*.5)*.7));}
    };
    d.packet=(x,y,t,a=1)=>{
      if(!d.ready||a<=0)return;
      const r=PACKET_RADIUS,glow=ctx.createRadialGradient(x,y,0,x,y,r*2.8);
      glow.addColorStop(0,'rgba(255,255,255,0.16)');glow.addColorStop(1,'rgba(255,255,255,0)');
      ctx.globalAlpha=a;ctx.fillStyle=glow;ctx.fillRect(x-r*3,y-r*3,r*6,r*6);ctx.fillStyle='#fff';
      d.sphere(x,y,r,t*2,a,PACKET_COUNT);
    };
    d.route=(route,a=.17)=>d.line(route.points,a,5,.8);
    d.travel=(route,progress)=>route.at(ease(progress));
    d.arrow=(x,y,a=.25)=>d.line([[x-5,y-4],[x,y],[x-5,y+4]],a,2,.8);
    d.ring=(x,y,r,t,a=.6)=>{for(let i=0;i<35;i++){const q=i/35*TAU+t*.16;d.dot(x+Math.cos(q)*r,y+Math.sin(q)*r,.85,a);}};
    d.check=(x,y,a=1,s=1)=>d.line([[x-6*s,y],[x-1*s,y+5*s],[x+9*s,y-7*s]],a,2,1);
    d.person=(x,y,a=.55,s=1)=>{d.circle(x,y-13*s,7*s,a);d.line([[x-16*s,y+20*s],[x-14*s,y+10*s],[x-7*s,y+4*s],[x+7*s,y+4*s],[x+14*s,y+10*s],[x+16*s,y+20*s]],a,3,1);};
    d.setStage=stage=>labels.forEach((label,i)=>label.classList.toggle('active',d.ready&&i===stage));
    scene.d=d;
    // Capture the exact initial glyphs. No separate mask or approximation at handover.
    scene.capturing=true;draw(d,0);scene.capturing=false;
    canvas.hidden=false;canvas.dataset.sceneState='forming';diagram.classList.add('has-animation');
    scene.resize=()=>{const bounds=canvas.getBoundingClientRect();canvas.width=Math.max(1,Math.round(bounds.width*pixel));canvas.height=Math.max(1,Math.round(bounds.height*pixel));scene.scale=canvas.width/W;};
    scene.resize();scenes.push(scene);
    if('ResizeObserver'in window)new ResizeObserver(()=>{scene.resize();sync();}).observe(canvas);
    if('IntersectionObserver'in window)new IntersectionObserver(entries=>{scene.visible=entries[0].isIntersecting;sync();},{threshold:.18}).observe(canvas);
    else scene.visible=true;
  }
  function seedParticles(scene){
    let seed=20261001+scenes.indexOf(scene)*997;
    const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    scene.particles=scene.targets.map(target=>{
      let sx,sy;
      if(random()<.6){sx=random();sy=random();}
      else{const edge=Math.floor(random()*4),margin=.08+random()*.35;
        sx=edge===0?-margin:edge===1?1+margin:random();sy=edge===2?-margin:edge===3?1+margin:random();}
      return{target,sx,sy,delay:random()*.35,bendX:(random()-.5)*130,bendY:(random()-.5)*130,r:.45+random()*.45,a:.18+random()*.3};
    });
  }
  function form(scene){
    if(!scene.particles)seedParticles(scene);
    const bounds=scene.canvas.getBoundingClientRect(),scale=bounds.width/W;
    for(const p of scene.particles){
      const progress=ease((scene.elapsed-p.delay)/(FORMATION-.35));
      const x=lerp(p.sx*viewportWidth,bounds.left+p.target.x*scale,progress)+Math.sin(progress*Math.PI)*p.bendX;
      const y=lerp(p.sy*viewportHeight,bounds.top+p.target.y*scale,progress)+Math.sin(progress*Math.PI)*p.bendY;
      const r=lerp(p.r,Math.max(.62,p.target.r*scale),progress);
      screen.globalAlpha=lerp(p.a,p.target.a,progress);screen.beginPath();screen.arc(x,y,r,0,TAU);screen.fill();
    }
  }
  function paint(scene){
    const {ctx,canvas,d}=scene;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    if(scene.elapsed<FORMATION){form(scene);return;}
    if(!d.ready){d.ready=true;canvas.dataset.sceneState='running';scene.particles=null;}
    ctx.setTransform(scene.scale,0,0,scene.scale,0,0);ctx.fillStyle='#fff';
    scene.draw(d,scene.elapsed-FORMATION);ctx.globalAlpha=1;
  }
  function render(stamp){
    frame=0;
    const delta=last===null?0:Math.max(0,Math.min((stamp-last)/1000,.08));last=stamp;
    screen.clearRect(0,0,viewportWidth,viewportHeight);screen.fillStyle='#fff';
    for(const scene of scenes){if(!scene.visible)continue;scene.elapsed+=delta;paint(scene);}
    screen.globalAlpha=1;
    if(!blocked()&&scenes.some(scene=>scene.visible))frame=requestAnimationFrame(render);
  }
  function sync(){
    if(!blocked()&&scenes.some(scene=>scene.visible)){if(!frame){last=null;frame=requestAnimationFrame(render);}}
    else{if(frame)cancelAnimationFrame(frame);frame=0;last=null;screen.clearRect(0,0,viewportWidth,viewportHeight);}
  }
  fitScreen();

  function brand(d,t){
    const c=t%11.6;
    // The institution sends a message through a channel to people.
    d.sphere(100,140,41,t,.59,150);
    d.rect(258,100,84,88,.64,8);d.line([[258,117],[342,117]],.45);
    [268,276,284].forEach(x=>d.circle(x,109,1.8,.55));
    d.line([[271,132],[329,132]],.46);d.line([[271,151],[329,151]],.46);d.line([[271,170],[309,170]],.46);
    d.person(475,127,.54,.9);d.person(505,103,.7,1);d.person(535,127,.54,.9);
    paths.brand.forEach(route=>d.route(route));d.arrow(230,140);d.arrow(455,155);
    if(c<1){d.packet(100,140,t,ease(c/.4));d.setStage(0);}
    else if(c<3.6){const p=d.travel(paths.brand[0],(c-1)/2.6);d.packet(p.x,p.y,t);d.setStage(c<2.6?0:1);}
    else if(c<4.7){d.packet(300,140,t);d.ring(300,140,23,t,.2+.2*Math.sin((c-3.6)/1.1*Math.PI));d.setStage(1);}
    else if(c<8.5){const p=d.travel(paths.brand[1],(c-4.7)/3.8);d.packet(p.x,p.y,t);d.setStage(2);}
    else{const a=1-ease((c-10.1)/1.1);d.packet(505,155,t,a);d.ring(505,155,23+(c-8.5)*3,t,a*.4);d.setStage(2);}
  }

  function product(d,t){
    const c=t%12;
    // The accepted Tetris silhouette, interface plan and web/mobile forms stay intact.
    const bx=55,by=102;
    d.line([[bx,by],[bx+44,by],[bx+44,by+21],[bx+66,by+21],[bx+66,by+43],[bx+87,by+43],[bx+87,by+87],[bx,by+87],[bx,by]],.61,3.8);
    const float=-26+Math.sin(t*.9)*3;
    d.line([[bx+44+8,by+float],[bx+87+8,by+float],[bx+87+8,by+43+float],[bx+66+8,by+43+float],[bx+66+8,by+21+float],[bx+44+8,by+21+float],[bx+44+8,by+float]],.65,3.8);
    d.rect(258,96,84,88,.64);d.line([[258,113],[342,113]],.47);d.line([[283,113],[283,184]],.48);
    [[293,129,330],[293,145,330],[293,161,320]].forEach(([x,y,xx])=>d.line([[x,y],[xx,y]],.47));
    d.rect(456,99,91,76,.65);d.line([[456,116],[547,116]],.5);d.rect(466,126,24,34,.5,3);d.line([[501,129],[536,129]],.46);d.line([[501,142],[536,142]],.46);d.line([[501,155],[521,155]],.46);
    d.rect(526,140,36,61,.75,5);d.line([[538,150],[551,150]],.5);d.line([[542,191],[547,191]],.6,2);
    paths.product.forEach(route=>d.route(route));d.arrow(230,140);d.arrow(424,140);
    if(c<1.1){d.packet(103,140,t,ease(c/.4));d.setStage(0);}
    else if(c<4){const p=d.travel(paths.product[0],(c-1.1)/2.9);d.packet(p.x,p.y,t);d.setStage(c<2.8?0:1);}
    else if(c<5.4){d.packet(301,140,t);d.rect(290,123,45,44,.7,3);d.setStage(1);}
    else if(c<8.8){const p=d.travel(paths.product[1],(c-5.4)/3.4);d.packet(p.x,p.y,t);d.setStage(c<6.7?1:2);}
    else if(c<10.3){const p=d.travel(paths.product[2],(c-8.8)/1.5);d.packet(p.x,p.y,t);d.rect(456,99,91,76,.7);d.setStage(2);}
    else{const a=1-ease((c-11)/.8);d.packet(544,173,t,a);d.rect(526,140,36,61,.65*a,5);d.setStage(2);}
  }


  function workflow(d,t){
    const c=t%15.6;
    d.rect(53,86,94,115,.6,6);d.line([[53,105],[147,105]],.45);
    [[65,120,130],[65,133,130],[65,146,115]].forEach(([x,y,xx])=>d.line([[x,y],[xx,y]],.46));
    d.rect(65,161,70,27,.55,4);
    [255,324].forEach(x=>{d.rect(x,115,32,58,.6,4);d.line([[x,128],[x+32,128]],.45);d.line([[x+8,140],[x+24,140]],.46,3);d.line([[x+8,151],[x+20,151]],.46,3);});
    d.rect(487,35,36,42,.6,4);[[44,514],[54,514],[64,506]].forEach(([y,xx])=>d.line([[495,y],[xx,y]],.45,3));
    const bell=[];for(let i=0;i<=20;i++){const a=Math.PI+i/20*Math.PI;bell.push([505+Math.cos(a)*12,130+Math.sin(a)*13]);}
    d.line(bell,.58,3);d.line([[493,130],[493,139],[488,145],[522,145],[517,139],[517,130]],.58,3);d.line([[501,151],[509,151]],.5,2);
    d.rect(485,190,40,43,.6,4);[201,211,221].forEach(y=>{d.line([[491,y],[493,y+2],[498,y-3]],.5,2);d.line([[503,y],[518,y]],.46,3);});
    paths.workflow.forEach(route=>d.route(route));d.arrow(227,144);d.arrow(430,99);
    if(!d.ready){d.setStage(-1);return;}
    const stops=[[100,174],[271,144],[340,144],[505,56],[505,135],[505,211]];
    const moves=[3,1.5,3,1.5,1.5], pauses=[.6,.6,.6,.6,.6,.6];
    let time=0,location={x:100,y:174},stage=0;
    for(let i=0;i<stops.length;i++){
      if(c<time+pauses[i]){location={x:stops[i][0],y:stops[i][1]};stage=i===0?0:i<3?1:2;break;}
      time+=pauses[i];
      if(i<moves.length){if(c<time+moves[i]){location=d.travel(paths.workflow[i],(c-time)/moves[i]);stage=i===0?0:i<2?1:2;break;}time+=moves[i];}
      location={x:stops[i][0],y:stops[i][1]};stage=i===0?0:i<3?1:2;
    }
    d.packet(location.x,location.y,t,ease(c/.4)*(1-ease((c-15.1)/.5)));d.setStage(stage);
    if(c>=9.3&&c<9.9)d.rect(487,35,36,42,.9,4);
    else if(c>=11.4&&c<12)d.ring(505,135,24,t,.65);
    else if(c>=13.5)d.rect(485,190,40,43,.85,4);
  }

  function ai(d,t){
    const c=t%18.5;
    // A concrete work map: different existing steps, with one selected for assistance.
    d.rect(53,83,94,119,.52,6);
    [105,141,177].forEach((y,i)=>{d.circle(67,y,4,.45);d.line([[78,y],[116,y]],.45,4);d.rect(126,y-6,10,12,.42,2);if(i<2)d.line([[101,y+9],[101,y+26]],.14,5,.8);});
    // Two tools. Their connection is gated by a visible human reviewer above.
    d.rect(255,117,32,57,.6,4);d.line([[263,129],[278,129]],.46,3);d.line([[263,139],[278,139]],.46,3);d.line([[263,151],[273,151]],.46,3);
    d.rect(324,117,32,57,.6,4);d.line([[332,129],[347,129]],.46,3);d.line([[332,139],[347,139]],.46,3);d.line([[332,151],[342,151]],.46,3);

    d.person(305,77,.6,.72);d.line([[305,94],[305,123]],.28,5,.8);
    // The same kind of tool is put within reach of two people: handover means use.
    d.person(485,80,.64,.85);d.person(528,80,.46,.72);
    d.rect(463,126,94,72,.64,6);d.line([[463,141],[557,141]],.46);d.rect(468,149,32,32,.58,3);d.line([[515,154],[545,154]],.43);d.line([[515,163],[541,163]],.43);d.line([[515,180],[540,180]],.43);
    paths.ai.forEach(route=>d.route(route));d.arrow(227,144);d.arrow(428,157);
    // Scan settles on the middle step instead of turning every process into an AI task.
    const sy=c<2.1?lerp(105,141,ease(c/2.1)):141;
    d.rect(58,sy-13,83,26,c<4?.85:.26,4);
    const open=c>=7.5;
    d.line(open?[[306,137],[312,128]]:[[306,134],[306,156]],open?.28:.8,2.6,1.15);
    if(c<2.1){d.setStage(0);}
    else if(c<3.2){d.packet(103,141,t,ease((c-2.1)/.4));d.setStage(0);}
    else if(c<5.8){const p=d.travel(paths.ai[0],(c-3.2)/2.6);d.packet(p.x,p.y,t);d.setStage(c<4.3?0:1);}
    else if(c<7.5){d.packet(291,145,t);const a=ease((c-6.1)/.5);d.check(327,75,a,.65);d.line([[305,98],[305,124]],a*.8,3);d.setStage(1);}
    else if(c<9.2){d.check(327,75,.85,.65);const p=d.travel(paths.ai[1],(c-7.5)/1.7);d.packet(p.x,p.y,t);d.setStage(1);}
    else if(c<12){d.check(327,75,.55,.65);const p=d.travel(paths.ai[2],(c-9.2)/2.8);d.packet(p.x,p.y,t);d.setStage(2);}
    else if(c<13.6){d.packet(484,165,t);const q=ease((c-12)/1.3);d.line([[485,102],[478,113],[lerp(478,484,q),lerp(113,152,q)]],.88,3,1.2);d.setStage(2);}
    else if(c<15.6){d.line([[485,102],[478,113],[484,152]],.76,3,1.1);const p=d.travel(paths.ai[3],(c-13.6)/2);d.packet(p.x,p.y,t);d.check(507,106,.9,.55);d.setStage(2);}
    else{const a=1-ease((c-17.7)/.7);d.packet(531,175,t,a*.7);d.check(531,175,a,.75);d.check(507,106,a*.8,.55);d.setStage(2);}
  }

  makeScene('brand',brand);makeScene('product',product);makeScene('workflow',workflow);makeScene('ai',ai);
  window.addEventListener('resize',()=>{fitScreen();scenes.forEach(scene=>scene.resize());sync();});
  document.addEventListener('visibilitychange',sync);
  if('MutationObserver'in window)new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  window.addEventListener('pagehide',()=>{suspended=true;sync();});
  window.addEventListener('pageshow',()=>{suspended=false;sync();});
  sync();
})();
