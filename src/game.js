import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { S, SHARED, chaseCP, resetLevelLists, solids, bounds, boundMeshes, zones,
         torches, plates, animated, levelMeshes, gems, movers, hazards, fires, mixers } from './state.js';
import { TEX, buildTextures, sparkTex } from './textures.js';
import { SFX, setMute, startHum, stopHum } from './audio.js';
import { inp } from './input.js';
import { makePlayer, updateAura } from './entities.js';
import { resetLightBudget } from './world.js';
import { updateLiquids } from './liquids.js';
import { LEVELS, LEVEL_NAMES } from './levels.js';
import { getLevelIntro, FINAL_SCENE, showCutscene, isCutsceneOpen } from './story.js';
import { recordLevelComplete, unlockLevel, recordDeath } from './progress.js';

// r152+ varsayilan renk yonetimi sahnenin tonunu degistiriyordu;
// oyunun ayarlanmis gorunumunu korumak icin kapatiyoruz.
THREE.ColorManagement.enabled = false;

const up = new THREE.Vector3(0, 1, 0);
const ray = new THREE.Raycaster();
const _sz = new THREE.Vector2();

/** Kose penceresinin ekran genisligine orani ve kenar boslugu (piksel). */
const PIP_W = 0.26, PIP_MARGIN = 14;

let dragging = false, lastX = 0, lastY = 0;

// ---------- fizik sabitleri ----------
const R = 0.5;      // oyuncu yaricapi
const STEP = 0.5;   // bu yukseklige kadar olan engeller yandan itmez (basamak)
const SPEED = 6.5, JUMP = 8.6, GRAV = 22;

// ---------- HUD yardimcilari ----------
const el = (id) => document.getElementById(id);
function banner(txt) {
  const b = el('banner');
  b.textContent = txt;
  b.style.opacity = 1;
  setTimeout(() => { b.style.opacity = 0; }, 1600);
}
function flash() {
  const f = el('chaseFlash');
  f.style.opacity = 0.55;
  setTimeout(() => { f.style.opacity = 0; }, 120);
}

/**
 * Havada suzulen toz zerreleri. Oyuncularin etrafinda dolasan bir kutu icinde
 * tutulur (kutudan cikan zerre karsi tarafa sarar), boylece tek ve kucuk bir
 * parcacik sistemi tum haritayi kaplamis gibi gorunur. Rengi bolum atmosferine
 * gore ayarlanir.
 */
const DUST_N = 140, DUST_BOX = 46;
let dust = null;
function makeDust() {
  const pos = new Float32Array(DUST_N * 3);
  for (let i = 0; i < DUST_N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * DUST_BOX;
    pos[i * 3 + 1] = Math.random() * 12;
    pos[i * 3 + 2] = (Math.random() - 0.5) * DUST_BOX;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.13, map: sparkTex(), color: 0x9fb4d0, transparent: true,
    opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  dust = new THREE.Points(geo, mat);
  dust.frustumCulled = false;
  S.scene.add(dust);
}
function updateDust(dt, t) {
  if (!dust) return;
  const mid = S.split ? S.fire.g.position : null;
  const cx = mid ? mid.x : (S.fire.g.position.x + S.water.g.position.x) / 2;
  const cz = mid ? mid.z : (S.fire.g.position.z + S.water.g.position.z) / 2;
  const p = dust.geometry.attributes.position.array;
  const h = DUST_BOX / 2;
  for (let i = 0; i < DUST_N; i++) {
    const j = i * 3;
    p[j] += Math.sin(t * 0.3 + i) * dt * 0.25;      // yavas yatay suruklenme
    p[j + 1] += dt * 0.22;                           // hafifce yukselir
    if (p[j + 1] > 12) p[j + 1] = 0;
    // oyunculardan uzaklasan zerre karsi tarafa sarar
    if (p[j] - cx > h) p[j] -= DUST_BOX; else if (p[j] - cx < -h) p[j] += DUST_BOX;
    if (p[j + 2] - cz > h) p[j + 2] -= DUST_BOX; else if (p[j + 2] - cz < -h) p[j + 2] += DUST_BOX;
  }
  dust.geometry.attributes.position.needsUpdate = true;
}

// Kamera sarsintisi — darbe hissi. Miktar her karede sonuyor.
let shake = 0;
const addShake = (amount) => { shake = Math.min(1, shake + amount); };
function applyShake(cam, dt) {
  if (shake <= 0.001) { shake = 0; return; }
  const s = shake * 0.55;
  cam.position.x += (Math.random() - 0.5) * s;
  cam.position.y += (Math.random() - 0.5) * s;
  cam.position.z += (Math.random() - 0.5) * s;
  shake = Math.max(0, shake - dt * 2.4);
}

// ---------- bolum yukleme ----------
/**
 * Sahneden cikarilan nesnenin GPU kaynaklarini serbest birakir.
 * Paylasilan geometri/materyaller (SHARED) atlanir — onlar sonraki bolumde
 * yeniden kullanilir. Dokular da atlanir; hepsi kalicidir.
 */
function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry && !SHARED.has(o.geometry)) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) if (!SHARED.has(m)) m.dispose();
  });
}

