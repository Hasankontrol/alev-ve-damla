import * as THREE from 'three';

/** Bolum yapi taslarinin kullandigi ortak doku seti (init() doldurur). */
export const TEX = {};

/** Rastgele benekli yuzey dokusu (tas, lav, su). */
export function noiseTex(base, hi, scale, rep) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = Math.random() < 0.5 ? hi : base;
    x.globalAlpha = Math.random() * 0.5;
    const s = Math.random() * scale + 1;
    x.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep, rep);
  return t;
}

function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Duvarlar icin tugla dokusu (sirali derzli, hafif renk varyasyonlu). */
export function brickTex(brick, mortar, rep) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = mortar;
  x.fillRect(0, 0, 256, 256);
  const bh = 32, bw = 64, mo = 4;
  for (let r = 0, row = 0; r < 256; r += bh, row++) {
    const off = (row % 2) ? bw / 2 : 0;
    for (let cx = -bw; cx < 256; cx += bw) {
      const px = cx + off + mo / 2, py = r + mo / 2;
      x.fillStyle = shadeHex(brick, Math.random() * 0.22 - 0.08);
      x.fillRect(px, py, bw - mo, bh - mo);
      x.fillStyle = 'rgba(0,0,0,.12)';
      x.fillRect(px, py + bh - mo - 3, bw - mo, 3);   // alt golge
      x.fillStyle = 'rgba(255,255,255,.05)';
      x.fillRect(px, py, bw - mo, 2);                 // ust isik
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep, rep);
  return t;
}

let FIRETEX;
/** Alev partikulu: sicak merkezden saydama giden radyal gecis. */
export function fireTex() {
  if (FIRETEX) return FIRETEX;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,220,1)');
  g.addColorStop(0.3, 'rgba(255,180,60,.9)');
  g.addColorStop(0.6, 'rgba(255,90,20,.5)');
  g.addColorStop(1, 'rgba(255,40,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return (FIRETEX = new THREE.CanvasTexture(c));
}

let SPARK;
/** Beyaz yumusak nokta — aura, elmas halesi ve mesale alevi icin. */
export function sparkTex() {
  if (SPARK) return SPARK;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff');
  gr.addColorStop(0.4, 'rgba(255,255,255,.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  return (SPARK = new THREE.CanvasTexture(c));
}

/** Fotograf yuklenmediginde kullanilan cizili varsayilan yuz. */
export function faceTex(bg) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#0a0a12';
  x.beginPath(); x.arc(46, 54, 8, 0, 7); x.fill();
  x.beginPath(); x.arc(82, 54, 8, 0, 7); x.fill();
  x.lineWidth = 5;
  x.strokeStyle = '#0a0a12';
  x.beginPath(); x.arc(64, 78, 18, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
  return new THREE.CanvasTexture(c);
}

/** Foto figur modunda fotograf yoksa gosterilen govde silueti. */
export function silhouetteTex(bg) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.beginPath(); x.arc(64, 50, 26, 0, 7); x.fill();
  x.fillRect(40, 78, 48, 90);
  x.fillRect(30, 80, 14, 70); x.fillRect(84, 80, 14, 70);
  x.fillRect(48, 168, 14, 80); x.fillRect(66, 168, 14, 80);
  return new THREE.CanvasTexture(c);
}

/** init() icinden bir kez cagrilir. */
export function buildTextures() {
  TEX.wall  = brickTex('#6b6f7a', '#2a2d35');
  TEX.plat  = brickTex('#7a6a52', '#2e2820');
  TEX.stone = noiseTex('#2a2e38', '#191c24', 6, 16);
  TEX.door  = noiseTex('#6a4420', '#331f0c', 5);
  TEX.lava  = noiseTex('#a01e00', '#ff9a20', 5);
  TEX.water = noiseTex('#0a3a88', '#7fe0ff', 4);
}
