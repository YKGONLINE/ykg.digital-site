// Aynı kayıt: oluşur, aktarılır ve kaydet → bildir → takip et adımlarını başlatır.
(() => {
  const diagram = document.getElementById("workflow-diagram");
  const canvas = document.getElementById("workflow-scene");
  if (!diagram || !canvas) return;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  const width = 360, height = 220;
  const count = window.matchMedia("(max-width: 640px)").matches ? 420 : 540;
  const counts = [Math.round(count * .32), Math.round(count * .32)];
  counts.push(count - counts[0] - counts[1]);
  const mix = (a,b,t) => a+(b-a)*t;
  const ease = (value) => { const t=Math.max(0,Math.min(1,value)); return t*t*(3-2*t); };
  let seed = 20261004;
  const random = () => (seed=(seed*1664525+1013904223)>>>0)/4294967296;
  function roundedRect(x,y,w,h,r=4) {
    const points=[];
    for (const [cx,cy,a] of [[x+w-r,y+r,-Math.PI/2],[x+w-r,y+h-r,0],[x+r,y+h-r,Math.PI/2],[x+r,y+r,Math.PI]]) {
      for (let i=0;i<=8;i++) {
        const angle=a+i/8*Math.PI/2;
        points.push([cx+Math.cos(angle)*r,cy+Math.sin(angle)*r]);
      }
    }
    points.push(points[0]);
    return points;
  }
  function makePath(lines) {
    const segments=[]; let total=0;
    for (const line of lines) for (let i=1;i<line.length;i++) {
      const a=line[i-1],b=line[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if (!length) continue;
      segments.push({a,b,length,start:total}); total+=length;
    }
    return position => {
      const distance=((position%1+1)%1)*total;
      const s=segments.find(item=>distance<=item.start+item.length)||segments[segments.length-1];
      const t=(distance-s.start)/s.length;
      return {x:mix(s.a[0],s.b[0],t),y:mix(s.a[1],s.b[1],t)};
    };
  }
  const record = makePath([
    roundedRect(12,68,65,85,5), [[12,83],[77,83]],
    [[21,94],[65,94]], [[21,103],[65,103]], [[21,112],[53,112]],
    roundedRect(20,122,49,22,3),
  ]);
  const transfer = makePath([
    roundedRect(124,87,37,46), [[124,99],[161,99]],
    [[132,109],[153,109]], [[132,117],[153,117]],
    roundedRect(201,87,37,46), [[201,99],[238,99]],
    [[209,109],[230,109]], [[209,117],[230,117]],
  ]);
  const bell=[];
  for(let i=0;i<=24;i++) {
    const a=Math.PI+i/24*Math.PI;
    bell.push([306+Math.cos(a)*11,111+Math.sin(a)*12]);
  }
  const operations = makePath([
    roundedRect(290,38,32,36,3), [[296,47],[316,47]], [[296,54],[316,54]], [[296,62],[309,62]],
    bell, [[295,111],[295,121],[290,127],[322,127],[317,121],[317,111]], [[302,133],[310,133]],
    roundedRect(287,154,38,39,3),
    [[293,163],[295,165],[299,160]], [[303,163],[318,163]],
    [[293,173],[295,175],[299,170]], [[303,173],[318,173]],
    [[293,183],[295,185],[299,180]], [[303,183],[318,183]],
  ]);
  const routes = [
    {line:[[80,110],[119,110]],start:1.6},
    {line:[[166,110],[195,110]],start:1.6},
    {line:[[242,110],[265,110],[276,56],[285,56]],start:3.5},
    {line:[[306,78],[306,91]],start:3.5},
    {line:[[306,137],[306,149]],start:3.5},
  ].map(route => ({...route, point:makePath([route.line]),
    steps:Math.ceil(route.line.reduce((sum,p,i)=>i?sum+Math.hypot(p[0]-route.line[i-1][0],p[1]-route.line[i-1][1]):sum,0)/3.5)}));
  const pathPoints=[record,transfer,operations];
  const particles=Array.from({length:count},(_,index)=>{
    const group=index<counts[0]?0:index<counts[0]+counts[1]?1:2;
    const offset=group===0?0:group===1?counts[0]:counts[0]+counts[1];
    const angle=random()*Math.PI*2, radius=150+random()*175;
    return {group,position:(index-offset)/counts[group],
      x:180+Math.cos(angle)*radius,y:110+Math.sin(angle)*radius*.8,
      delay:random()*.2,bend:(random()-.5)*32,radius:.7+random()*.35,phase:random()*Math.PI*2};
  });
  let time=0,frame=0,lastTimestamp=null,lastPaint=0,visible=false;
  function dot(x,y,r,alpha) {
    context.globalAlpha=alpha;context.beginPath();context.arc(x,y,r,0,Math.PI*2);context.fill();
  }
  function packet(x,y,alpha) {
    for(let row=0;row<3;row++) for(let col=0;col<3;col++) dot(x+(col-1)*3.2,y+(row-1)*3.2,1.1,alpha);
  }
  function draw(seconds) {
    context.clearRect(0,0,width,height);context.fillStyle="#fff";
    for(const route of routes) {
      const progress=ease((seconds-route.start)/1.3);
      for(let i=0;i<=route.steps*progress&&progress;i++) {const p=route.point(i/route.steps);dot(p.x,p.y,.65,.3);}
    }
    for(const p of particles) {
      const start=pathPoints[0]((p.position+p.group*.17)%1);
      const gather=ease((seconds-p.delay)/1.35);
      const move=p.group>0?ease((seconds-1.6-p.delay)/1.5):0;
      const operate=p.group===2?ease((seconds-3.5-p.delay)/1.6):0;
      const middle=pathPoints[1](p.position),end=pathPoints[2](p.position);
      let x=mix(p.x,start.x,gather),y=mix(p.y,start.y,gather);
      x=mix(x,middle.x,move);y=mix(y,middle.y,move)+Math.sin(move*Math.PI)*p.bend;
      x=mix(x,end.x,operate);y=mix(y,end.y,operate)+Math.sin(operate*Math.PI)*p.bend;
      dot(x,y,p.radius,.65+Math.sin(seconds*.9+p.phase)*.12);
    }
    // A stable nine-dot record moves through the same route on each cycle.
    const ready=ease((seconds-5.3)/.7);
    const cycle=Math.max(0,seconds-5.3)%8;
    const recordAlpha=ready*ease(cycle/.4)*(1-ease((cycle-7.4)/.6));
    const journey=[[44,133],[78,110],[143,110],[180,110],[219,110],[265,110],[306,56],[306,113],[306,173]];
    const segmentDurations=[.7,.7,.6,.6,.6,1,1.2,1.2];
    let elapsed=0,position={x:44,y:133};
    for(let i=0;i<segmentDurations.length;i++) {
      const end=elapsed+segmentDurations[i];
      if(cycle<=end) {const t=ease((cycle-elapsed)/segmentDurations[i]);position={x:mix(journey[i][0],journey[i+1][0],t),y:mix(journey[i][1],journey[i+1][1],t)};break;}
      position={x:journey[i+1][0],y:journey[i+1][1]};elapsed=end;
    }
    packet(position.x,position.y,recordAlpha);
    // The receiving step lights up as the record reaches it.
    for(const [start,end,path]of [[4.0,5.0,operations],[5.0,6.0,operations],[6.0,7.4,operations]]) {
      if(cycle<start||cycle>end||!ready) continue;
      const section=start===4?0:start===5?1:2;
      const y=section===0?56:section===1?113:173;
      for(let i=0;i<counts[2];i++) {const p=path(i/counts[2]);if(Math.abs(p.y-y)<23)dot(p.x,p.y,.95,ready*.8);}
    }
    context.globalAlpha=1;
  }
  function resize() {
    const bounds=canvas.parentElement.getBoundingClientRect();const dpr=Math.min(Math.max(window.devicePixelRatio||1,2),3);
    canvas.width=Math.max(1,Math.round(bounds.width*dpr));canvas.height=Math.max(1,Math.round(bounds.height*dpr));
    context.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);draw(time);
  }
  function animate(timestamp) {
    frame=0;if(lastTimestamp!==null)time+=Math.min(timestamp-lastTimestamp,80)/1000;lastTimestamp=timestamp;
    if(time<5.5||timestamp-lastPaint>=1000/30){draw(time);lastPaint=timestamp;}
    if(visible&&!document.hidden)frame=requestAnimationFrame(animate);
  }
  function sync() {
    if(visible&&!document.hidden){if(!frame)frame=requestAnimationFrame(animate);}
    else{cancelAnimationFrame(frame);frame=0;lastTimestamp=null;}
  }
  canvas.hidden=false;diagram.classList.add("has-animation");resize();
  if("ResizeObserver"in window)new ResizeObserver(resize).observe(canvas.parentElement);
  else window.addEventListener("resize",resize);
  if("IntersectionObserver"in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.35,rootMargin:"0px 0px -8% 0px"}).observe(canvas);
  else{visible=true;sync();}
  document.addEventListener("visibilitychange",sync);
  window.addEventListener("pagehide",()=>{cancelAnimationFrame(frame);frame=0;lastTimestamp=null;});
  window.addEventListener("pageshow",sync);
})();
