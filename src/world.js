import * as THREE from 'three';
import { S, share, solids, bounds, boundMeshes, zones, torches, plates,
         animated, levelMeshes, gems, movers, hazards, fires } from './state.js';
import { TEX, fireTex, sparkTex } from './textures.js';

/**
 * Paylasilan kaynaklar.
 *
 * Bir bolumde 20-30 duvar var; her biri icin ayri geometri ve materyal uretmek
 * hem bellegi hem cizim cagrisi sayisini gereksiz buyutuyordu. Bunun yerine tek
 * bir birim kup kullanip mesh'i olcekliyoruz ve materyalleri dokuya gore
 * onbellege aliyoruz. Bu kaynaklar `share()` ile isaretlenir; clearLevel onlari
 * dispose etmez.
 */
const UNIT_BOX = share(new THREE.BoxGeometry(1, 1, 1));
const UNIT_PLANE = share(new THREE.PlaneGeometry(1, 1));

const matCache = new Map();
/** Ayni dokuyu kullanan tum yuzeyler tek materyali paylasir. */
function surfaceMat(tex) {
  let m = matCache.get(tex);
  if (!m) {
    m = share(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    matCache.set(tex, m);
  }
  return m;
}

/**
 * Bolum yapi taslari — SADECE insa fonksiyonlari.
 * Kare basi guncellemeler (updateFires, updateMovers, updateHazards...) game.js'te,
 * boylece world.js -> game.js dongusel bagimliligi olusmaz.
 */

/** Carpisan kutu. `stand` = ustune cikilabilir, `cast` = golge dusurur. */
export function solidBox(x, z, w, d, h, tex, stand, cast) {
  const m = new THREE.Mesh(UNIT_BOX, surfaceMat(tex));
  m.scale.set(w, h, d);
  m.position.set(x, h / 2, z);
  m.receiveShadow = true;
  if (cast) m.castShadow = true;
  S.scene.add(m);
  levelMeshes.push(m);
  const s = {
    minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2,
    top: h, stand: !!stand, solid: true, mesh: m,
  };
  solids.push(s);
  return s;
}

// Duvarlar 0.5 kalinliginda ama uzunluga +0.5 eklenir: kosede ust uste binerler,
// boylece kosegen bosluktan sizmak mumkun olmaz.
export const hWall = (z, x1, x2, H) =>
  solidBox((x1 + x2) / 2, z, Math.abs(x2 - x1) + 0.5, 0.5, H || 2.8, TEX.wall, true, true);
export const vWall = (x, z1, z2, H) =>
  solidBox(x, (z1 + z2) / 2, 0.5, Math.abs(z2 - z1) + 0.5, H || 2.8, TEX.wall, true, true);
export const platform = (x, z, w, d, h) => solidBox(x, z, w, d, h, TEX.plat, true, true);

export function door(x, z, w) {
  const s = solidBox(x, z, w, 0.6, 2.6, TEX.door, false, true);
  s.door = true;
  return s;
}

export function boundWall(x, z, w, d) {
  const m = new THREE.Mesh(UNIT_BOX, surfaceMat(TEX.wall));
  m.scale.set(w, 3.4, d);
  m.position.set(x, 1.7, z);
  m.receiveShadow = true;
  S.scene.add(m);
  boundMeshes.push(m);
  bounds.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: 3.4, stand: false });
}

// --- cepere ait yardimcilar: tam kapali oda, kenar basina tek kapi bosluğu ---
export const sideH = (z, x1, x2, gap) =>
  gap ? (hWall(z, x1, gap[0]), hWall(z, gap[1], x2)) : hWall(z, x1, x2);
export const sideV = (x, z1, z2, gap) =>
  gap ? (vWall(x, z1, gap[0]), vWall(x, gap[1], z2)) : vWall(x, z1, z2);

