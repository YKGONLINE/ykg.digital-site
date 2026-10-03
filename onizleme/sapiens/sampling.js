import { VW, VH, random } from './motion.js?v=20261003-flow1';
export const SW = 836, SH = 470;
export const SOURCES = ['02-kavramak.webp', '04-tarla.webp', '06-fabrika-tutus-v2.png', '08-ag.webp'];

// Ortak eksende eşit nüfuslu bölmeler: komşular birlikte taşınır, bütün noktalar
// merkeze çökmez. Her hedef bir kez kullanılır; parlaklık da kendi noktasıyla gider.
export function matchPoints(source, target) {
  const count = source.x.length;
  if (target.x.length !== count || source.y.length !== count || target.y.length !== count) throw new Error('Eşleme için eşit nokta sayısı gerekli');
  const left = Uint32Array.from({length: count}, (_,i) => i), right = left.slice();
  const mapping = new Uint32Array(count);
  function comparator(points, axis) {
    const primary = points[axis], secondary = points[axis === 'x' ? 'y' : 'x'];
    return (a,b) => primary[a]-primary[b] || secondary[a]-secondary[b] || a-b;
  }
  function partition(ids, lo, hi, mid, compare) {
    let first = lo, last = hi-1;
    while (first < last) {
      const pivot = ids[(first+last) >>> 1];
      let i = first, j = last;
      while (i <= j) {
        while (compare(ids[i],pivot) < 0) i++;
        while (compare(ids[j],pivot) > 0) j--;
        if (i <= j) { const swap=ids[i]; ids[i++]=ids[j]; ids[j--]=swap; }
      }
      if (mid <= j) last=j;
      else if (mid >= i) first=i;
      else break;
    }
  }
  const compare = {x:[comparator(source,'x'),comparator(target,'x')],y:[comparator(source,'y'),comparator(target,'y')]};
  function pair(lo, hi) {
    if (hi <= lo) return;
    if (hi-lo === 1) { mapping[left[lo]]=right[lo]; return; }
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(let k=lo;k<hi;k++) {
      const a=left[k],b=right[k];
      minX=Math.min(minX,source.x[a],target.x[b]); maxX=Math.max(maxX,source.x[a],target.x[b]);
      minY=Math.min(minY,source.y[a],target.y[b]); maxY=Math.max(maxY,source.y[a],target.y[b]);
    }
    const axis=maxX-minX >= maxY-minY ? 'x' : 'y';
    if (hi-lo <= 16) {
      left.subarray(lo,hi).sort(compare[axis][0]); right.subarray(lo,hi).sort(compare[axis][1]);
      for(let k=lo;k<hi;k++) mapping[left[k]]=right[k];
      return;
    }
    const mid=(lo+hi) >>> 1;
    partition(left,lo,hi,mid,compare[axis][0]); partition(right,lo,hi,mid,compare[axis][1]);
    pair(lo,mid); pair(mid,hi);
  }
  pair(0,count);
  return mapping;
}

export function alignTargets(targets) {
  if (targets.length !== 4 || !targets[0].x.length || targets.some(p => p.x.length !== targets[0].x.length || p.y.length !== p.x.length || p.b.length !== p.x.length)) throw new Error('Dört eşit nokta kümesi gerekli');
  const aligned=[];
  for(let scene=0;scene<targets.length;scene++) {
    const target=targets[scene];
    const sourceIndex=scene ? matchPoints(aligned[scene-1],target) : Uint32Array.from({length:target.x.length},(_,i)=>i);
    aligned.push({sourceIndex,...Object.fromEntries(['x','y','b'].map(key=>[key,Float32Array.from(sourceIndex,i=>target[key][i])]))});
  }
  return aligned;
}

// V3'teki parlaklıktan örnekleme korunur; düşük tonlar elin dokusu için daha az budanır.
export function sample(lum, count, seed, gain = 1) {
  if (lum.length !== SW * SH) throw new Error('Kaynak boyutu uyuşmuyor');
  const cdf = new Float64Array(lum.length), rnd = random(seed);
  let total = 0;
  for (let i = 0; i < lum.length; i++) { total += Math.max(0, lum[i] - .035); cdf[i] = total; }
  if (!Number.isFinite(total) || total <= 0) throw new Error('Kaynakta örneklenebilir nokta yok');
  const x = new Float32Array(count), y = x.slice(), b = x.slice();
  for (let i = 0; i < count; i++) {
    const pick = rnd() * total;
    let lo = 0, hi = lum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < pick) lo = m + 1; else hi = m; }
    x[i] = ((lo % SW) + rnd()) / SW * VW;
    y[i] = (Math.floor(lo / SW) + rnd()) / SH * VH;
    b[i] = Math.max(.20, Math.min(1, lum[lo] * 1.4)) * gain;
  }
  return { x, y, b };
}

export async function loadLum(name) {
  const img = new Image(); img.src = `assets/${name}`; await img.decode();
  const canvas = document.createElement('canvas'); canvas.width = SW; canvas.height = SH;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(img, 0, 0, SW, SH);
  const data = context.getImageData(0, 0, SW, SH).data;
  return Float32Array.from({ length: SW * SH }, (_, i) => data[i * 4] / 255);
}