function clearLevel() {
  for (const m of levelMeshes) { S.scene.remove(m); disposeObject(m); }
  resetLevelLists();
  resetLightBudget();
  S.gemsGot = 0; S.gemsTotal = 0;
  S.doorTorch = S.doorValve = S.gateDual = S.valve = S.kulge = null;
  S.kulgeActive = false;
  S.dirLight.intensity = 0.85;
  S.scene.background = new THREE.Color(0x05060a);
}

/**
 * @param {number} i bolum indeksi
 * @param {{skipIntro?:boolean}} [opt] acilis sahnesinin hemen ardindan
 *   cagrildiginda iki sahnenin ust uste binmemesi icin giris atlanir
 */
export function loadLevel(i, opt = {}) {
  S.curLevel = i;
  S.levelStart = S.clock ? S.clock.getElapsedTime() : 0;   // bolum kronometresi
  clearLevel();
  const cfg = LEVELS[i]();

  S.fire.spawn.set(cfg.fire[0], 0, cfg.fire[1]);
  S.water.spawn.set(cfg.water[0], 0, cfg.water[1]);
  respawnTo(S.fire, S.fire.spawn);
  respawnTo(S.water, S.water.spawn);

  S.levelHasChase = !!cfg.chase;
  S.levelChaseZ = cfg.chaseZ || 0;
  S.levelExitZ = cfg.exitZ || 0;
  if (cfg.cp) chaseCP.set(cfg.cp[0], cfg.cp[1], cfg.cp[2]);
  S.curHint = cfg.hint;

  if (cfg.atmos) {
    const a = cfg.atmos;
    S.scene.fog.color.setHex(a.fog);
    S.scene.fog.near = a.near;
    S.scene.fog.far = a.far;
    S.scene.background.setHex(a.fog);
    if (S.hemi) S.hemi.color.setHex(a.hemi);
    S.dirLight.color.setHex(a.dir);
    if (dust) dust.material.color.setHex(a.hemi);   // toz da bolumun tonunu alsin
  }

  el('levelName').textContent = cfg.name;
  banner(cfg.name);
  el('gemCount').textContent = S.gemsGot + '/' + S.gemsTotal;

  const intro = opt.skipIntro ? null : getLevelIntro(i);
  if (intro) {
    S.paused = true;
    showCutscene({ ...intro, onClose: () => { S.paused = false; } });
  }
}

function respawnTo(p, pos) {
  p.g.position.copy(pos);
  p.g.position.y = 0;
  p.vel.set(0, 0, 0);
  p.health = 100;
  p.invuln = 1;
  p.safeSpot = null;        // yeni bolum: onceki bolumun guvenli noktasi gecersiz
  p.safeClock = 0;
}

/**
 * Guvenli nokta: oyuncu yerdeyken, zarar vermeyen bir zeminde ve tehlikeden
 * uzaktayken konumu kaydedilir. Olunce bolum basina degil buraya donulur —
 * uzun bolumlerde bolum basina donmek asiri cezalandiriciydi.
 * Kovalamaca sirasinda bu devre disi kalir (Kulge'nin dibinde dogmamak icin
 * bolume ozel kontrol noktasi kullanilir).
 */
function updateSafeSpot(p, dt) {
  p.safeClock = (p.safeClock || 0) + dt;
  if (p.safeClock < 0.35) return;
  p.safeClock = 0;
  if (!p.grounded || p.invuln > 0) return;
  if (inZone(p, 'lava') || inZone(p, 'water')) return;      // sivinin ustunde kaydetme
  for (const h of hazards) {                                 // tehlikeye yakinsa kaydetme
    const dx = p.g.position.x - h.x, dz = p.g.position.z - h.z;
    if (dx * dx + dz * dz < 16) return;
  }
  (p.safeSpot ||= new THREE.Vector3()).copy(p.g.position);
}

function respawn(p) {
  const inChase = S.levelHasChase && anyBeyond(S.levelChaseZ);
  const cp = inChase ? chaseCP : (p.safeSpot || p.spawn);
  p.g.position.copy(cp);
  if (inChase || !p.safeSpot) p.g.position.x += (p === S.fire ? -1 : 1);
  p.g.position.y = 0;
  p.vel.set(0, 0, 0);
  p.health = 100;
  p.invuln = 1.2;
  recordDeath();
  addShake(0.8);
  SFX.hurt();
}