/** g: {n,s,e,w} her biri [gapStart, gapEnd] veya tanimsiz (tam duvar). */
export function box4(x1, x2, z1, z2, g = {}) {
  sideH(z1, x1, x2, g.s); sideH(z2, x1, x2, g.n);
  sideV(x1, z1, z2, g.w); sideV(x2, z1, z2, g.e);
}
export const corridor = (x1, x2, z1, z2) => { vWall(x1, z1, z2); vWall(x2, z1, z2); };

const poolMats = {};
function poolMat(isLava) {
  const k = isLava ? 'lava' : 'water';
  if (!poolMats[k]) {
    poolMats[k] = share(new THREE.MeshStandardMaterial({
      map: isLava ? TEX.lava : TEX.water,
      color: isLava ? 0xff4a12 : 0x1e78ff,
      emissive: isLava ? 0xff2a00 : 0x0a3aff,
      emissiveIntensity: 0.85, roughness: 0.25,
      transparent: !isLava, opacity: isLava ? 1 : 0.9,
    }));
  }
  return poolMats[k];
}

/** Lav / su havuzu — yanlis elemente giren oyuncu icin olumcul bariyerdir. */
export function pool(x, z, w, d, type) {
  // Geometri havuza ozel (koseleri kare basi dalgalandiriliyor), materyal ise
  // tipe gore paylasilir.
  const geo = new THREE.PlaneGeometry(w, d, 14, 14);
  const isLava = type === 'lava';
  const m = new THREE.Mesh(geo, poolMat(isLava));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.06, z);
  m.receiveShadow = true;
  S.scene.add(m);
  levelMeshes.push(m);
  zones.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, type });
  animated.push({ mesh: m, geo, type, base: geo.attributes.position.array.slice() });
  if (isLava) makeFire(x, z, w, d);
}

let FLAME_MAT;
function flameMat() {
  if (!FLAME_MAT) {
    FLAME_MAT = share(new THREE.PointsMaterial({
      size: 1.15, map: fireTex(), vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95,
    }));
  }
  return FLAME_MAT;
}

/** Lav yuzeyinden yukselen alev parcaciklari (renk tabanda sari, tepede kirmizi). */
export function makeFire(x, z, w, d) {
  const N = Math.min(200, Math.max(24, Math.round(w * d * 1.3)));
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), data = [];
  for (let i = 0; i < N; i++) data.push({ life: Math.random() });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, flameMat());
  pts.frustumCulled = false;
  S.scene.add(pts);
  levelMeshes.push(pts);

  const light = new THREE.PointLight(0xff5a10, 0.9, Math.max(w, d) * 1.4);
  light.position.set(x, 1.2, z);
  S.scene.add(light);
  levelMeshes.push(light);

  fires.push({ geo, data, x, z, w, d, N });
}

export function floorPatch(x, z, w, d) {
  const m = new THREE.Mesh(UNIT_PLANE, surfaceMat(TEX.stone));
  m.scale.set(w, d, 1);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0, z);
  m.receiveShadow = true;
  S.scene.add(m);
  levelMeshes.push(m);
}

/** Alev'in yakabilecegi mesale (sondurulmus baslar). */
export function makeTorch(x, z, y) {
  const g = new THREE.Group();
  g.position.set(x, y || 0, z);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2412 }))).position.y = 0.75;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x222, emissive: 0x000000 }));
  bowl.position.y = 1.6; g.add(bowl);
  const fl = new THREE.PointLight(0xff7a18, 0, 7);
  fl.position.y = 1.9; g.add(fl);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sparkTex(), color: 0xff8a2a, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flame.scale.set(0.9, 1.2, 1);
  flame.position.y = 1.95;
  flame.visible = false;
  g.add(flame);
  S.scene.add(g);
  levelMeshes.push(g);
  torches.push({ g, x, z, y: (y || 0) + 1.3, lit: false, bowl, fl, flame });
}

/** Dekoratif duvar mesalesi — hep yanik, atmosfer icin (bulmacaya dahil degil). */
export function makeWallTorch(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 2.1, z);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a2a30 }))).position.y = -0.3;
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: fireTex(), color: 0xffa838, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flame.scale.set(0.75, 1.2, 1);
  flame.position.y = 0.3;
  g.add(flame);
  g.add(new THREE.PointLight(0xff8a30, 0.85, 8)).position.y = 0.35;
  S.scene.add(g);
  levelMeshes.push(g);
  torches.push({ flame, x, z, lit: true });
}

