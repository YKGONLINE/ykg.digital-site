// İhtiyaç → Tasarım → Ürün: aynı noktalar bir arayüzün parçalarını oluşturur.
(() => {
  const diagram = document.getElementById("product-diagram");
  const canvas = document.getElementById("product-scene");
  if (!diagram || !canvas) return;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const width = 360, height = 220;
  const count = window.matchMedia("(max-width: 640px)").matches ? 300 : 420;
  const needCount = Math.ceil(count * 0.28);
  const designCount = Math.ceil(count * 0.32);
  let seed = 20261001;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = (v) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };

  // Polylines keep both the layout and the finished interface crisp at every size.
  const roundRect = (x, y, w, h, radius) => {
    const points = [];
    [[x+w-radius,y+radius,-Math.PI/2],[x+w-radius,y+h-radius,0],
      [x+radius,y+h-radius,Math.PI/2],[x+radius,y+radius,Math.PI]].forEach(([cx,cy,start]) => {
      for (let i=0;i<=8;i++) {
        const a = start + i / 8 * Math.PI / 2;
        points.push([cx+Math.cos(a)*radius,cy+Math.sin(a)*radius]);
      }
    });
    points.push(points[0]);
    return points;
  };
  const makePath = (polylines) => {
    let total = 0;
    const segments = [];
    for (const line of polylines) for (let i=1;i<line.length;i++) {
      const a=line[i-1], b=line[i], length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      segments.push({a,b,length,start:total}); total += length;
    }
    return (position) => {
      const distance = ((position % 1 + 1) % 1) * total;
      const s = segments.find((segment) => distance <= segment.start + segment.length) || segments[segments.length-1];
      const t = s.length ? (distance-s.start)/s.length : 0;
      return {x:mix(s.a[0],s.b[0],t),y:mix(s.a[1],s.b[1],t)};
    };
  };
  const needBodyPoint = makePath([
    [[10,82],[44,82],[44,99],[61,99],[61,116],[78,116],[78,150],[10,150],[10,82]],
  ]);
  const needPiecePoint = makePath([
    [[44,82],[78,82],[78,116],[61,116],[61,99],[44,99],[44,82]],
  ]);
  const bodyCount = Math.round(needCount * 0.7);
  function needPoint(index, time) {
    const slot = index % needCount;
    if (slot < bodyCount) return needBodyPoint(slot / bodyCount);
    const point = needPiecePoint((slot - bodyCount) / (needCount - bodyCount));
    // The missing piece floats just above its matching space, without breaking apart again.
    const drift = (1 - Math.cos(time * 1.1)) / 2;
    return { x: point.x + 9 - drift * 3, y: point.y - 28 + drift * 8 };
  }
  const designPoint = makePath([
    roundRect(145,77,70,66,5),
    [[145,91],[215,91]], [[167,91],[167,143]],
    [[177,103],[204,103]], [[177,113],[204,113]], [[177,125],[192,125]],
  ]);
  const productPoint = makePath([
    roundRect(276,79,66,58,5), [[276,91],[342,91]],
    roundRect(284,100,17,25,2), [[309,103],[333,103]], [[309,111],[333,111]],
    [[309,120],[323,120]],
    roundRect(330,112,20,40,4), [[336,118],[344,118]], [[338,146],[342,146]],
  ]);
  const particles = Array.from({length:count},(_,index) => {
    const angle=random()*Math.PI*2, distance=150+random()*170;
    const group=index<needCount?0:index<needCount+designCount?1:2;
    return {
      sourceX:180+Math.cos(angle)*distance, sourceY:110+Math.sin(angle)*distance*.8,
      needIndex:index,
      position:group===1?(index-needCount)/designCount:(index-needCount-designCount)/(count-needCount-designCount),
      group, delay:random()*.18, bend:(random()-.5)*42,
      radius:.65+random()*.42, phase:random()*Math.PI*2,
    };
  });
  let seconds=0, frame=0, lastTimestamp=null, lastPaint=0, visible=false;
  const dot=(x,y,radius,alpha) => {
    context.globalAlpha=alpha; context.beginPath();
    context.arc(x,y,radius,0,Math.PI*2); context.fill();
  };
  function draw(time) {
    context.clearRect(0,0,width,height); context.fillStyle="#fff";
    [{x1:81,x2:138,start:1.4},{x1:222,x2:269,start:3.1}].forEach((path) => {
      const progress=ease((time-path.start)/1.2);
      for(let i=0;i<=28*progress && progress;i++) {
        const t=i/28;
        dot(mix(path.x1,path.x2,t),110-Math.sin(t*Math.PI)*7,.6,.2);
      }
      const head=((time-path.start)*.22)%1;
      if(head<0 || head>progress) return;
      for(let trail=5;trail>=0;trail--) {
        const t=head-trail*.018;
        if(t>=0) dot(mix(path.x1,path.x2,t),110-Math.sin(t*Math.PI)*7,trail?.8:1.4,(1-trail/6)*.9);
      }
    });
    for(const p of particles) {
      const need=needPoint(p.needIndex,time);
      const gather=ease((time-p.delay)/1.2);
      const design=p.group>0?ease((time-1.4-p.delay)/1.4):0;
      const product=p.group===2?ease((time-3.1-p.delay)/1.45):0;
      let x=mix(p.sourceX,need.x,gather), y=mix(p.sourceY,need.y,gather);
      const layout=designPoint(p.position);
      x=mix(x,layout.x,design); y=mix(y,layout.y,design)+Math.sin(design*Math.PI)*p.bend;
      const interfacePoint=productPoint(p.position);
      x=mix(x,interfacePoint.x,product); y=mix(y,interfacePoint.y,product)+Math.sin(product*Math.PI)*p.bend;
      dot(x,y,p.radius,.8+Math.sin(time*1.1+p.phase)*.14);
    }
    // Light follows the contours after formation; the interface remains legible.
    [[designPoint,1.4],[productPoint,3.1]].forEach(([path,start]) => {
      const opacity=ease((time-start-1.5)/.6);
      if(!opacity) return;
      for(let trail=7;trail>=0;trail--) {
        const p=path(time*.055-trail*.005);
        dot(p.x,p.y,trail?.8:1.3,opacity*(1-trail/8));
      }
    });
    context.globalAlpha=1;
  }
  function resize() {
    const bounds=canvas.parentElement.getBoundingClientRect();
    const dpr=Math.min(Math.max(window.devicePixelRatio||1,2),3);
    canvas.width=Math.max(1,Math.round(bounds.width*dpr));
    canvas.height=Math.max(1,Math.round(bounds.height*dpr));
    context.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
    draw(seconds);
  }
  function animate(timestamp) {
    frame=0;
    if(lastTimestamp!==null) seconds+=Math.min(timestamp-lastTimestamp,80)/1000;
    lastTimestamp=timestamp;
    if(seconds<4.8 || timestamp-lastPaint>=1000/30) { draw(seconds);lastPaint=timestamp; }
    if(visible && !document.hidden) frame=requestAnimationFrame(animate);
  }
  function sync() {
    if(visible && !document.hidden) {
      if(!frame) frame=requestAnimationFrame(animate);
    } else {cancelAnimationFrame(frame);frame=0;lastTimestamp=null;}
  }
  canvas.hidden=false; diagram.classList.add("has-animation"); resize();
  if("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas.parentElement);
  else window.addEventListener("resize",resize);
  if("IntersectionObserver" in window) {
    new IntersectionObserver((entries)=>{visible=entries[0].isIntersecting;sync();},
      {threshold:.35,rootMargin:"0px 0px -8% 0px"}).observe(canvas);
  } else {visible=true;sync();}
  document.addEventListener("visibilitychange",sync);
  window.addEventListener("pagehide",()=>{cancelAnimationFrame(frame);frame=0;lastTimestamp=null;});
  window.addEventListener("pageshow",sync);
})();