// ---------- fizik ----------
function push(px, pz, s) {
  const cx = Math.max(s.minX, Math.min(px, s.maxX));
  const cz = Math.max(s.minZ, Math.min(pz, s.maxZ));
  const dx = px - cx, dz = pz - cz, d2 = dx * dx + dz * dz;
  if (d2 < R * R) {
    const d = Math.sqrt(d2) || 1e-4, k = (R - d) / d;
    px += dx * k; pz += dz * k;
  }
  return [px, pz];
}
const footprint = (px, pz, s, m) =>
  px > s.minX - m && px < s.maxX + m && pz > s.minZ - m && pz < s.maxZ + m;

/** Yandan itme (duvarlar) + ustte durma destegi (platformlar). */
function resolve(p) {
  let px = p.g.position.x, pz = p.g.position.z;
  const py = p.g.position.y;
  for (let it = 0; it < 2; it++) {           // iki gecis: koseye sikismayi cozer
    for (const s of solids) { if (s.solid === false || s.top <= py + STEP) continue; [px, pz] = push(px, pz, s); }
    for (const s of bounds) { if (s.top <= py + STEP) continue; [px, pz] = push(px, pz, s); }
  }
  let support = 0;
  for (const s of solids) {
    if (s.solid === false || !s.stand) continue;
    if (s.top <= py + STEP && s.top > support && footprint(px, pz, s, R * 0.5)) support = s.top;
  }
  p.g.position.x = Math.max(-40, Math.min(40, px));
  p.g.position.z = Math.max(-20, Math.min(130, pz));
  p._support = support;
}

function movePlayer(p, dt) {
  const who = p === S.fire ? 'fire' : 'water';
  const cam = p.cam || S.camera;                 // bolunmus ekranda kendi kamerasi
  const f = new THREE.Vector3();
  cam.getWorldDirection(f); f.y = 0; f.normalize();
  const r = new THREE.Vector3().crossVectors(f, up).normalize();

  const dir = new THREE.Vector3();
  if (inp(who, 'up')) dir.add(f);
  if (inp(who, 'down')) dir.sub(f);
  if (inp(who, 'right')) dir.add(r);
  if (inp(who, 'left')) dir.sub(r);

  const moving = dir.lengthSq() > 0;
  if (moving) {
    dir.normalize();
    p.g.position.x += dir.x * SPEED * dt;
    p.g.position.z += dir.z * SPEED * dt;
    p.g.rotation.y = Math.atan2(dir.x, dir.z);
  }
  if (inp(who, 'jump') && p.grounded) { p.vel.y = JUMP; p.grounded = false; SFX.jump(); }

  p.vel.y -= GRAV * dt;
  p.g.position.y += p.vel.y * dt;
  resolve(p);
  if (p.g.position.y <= p._support) { p.g.position.y = p._support; p.vel.y = 0; p.grounded = true; }
  else p.grounded = false;

  // yuruyus animasyonu
  p.phase += (moving ? 10 : 3) * dt;
  const sw = Math.sin(p.phase) * (moving ? 0.5 : 0.08);
  p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw;
  p.arms[0].rotation.x = -sw; p.arms[1].rotation.x = sw;
  if (moving && p.grounded) {
    p.footClock += dt;
    if (p.footClock > 0.32) { p.footClock = 0; SFX.step(); }
  }
}

const inZone = (p, type) =>
  p.g.position.y < 0.6 && zones.some((q) =>
    p.g.position.x > q.minX && p.g.position.x < q.maxX &&
    p.g.position.z > q.minZ && p.g.position.z < q.maxZ && q.type === type);

/** Yanlis eleman olumcul bariyerdir — icinden yurunerek gecilemez. */
function damage(p, dt) {
  const bad = (p === S.fire) ? 'water' : 'lava';
  if (inZone(p, bad)) { p.health -= 200 * dt; if (p.invuln <= 0) flash(); }
  else if (p.health < 100) p.health += 14 * dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.health <= 0) respawn(p);
  p.health = Math.max(0, Math.min(100, p.health));
}

const anyBeyond = (z) => S.fire.g.position.z > z || S.water.g.position.z > z;
const near = (p, x, z, r = 1.8) => {
  const dx = p.g.position.x - x, dz = p.g.position.z - z;
  return dx * dx + dz * dz < r * r;
};