/** Damla'nin cevirdigi valf. */
export function makeValve(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 1, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x2a3540 }))).position.y = 0.5;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.09, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x4aa0d0, emissive: 0x0a3050, emissiveIntensity: 0.6 }));
  wheel.position.set(0, 1.1, 0.1);
  g.add(wheel);
  S.scene.add(g);
  levelMeshes.push(g);
  S.valve = { g, x, z, wheel, active: false };
}

/** Basinc plakasi — ikisi ayni anda basilinca gecit acilir. */
export function makePlate(x, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.14, 20),
    new THREE.MeshStandardMaterial({ color: 0x666, emissive: 0x000000, emissiveIntensity: 0.8 }));
  m.position.set(x, 0.07, z);
  S.scene.add(m);
  levelMeshes.push(m);
  plates.push({ x, z, mesh: m, on: false });
}

/** Bolum sonu pedi. */
export function makeGoal(x, z, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 24),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1, transparent: true, opacity: 0.85 }));
  m.position.set(x, 0.1, z);
  S.scene.add(m);
  levelMeshes.push(m);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 6, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1 }));
  beam.position.set(x, 3, z);
  S.scene.add(beam);
  levelMeshes.push(beam);
  return { x, z };
}

/** Toplanabilir elmas. */
export function makeGem(x, z, y) {
  const g = new THREE.Group();
  g.position.set(x, (y || 0) + 1.0, z);
  g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.34),
    new THREE.MeshStandardMaterial({
      color: 0xdffbff, emissive: 0x5fe6ff, emissiveIntensity: 2.2, roughness: 0.1, metalness: 0.3,
    })));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sparkTex(), color: 0x8fefff, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.scale.set(1.1, 1.1, 1);
  g.add(halo);
  g.add(new THREE.PointLight(0x6fe0ff, 0.7, 4));
  S.scene.add(g);
  levelMeshes.push(g);
  gems.push({ g, x, z, y: (y || 0) + 1.0, got: false });
  S.gemsTotal++;
}

/** Ileri-geri giden platform (ustundeki oyuncuyu tasir — bkz. updateMovers). */
export function makeMover(x, z, w, d, h, axis, range, speed) {
  const s = solidBox(x, z, w, d, h, TEX.plat, true, true);
  movers.push({ s, cx: x, cz: z, axis, range, speed, px: x, pz: z });
  return s;
}

/** Donen testere — her iki oyuncuya da zarar verir. */
export function makeSaw(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.7, z);
  // Tehlikeler parlak lavin uzerinde siluet olarak kaybolmasin diye kendiliginden
  // isik sacar; oyuncu testereyi her zeminde secebilmeli.
  const steel = new THREE.MeshStandardMaterial({
    color: 0xe8ecf6, metalness: 0.6, roughness: 0.25, emissive: 0x8fa0c0, emissiveIntensity: 0.9,
  });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 24), steel);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  for (let i = 0; i < 12; i++) {
    const th = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 4), steel);
    const a = (i / 12) * 6.283;
    th.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0);
    th.rotation.z = a - Math.PI / 2;
    g.add(th);
  }
  S.scene.add(g);
  levelMeshes.push(g);
  hazards.push({ type: 'saw', g, x, z, r: 1.05, disc });
}

/** Sallanan balta — zamanlama ile gecilir. */
export function makeAxe(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 4.2, z);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a2a30 }))).position.y = -1.8;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.14),
    new THREE.MeshStandardMaterial({
      color: 0xe8ecf6, metalness: 0.6, roughness: 0.28, emissive: 0x8fa0c0, emissiveIntensity: 0.9,
    }));
  blade.position.y = -3.5;
  g.add(blade);
  S.scene.add(g);
  levelMeshes.push(g);
  hazards.push({ type: 'axe', g, x, z, blade });
}
