import * as THREE from 'three';
import { T, VW, VH, cameraAt, createMotion, parseTime } from './motion.js?v=20261003-flow1';
import { SOURCES, loadLum, sample, alignTargets } from './sampling.js?v=20261003-flow1';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const debug = params.get('debug') === '1', shot = params.get('shot') === '1';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
document.body.classList.toggle('debug', debug);
document.body.classList.toggle('shot', shot);
let elapsed = params.has('t') ? parseTime(params.get('t')) : reduced.matches ? T.end : 0;
let playing = !shot && params.get('paused') !== '1' && !reduced.matches;
let ready = false, raf = 0, last = 0, renderer, motion, draw;
const bootStarted = performance.now();
let bootMs = 0, matchingMs = 0;
const cpu = [], intervals = [];
let lastMetrics = 0;
const quantile = (a, p) => a.length ? [...a].sort((a,b) => a-b)[Math.floor((a.length-1)*p)] : null;
function stats() {
  return { ready, time: elapsed, playing, reducedMotion: reduced.matches, bootMs, matchingMs, viewport: [innerWidth,innerHeight], pixelRatio: renderer?.getPixelRatio(),
    points: motion?.total, measuredRange: [0,T.end], frames: cpu.length, cpuMedian: quantile(cpu,.5), cpuP95: quantile(cpu,.95),
    intervalMedian: quantile(intervals,.5), intervalP95: quantile(intervals,.95) };
}
function sync() {
  $('controls').hidden = !ready || shot || (!debug && playing && elapsed < T.end);
  $('toggle').hidden = !debug;
  $('toggle').textContent = playing ? 'Duraklat' : 'Oynat';
  $('inspection').hidden = !debug;
  $('time').value = Math.min(T.end,elapsed);
  $('clock').textContent = Math.min(T.end,elapsed).toFixed(2);
  const now = performance.now();
  if (playing && lastMetrics && now-lastMetrics < 250) return;
  lastMetrics = now;
  const s = stats();
  $('metrics').textContent = `${s.points ?? 0} nokta · CPU ${s.cpuMedian?.toFixed(1) ?? '—'} / p95 ${s.cpuP95?.toFixed(1) ?? '—'} ms · kare ${s.intervalMedian?.toFixed(1) ?? '—'} ms`;
  $('metrics').dataset.stats = JSON.stringify(s);
}
function paint() {
  if (!ready) return;
  const start = performance.now(); draw(elapsed);
  if (elapsed <= T.end) cpu.push(performance.now()-start);
  if (cpu.length > 3600) cpu.shift(); sync();
}
function pause() { playing = false; cancelAnimationFrame(raf); raf = 0; last = 0; sync(); }
function seek(t) { pause(); elapsed = parseTime(t); paint(); }
function tick(now) {
  if (!playing || !ready) return;
  if (last) { const dt = now-last; if (elapsed < T.end) intervals.push(dt); if (intervals.length > 3600) intervals.shift(); elapsed += Math.min(dt,100)/1000; }
  last = now; paint(); raf = requestAnimationFrame(tick);
}
function play() { if (!ready || playing) return; playing = true; last = 0; sync(); raf = requestAnimationFrame(tick); }
function replay() { cpu.length = intervals.length = 0; lastMetrics = 0; seek(0); play(); }
$('time').max = T.end; $('duration').textContent = `/ ${T.end.toFixed(2)} sn`;
$('time').addEventListener('input', e => seek(e.target.value));
$('toggle').addEventListener('click', () => playing ? pause() : play());
$('replay').addEventListener('click', replay);
document.querySelectorAll('[data-pose]').forEach(button => button.addEventListener('click', () => seek(T.inspect[Number(button.dataset.pose)])));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
reduced.addEventListener('change', () => { if (reduced.matches) seek(T.end); });
function fail(error) {
  pause(); ready = false; document.documentElement.classList.add('failed'); $('controls').hidden = true;
  $('status').hidden = false; $('status').textContent = 'Animasyon açılamadı. Son görüntü gösteriliyor.'; console.error(error);
}
$('stage').addEventListener('webglcontextlost', e => { e.preventDefault(); fail(new Error('WebGL bağlamı kayboldu')); });

async function boot() {
  if (debug && params.get('fault') === 'webgl') throw new Error('İnceleme: WebGL başlatma hatası');
  renderer = new THREE.WebGLRenderer({ canvas: $('stage'), antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: shot });
  renderer.setClearColor(0,1);
  const narrow = innerWidth < 760, count = narrow ? 33000 : 60000;
  const luminances = await Promise.all(SOURCES.map((name,i) => loadLum(debug && params.get('fault') === 'asset' && i === 0 ? 'missing' : name)));
  const gains = [.85, 1.35, 1.35, 1.20];
  const samples = luminances.map((lum,i) => sample(lum,count,20261003+i,gains[i]));
  const matchingStarted = performance.now();
  const targets = alignTargets(samples);
  matchingMs = performance.now() - matchingStarted;
  motion = createMotion(targets,{ stars: narrow ? 450 : 700 });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0,VW,0,VH,-1000,1000);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(motion.positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aAlpha',new THREE.BufferAttribute(motion.alpha,1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aSize',new THREE.BufferAttribute(motion.sizes,1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 }, uDpr: { value: 1 } },
    vertexShader: `attribute float aAlpha;attribute float aSize;uniform float uScale;uniform float uDpr;varying float vA;
      void main(){vA=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=max(1.,aSize*uScale*uDpr);}`,
    fragmentShader: `varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=(1.-smoothstep(0.,.5,d))*vA;
      if(a<.004)discard;gl_FragColor=vec4(vec3(.95),a);}`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry,material); points.frustumCulled = false; scene.add(points);
  function layout() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1,2,Math.sqrt(4500000/(w*h))));
    renderer.setSize(w,h,false); material.uniforms.uDpr.value = renderer.getPixelRatio();
  }
  draw = t => {
    motion.frame(t);
    const view = cameraAt(t,innerWidth,innerHeight);
    Object.assign(camera,{left:view.left,right:view.right,top:view.top,bottom:view.bottom});
    camera.updateProjectionMatrix(); material.uniforms.uScale.value = view.scale;
    for (const name of ['position','aAlpha','aSize']) geometry.attributes[name].needsUpdate = true;
    renderer.render(scene,camera);
  };
  layout(); ready = true; bootMs = performance.now() - bootStarted; paint();
  addEventListener('resize',() => { layout(); paint(); });
  // İnceleme arayüzü render zamanına bağlıdır; kare geçmişi saklanmaz.
  window.__sapiens = { seek, replay, pause, stats, timing: T };
  if (playing) { last = 0; raf = requestAnimationFrame(tick); }
}
boot().catch(fail);