// ---------- kare basi guncellemeler ----------
function updateMovers(t) {
  for (const m of movers) {
    const off = Math.sin(t * m.speed) * m.range;
    const nx = m.axis === 'x' ? m.cx + off : m.cx;
    const nz = m.axis === 'z' ? m.cz + off : m.cz;
    const dx = nx - m.px, dz = nz - m.pz;
    m.s.mesh.position.x = nx; m.s.mesh.position.z = nz;
    const w = m.s.maxX - m.s.minX, d = m.s.maxZ - m.s.minZ;
    m.s.minX = nx - w / 2; m.s.maxX = nx + w / 2;
    m.s.minZ = nz - d / 2; m.s.maxZ = nz + d / 2;
    // ustundeki oyuncuyu birlikte tasi
    for (const p of [S.fire, S.water]) {
      if (p.grounded && Math.abs(p.g.position.y - m.s.top) < 0.2 &&
          p.g.position.x > m.s.minX - 0.4 && p.g.position.x < m.s.maxX + 0.4 &&
          p.g.position.z > m.s.minZ - 0.4 && p.g.position.z < m.s.maxZ + 0.4) {
        p.g.position.x += dx; p.g.position.z += dz;
      }
    }
    m.px = nx; m.pz = nz;
  }
}

/**
 * Tehlikeler artik OLUMCUL.
 *
 * Onceden testere 34 hasar verip 0.7 sn dokunulmazlik biraktigi icin oyuncu
 * icinden yuruyup gecebiliyordu — engel olmaktan cikmisti. Sivi havuzlariyla
 * ayni kurala getirildi: degen olur. Guvenli nokta sistemi sayesinde olum
 * cezasi kucuk (birkac adim geri), bu yuzden adil.
 */
function hitPlayer(p) {
  if (p.invuln > 0) return;
  p.health = 0;
  addShake(0.9);
  flash();
  respawn(p);
}

function updateHazards(t) {
  for (const h of hazards) {
    if (h.type === 'saw') {
      h.disc.rotation.z -= 0.45;
      for (const p of [S.fire, S.water]) {
        const dx = p.g.position.x - h.x, dz = p.g.position.z - h.z;
        if (dx * dx + dz * dz < (h.r + 0.4) ** 2 && p.g.position.y < 1.5) hitPlayer(p);
      }
    } else {                                   // sallanan balta
      const a = Math.sin(t * 1.5) * 1.05;
      h.g.rotation.z = a;
      const bx = h.x + Math.sin(a) * 3.5;
      for (const p of [S.fire, S.water]) {
        const dx = p.g.position.x - bx, dz = p.g.position.z - h.z;
        if (dx * dx + dz * dz < 1.3 && p.g.position.y < 1.3) hitPlayer(p);
      }
    }
  }
}

function updateFires(dt) {
  for (const f of fires) {
    const p = f.geo.attributes.position.array, c = f.geo.attributes.color.array;
    for (let i = 0; i < f.N; i++) {
      const d = f.data[i];
      d.life -= dt * (1.1 + d.sp * 0.6 || 1.4);
      if (d.life <= 0) {                        // tabandan yeniden dog
        d.life = 1; d.sp = 0.6 + Math.random();
        d.x = f.x + (Math.random() - 0.5) * f.w * 0.9;
        d.z = f.z + (Math.random() - 0.5) * f.d * 0.9;
        d.y = 0.15;
        d.vx = (Math.random() - 0.5) * 0.3;
        d.vz = (Math.random() - 0.5) * 0.3;
      }
      d.y += (1.6 + d.sp) * dt; d.x += d.vx * dt; d.z += d.vz * dt;
      p[i * 3] = d.x; p[i * 3 + 1] = d.y; p[i * 3 + 2] = d.z;
      const t = 1 - d.life;                     // 0 taban (sicak) -> 1 tepe (soguk)
      c[i * 3] = 1;
      c[i * 3 + 1] = Math.max(0, 0.9 - t * 1.1);
      c[i * 3 + 2] = Math.max(0, 0.5 - t * 1.4);
    }
    f.geo.attributes.position.needsUpdate = true;
    f.geo.attributes.color.needsUpdate = true;
  }
}

function updateGems(t) {
  for (const gm of gems) {
    if (gm.got) continue;
    gm.g.rotation.y += 0.05;
    gm.g.position.y = gm.y + Math.sin(t * 2 + gm.x) * 0.12;
    if (near(S.fire, gm.x, gm.z, 1.1) || near(S.water, gm.x, gm.z, 1.1)) {
      gm.got = true;
      gm.g.visible = false;
      S.gemsGot++; S.gemsAll++;
      SFX.gem();
      el('gemCount').textContent = S.gemsGot + '/' + S.gemsTotal;
    }
  }
}

function openDoor(d) {
  if (!d || !d.solid) return;
  d.solid = false;
  SFX.door();
  (function slide() {
    if (d.mesh.position.y > -3) { d.mesh.position.y -= 0.12; requestAnimationFrame(slide); }
  })();
}

function interactions() {
  for (const t of torches) {
    if (!t.lit && near(S.fire, t.x, t.z, 1.7) &&
        Math.abs(S.fire.g.position.y + 1.3 - t.y) < 1.1 && inp('fire', 'interact')) {
      t.lit = true;
      t.bowl.material.emissive.setHex(0xff6a00);
      t.bowl.material.emissiveIntensity = 1.4;
      t.fl.intensity = 1.6;
      t.flame.visible = true;
      SFX.torch();
    }
  }
  if (S.doorTorch && torches.length && torches.every((t) => t.lit)) openDoor(S.doorTorch);

  if (S.valve && !S.valve.active && near(S.water, S.valve.x, S.valve.z) && inp('water', 'interact')) {
    S.valve.active = true;
    S.valve.wheel.material.emissive.setHex(0x2fd0ff);
    SFX.valve();
  }
  if (S.valve?.active) { S.valve.wheel.rotation.z += 0.08; openDoor(S.doorValve); }

  if (plates.length === 2) {
    const [a, b] = plates;
    a.on = near(S.fire, a.x, a.z, 1.2) || near(S.water, a.x, a.z, 1.2);
    b.on = near(S.fire, b.x, b.z, 1.2) || near(S.water, b.x, b.z, 1.2);
    plates.forEach((pl) => pl.mesh.material.emissive.setHex(pl.on ? 0x33ff88 : 0x000000));
    if (a.on && b.on) openDoor(S.gateDual);
  }
}

function updateChase(dt, t) {
  if (!S.levelHasChase) return;
  if (!S.kulgeActive && anyBeyond(S.levelChaseZ)) { S.kulgeActive = true; startHum(); }
  if (!S.kulgeActive || !S.kulge) return;

  // isik titremesi + ara sira kirmizi flas
  S.dirLight.intensity = 0.32 + Math.random() * 0.45;
  S.scene.background = new THREE.Color(Math.random() < 0.08 ? 0x2a0008 : 0x05060a);

  const k = S.kulge;
  const tgt = S.fire.g.position.distanceTo(k.g.position) < S.water.g.position.distanceTo(k.g.position)
    ? S.fire : S.water;
  const d = new THREE.Vector3().subVectors(tgt.g.position, k.g.position);
  d.y = 0;
  if (d.length() > 0.01) { d.normalize(); k.g.position.addScaledVector(d, 5.3 * dt); }
  k.g.position.y = 0.1 + Math.sin(t * 3) * 0.12;
  k.g.lookAt(tgt.g.position.x, k.g.position.y, tgt.g.position.z);
  k.arms[0].rotation.x = -0.5 + Math.sin(t * 3) * 0.4;
  k.arms[1].rotation.x = -0.5 + Math.sin(t * 3 + 1) * 0.4;
  k.glow.intensity = 0.8 + Math.sin(t * 11) * 0.35;
  k.wisps.forEach((w, i) => { w.position.y = 0.5 + Math.sin(t * 2 + i) * 0.3; });

  for (const p of [S.fire, S.water]) {
    if (p.invuln <= 0 && p.g.position.distanceTo(k.g.position) < 1.5) {
      flash();
      p.health = Math.max(1, p.health - 40);
      respawn(p);
      k.g.position.z -= 4;                     // biraz geri it
    }
  }
  if (S.fire.g.position.z > S.levelExitZ && S.water.g.position.z > S.levelExitZ) {
    S.kulgeActive = false;
    k.g.visible = false;
    stopHum();
    S.dirLight.intensity = 0.9;
    S.scene.background = new THREE.Color(0x05060a);
  }
}

function checkComplete() {
  if (S.transitioning || S.won) return;
  if (S.levelHasChase && S.kulgeActive) return;
  if (near(S.fire, S.goalFire.x, S.goalFire.z, 1.3) && near(S.water, S.goalWater.x, S.goalWater.z, 1.3)) {
    S.transitioning = true;
    SFX.win();
    recordLevelComplete(S.curLevel, S.clock.getElapsedTime() - (S.levelStart || 0), S.gemsGot);
    unlockLevel(Math.min(S.curLevel + 1, LEVELS.length - 1));
    if (S.curLevel < LEVELS.length - 1) {
      banner('Bölüm tamamlandı!');
      setTimeout(() => { loadLevel(S.curLevel + 1); S.transitioning = false; }, 1400);
    } else {
      S.won = true;
      stopHum();
      el('gemFinal').textContent = S.gemsAll;
      showCutscene({ ...FINAL_SCENE, onClose: () => el('winScreen').classList.remove('hidden') });
    }
  }
}

// ---------- kamera ----------
/** Kamera duvarin icine girmesin: hedef ile kamera arasinda isin at, engele carparsa one cek. */
function camCollide(target, want) {
  const dir = want.clone().sub(target);
  const len = dir.length() || 1e-4;
  dir.normalize();
  ray.set(target, dir);
  ray.far = len;
  const hit = ray.intersectObjects([...solids.map((s) => s.mesh), ...boundMeshes], false);
  return hit.length ? target.clone().add(dir.multiplyScalar(Math.max(3, hit[0].distance - 0.5))) : want;
}

function followCam(cam, p) {
  const tx = p.g.position.x, tz = p.g.position.z, dist = S.camDistBase;
  const target = new THREE.Vector3(tx, 1.2, tz);
  const want = new THREE.Vector3(
    tx + Math.sin(S.camYaw) * Math.cos(S.camPitch) * -dist,
    Math.sin(S.camPitch) * dist + 1.5,
    tz + Math.cos(S.camYaw) * Math.cos(S.camPitch) * -dist);
  cam.position.lerp(camCollide(target, want), 0.16);
  cam.lookAt(target);
}

/**
 * Tek cihazda oynarken asil sorun suydu: iki oyuncu ayrilinca ortak kamera
 * geri cekiliyor, ikisi de kucuculuk bir noktaya donusuyordu.
 *
 * Cozum: ekran oyuncular uzaklasinca KENDILIGINDEN ikiye bolunur, yaklasinca
 * tek goruntude birlesir. Acilip kapanma titremesin diye iki farkli esik
 * kullanilir (histerezis). Iki kamera da ayni camYaw/camPitch'i kullandigi icin
 * gecis aninda hareket yonu degismez.
 */
const SPLIT_ON = 17, SPLIT_OFF = 11;
function updateSplitState() {
  if (S.view === 'pip') {                 // kose penceresi: iki ayri kamera hep acik
    S.split = false;
    S.fire.cam = S.camFire;
    S.water.cam = S.camWater;
    el('splitLine').classList.add('hidden');
    el('pipFrame').classList.remove('hidden');
    return;
  }
  el('pipFrame').classList.add('hidden');
  if (S.splitMode === 'always') { S.split = true; }
  else {
    const sep = S.fire.g.position.distanceTo(S.water.g.position);
    if (!S.split && sep > SPLIT_ON) S.split = true;
    else if (S.split && sep < SPLIT_OFF) S.split = false;
  }
  S.fire.cam = S.split ? S.camFire : S.camera;
  S.water.cam = S.split ? S.camWater : S.camera;
  el('splitLine').classList.toggle('hidden', !S.split);
}

function updateCamera(dt) {
  updateSplitState();
  if (S.view === 'pip') {
    followCam(S.camFire, S.fire); followCam(S.camWater, S.water);
    const before = shake;
    applyShake(S.camFire, dt); shake = before; applyShake(S.camWater, dt);
    return;
  }
  if (S.split) {
    followCam(S.camFire, S.fire); followCam(S.camWater, S.water);
    const before = shake;
    applyShake(S.camFire, dt);
    shake = before;                       // iki kamera da ayni sarsintiyi alsin
    applyShake(S.camWater, dt);
    return;
  }
  // tek ekran: iki oyuncunun ortasini takip et, aralari acildikca geri cekil
  const mid = new THREE.Vector3().addVectors(S.fire.g.position, S.water.g.position).multiplyScalar(0.5);
  const sep = S.fire.g.position.distanceTo(S.water.g.position);
  const dist = Math.min(28, S.camDistBase + sep * 0.55);
  const target = new THREE.Vector3(mid.x, 1.2, mid.z);
  const want = new THREE.Vector3(
    mid.x + Math.sin(S.camYaw) * Math.cos(S.camPitch) * -dist,
    Math.sin(S.camPitch) * dist + 1.5,
    mid.z + Math.cos(S.camYaw) * Math.cos(S.camPitch) * -dist);
  S.camera.position.lerp(camCollide(target, want), 0.14);
  S.camera.lookAt(target);
  applyShake(S.camera, dt);
}

/**
 * Sivi yuzeyleri artik kendi gölgelendiricilerinde dalgalaniyor ve akiyor
 * (bkz. liquids.js), bu yuzden burada yalnizca zaman ilerletilir. Onceden her
 * havuzun 15x15 kose dizisi her karede CPU'da yeniden hesaplaniyordu.
 */
function animateWorld(time) {
  updateLiquids(time);
}

// ---------- render ----------
export function renderFrame() {
  // Kose penceresi: ana ekran kendi karakterin, sag ustte kucuk pencerede esin.
  // Ayni cihazda oynarken ana ekran Alev, kosedeki Damla olur; ileride cevrim ici
  // oynanista kosedeki pencere uzaktaki esi gosterecek — render yolu ayni.
  if (S.view === 'pip') {
    S.renderer.getSize(_sz);
    const W = _sz.x, H = _sz.y;
    if (S.camFire.aspect !== W / H) { S.camFire.aspect = W / H; S.camFire.updateProjectionMatrix(); }
    S.renderer.setScissorTest(false);
    S.renderer.setViewport(0, 0, W, H);
    S.renderer.render(S.scene, S.camFire);

    const pw = Math.round(W * PIP_W), ph = Math.round(pw * 0.68);
    const px = W - pw - PIP_MARGIN, py = H - ph - PIP_MARGIN;
    if (S.camWater.aspect !== pw / ph) { S.camWater.aspect = pw / ph; S.camWater.updateProjectionMatrix(); }
    S.renderer.setScissorTest(true);
    S.renderer.setViewport(px, py, pw, ph);
    S.renderer.setScissor(px, py, pw, ph);
    S.renderer.clear(true, true, false);           // kose penceresi kendi sahnesini cizsin
    S.renderer.render(S.scene, S.camWater);
    S.renderer.setScissorTest(false);
    S.renderer.setViewport(0, 0, W, H);
    return;
  }
  if (S.split) {
    S.renderer.getSize(_sz);
    const W = _sz.x, H = _sz.y, a = (W / 2) / H;
    if (S.camFire.aspect !== a) {
      S.camFire.aspect = S.camWater.aspect = a;
      S.camFire.updateProjectionMatrix();
      S.camWater.updateProjectionMatrix();
    }
    S.renderer.setScissorTest(true);
    S.renderer.setViewport(0, 0, W / 2, H); S.renderer.setScissor(0, 0, W / 2, H);
    S.renderer.render(S.scene, S.camFire);
    S.renderer.setViewport(W / 2, 0, W / 2, H); S.renderer.setScissor(W / 2, 0, W / 2, H);
    S.renderer.render(S.scene, S.camWater);
    S.renderer.setScissorTest(false);
    S.renderer.setViewport(0, 0, W, H);
    return;
  }
  if (S.composer) S.composer.render();
  else S.renderer.render(S.scene, S.camera);
}

export function frame(dt, t) {
  if (mixers.length) mixers.forEach((m) => m.update(dt));
  if (!(S.started && !S.won && !S.paused)) return;

  updateMovers(t);
  movePlayer(S.fire, dt);
  movePlayer(S.water, dt);
  damage(S.fire, dt); damage(S.water, dt);
  updateSafeSpot(S.fire, dt); updateSafeSpot(S.water, dt);
  updateHazards(t);
  interactions();
  updateChase(dt, t);
  updateCamera(dt);
  checkComplete();
  animateWorld(t);
  updateFires(dt);
  updateDust(dt, t);
  updateGems(t);
  updateAura(S.fire.aura, S.fire.g.position.x, S.fire.g.position.z, dt);
  updateAura(S.water.aura, S.water.g.position.x, S.water.g.position.z, dt);

  for (const t2 of torches) if (t2.flame) t2.flame.material.opacity = 0.7 + Math.sin(t * 20 + t2.x) * 0.3;

  for (const p of [S.fire, S.water]) {
    p.mat.emissiveIntensity = 0.75 + Math.sin(t * 8 + p.phase) * 0.2;
    p.head.position.y = 1.85 + Math.sin(t * 3 + p.phase) * 0.03;
    const blink = p.invuln > 0 ? (Math.sin(Date.now() * 0.03) > 0 ? 0.4 : 1) : 1;
    p.mat.opacity = blink; p.mat.transparent = true;
    p.standee.material.opacity = blink;
  }

  document.querySelector('#hpFire .fill').style.width = S.fire.health + '%';
  document.querySelector('#hpWater .fill').style.width = S.water.health + '%';
  el('objective').textContent = S.curHint();

  const secs = Math.max(0, t - (S.levelStart || 0));
  el('timeNow').textContent = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
}

/**
 * Uyarlanabilir kalite: kare hizi dususe kalite kademe kademe indirilir.
 * Yalnizca asagi yonlu — surekli acilip kapanip titremesin diye geri yukseltilmez.
 * Kademeler: 1) parlama (bloom) kapanir  2) piksel orani 1'e iner
 *            3) golgeler kapanir
 */
let qStep = 0, fpsAcc = 0, fpsFrames = 0, qCooldown = 3;
function adaptQuality(dt) {
  if (qStep >= 3) return;
  qCooldown -= dt;
  if (qCooldown > 0) return;                 // acilisin ilk saniyeleri olculmez
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc < 2) return;                    // 2 saniyelik pencere
  const fps = fpsFrames / fpsAcc;
  fpsAcc = 0; fpsFrames = 0;
  if (fps >= 45) return;
  qStep++;
  if (qStep === 1 && S.composer) { S.composer = null; }
  else if (qStep === 2) { S.renderer.setPixelRatio(1); }
  else if (qStep === 3) { S.renderer.shadowMap.enabled = false; S.scene.traverse((o) => { if (o.isMesh) o.castShadow = false; }); }
  console.info(`[kalite] FPS ${fps.toFixed(0)} — kademe ${qStep} uygulandi`);
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, S.clock.getDelta());
  if (S.started && !S.paused) adaptQuality(dt);
  frame(dt, S.clock.elapsedTime);
  renderFrame();
}

// ---------- sistem tuslari (P duraklat / R yeniden / M ses) ----------
addEventListener('keydown', (e) => {
  if (!S.started || S.won) return;
  if (isCutsceneOpen()) return;          // ara sahne acikken sistem tuslari calismasin
  if (e.code === 'Escape' || e.code === 'KeyP') {
    S.paused = !S.paused;
    if (S.paused) {
      el('pauseLevel').textContent = LEVEL_NAMES[S.curLevel] || '';
      // ayar kutulari o anki durumu gostersin
      const mode = S.view === 'pip' ? 'pip' : S.splitMode;
      const radio = document.querySelector(`input[name="pauseView"][value="${mode}"]`);
      if (radio) radio.checked = true;
      el('pauseSound').checked = !S.muted;
    }
    el('pauseScreen').classList.toggle('hidden', !S.paused);
  }
  if (e.code === 'KeyR') {
    S.paused = false;
    el('pauseScreen').classList.add('hidden');
    loadLevel(S.curLevel);
  }
  if (e.code === 'KeyM') {
    setMute(!S.muted);
    el('gems').style.opacity = S.muted ? 0.5 : 1;
  }
});

// ---------- kurulum ----------
export function init() {
  S.scene = new THREE.Scene();
  S.scene.background = new THREE.Color(0x05060a);
  S.scene.fog = new THREE.Fog(0x05060a, 24, 60);

  S.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 300);
  S.camFire = new THREE.PerspectiveCamera(62, (innerWidth / 2) / innerHeight, 0.1, 300);
  S.camWater = new THREE.PerspectiveCamera(62, (innerWidth / 2) / innerHeight, 0.1, 300);

  // ?capture — ekran goruntusu alabilmek icin cizim tamponunu korur (normalde kapali)
  S.renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: location.search.includes('capture'),
  });
  // r128'de varsayilan cikis LinearEncoding idi; r152+ sRGB'ye cevirerek sahneyi
  // soluklastiriyor. Ayarlanmis koyu atmosferi korumak icin eski davranisa donuyoruz.
  S.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  S.renderer.setSize(innerWidth, innerHeight);
  S.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  S.renderer.shadowMap.enabled = true;
  S.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('app').appendChild(S.renderer.domElement);
  S.clock = new THREE.Clock();

  buildTextures();

  S.hemi = new THREE.HemisphereLight(0x8899cc, 0x0a0a14, 0.5);
  S.scene.add(S.hemi);
  S.dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
  S.dirLight.position.set(8, 20, 6);
  S.dirLight.castShadow = true;
  S.dirLight.shadow.mapSize.set(1024, 1024);
  Object.assign(S.dirLight.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28 });
  S.scene.add(S.dirLight);

  // Kalici zemin. Dis sinir duvarlari YOK — her bolum kendi ceperini kurar.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 220),
    new THREE.MeshLambertMaterial({ map: TEX.stone }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, 40);
  ground.receiveShadow = true;
  S.scene.add(ground);

  S.fire = makePlayer(0xff5a10, '#ff9d3f', 0xff3a00, 'fire');
  S.water = makePlayer(0x2aa8ff, '#5fd8ff', 0x0a5aff, 'water');
  makeDust();

  // ?nobloom ile kapatilabilir (zayif donanim icin)
  if (!location.search.includes('nobloom')) {
    try {
      S.composer = new EffectComposer(S.renderer);
      S.composer.addPass(new RenderPass(S.scene, S.camera));
      // Parlama yari cozunurlukte hesaplanir: zaten bulanik bir efekt oldugu icin
      // gorsel fark yok, dolgu maliyeti dortte bire iner.
      S.composer.addPass(new UnrealBloomPass(
        new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.75, 0.5, 0.28));
    } catch { S.composer = null; }
  }

  // fare ile kamera yorungesi
  S.renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('pointermove', (e) => {
    if (!dragging) return;
    S.camYaw += (e.clientX - lastX) * 0.006;
    S.camPitch = Math.max(0.28, Math.min(1.2, S.camPitch + (e.clientY - lastY) * 0.004));
    lastX = e.clientX; lastY = e.clientY;
  });
  addEventListener('wheel', (e) => {
    S.camDistBase = Math.max(9, Math.min(26, S.camDistBase + e.deltaY * 0.01));
  }, { passive: true });
  addEventListener('resize', () => {
    S.camera.aspect = innerWidth / innerHeight;
    S.camera.updateProjectionMatrix();
    S.renderer.setSize(innerWidth, innerHeight);
    S.composer?.setSize(innerWidth, innerHeight);
  });

  tick();
}
