import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { S, SHARED, chaseCP, resetLevelLists, solids, bounds, boundMeshes, zones,
         torches, plates, animated, levelMeshes, gems, movers, hazards, fires, mixers } from './state.js';
import { TEX, buildTextures } from './textures.js';
import { SFX, setMute, startHum, stopHum } from './audio.js';
import { inp } from './input.js';
import { makePlayer, updateAura } from './entities.js';
import { LEVELS } from './levels.js';

// r152+ varsayilan renk yonetimi sahnenin tonunu degistiriyordu;
// oyunun ayarlanmis gorunumunu korumak icin kapatiyoruz.
THREE.ColorManagement.enabled = false;

const up = new THREE.Vector3(0, 1, 0);
const ray = new THREE.Raycaster();
const _sz = new THREE.Vector2();

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
  S.gemsGot = 0; S.gemsTotal = 0;
  S.doorTorch = S.doorValve = S.gateDual = S.valve = S.kulge = null;
  S.kulgeActive = false;
  S.dirLight.intensity = 0.85;
  S.scene.background = new THREE.Color(0x05060a);
}

export function loadLevel(i) {
  S.curLevel = i;
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
  }

  el('levelName').textContent = cfg.name;
  banner(cfg.name);
  el('gemCount').textContent = S.gemsGot + '/' + S.gemsTotal;
}

function respawnTo(p, pos) {
  p.g.position.copy(pos);
  p.g.position.y = 0;
  p.vel.set(0, 0, 0);
  p.health = 100;
  p.invuln = 1;
}

function respawn(p) {
  const cp = (S.levelHasChase && anyBeyond(S.levelChaseZ)) ? chaseCP : p.spawn;
  p.g.position.copy(cp);
  p.g.position.x += (p === S.fire ? -1 : 1);
  p.g.position.y = 0;
  p.vel.set(0, 0, 0);
  p.health = 100;
  p.invuln = 1.2;
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

function hitPlayer(p, dmg) {
  if (p.invuln > 0) return;
  p.health -= dmg;
  p.invuln = 0.7;
  SFX.hurt();
  if (p.health <= 0) respawn(p);
}

function updateHazards(t) {
  for (const h of hazards) {
    if (h.type === 'saw') {
      h.disc.rotation.z -= 0.45;
      for (const p of [S.fire, S.water]) {
        const dx = p.g.position.x - h.x, dz = p.g.position.z - h.z;
        if (dx * dx + dz * dz < (h.r + 0.4) ** 2 && p.g.position.y < 1.5) hitPlayer(p, 34);
      }
    } else {                                   // sallanan balta
      const a = Math.sin(t * 1.5) * 1.05;
      h.g.rotation.z = a;
      const bx = h.x + Math.sin(a) * 3.5;
      for (const p of [S.fire, S.water]) {
        const dx = p.g.position.x - bx, dz = p.g.position.z - h.z;
        if (dx * dx + dz * dz < 0.95 && p.g.position.y < 1.3) hitPlayer(p, 34);
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
    if (S.curLevel < LEVELS.length - 1) {
      banner('Bölüm tamamlandı!');
      setTimeout(() => { loadLevel(S.curLevel + 1); S.transitioning = false; }, 1400);
    } else {
      S.won = true;
      stopHum();
      el('gemFinal').textContent = S.gemsAll;
      el('winScreen').classList.remove('hidden');
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

function updateCamera() {
  if (S.split) { followCam(S.camFire, S.fire); followCam(S.camWater, S.water); return; }
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
}

function animateWorld(time) {
  // Akis hissi: dokuyu kaydir. Materyaller paylasildigi icin bu tek islem
  // sahnedeki TUM lav/su yuzeylerini birden hareketlendirir.
  TEX.lava.offset.set(time * 0.014, time * 0.030);
  TEX.water.offset.set(Math.sin(time * 0.09) * 0.06, time * 0.045);

  for (const a of animated) {
    const pos = a.geo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const bx = a.base[i], by = a.base[i + 1];
      pos[i + 2] = Math.sin(bx * 1.5 + time * (a.type === 'lava' ? 1.5 : 2.5)) * 0.06
                 + Math.cos(by * 1.3 + time * 2) * 0.06;
    }
    a.geo.attributes.position.needsUpdate = true;
    if (a.type === 'lava') a.mesh.material.emissiveIntensity = 0.7 + Math.sin(time * 3) * 0.25;
  }
}

// ---------- render ----------
export function renderFrame() {
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
  updateHazards(t);
  interactions();
  updateChase(dt, t);
  updateCamera();
  checkComplete();
  animateWorld(t);
  updateFires(dt);
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
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, S.clock.getDelta());
  frame(dt, S.clock.elapsedTime);
  renderFrame();
}

// ---------- sistem tuslari (P duraklat / R yeniden / M ses) ----------
addEventListener('keydown', (e) => {
  if (!S.started || S.won) return;
  if (e.code === 'KeyP') {
    S.paused = !S.paused;
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
    new THREE.MeshStandardMaterial({ map: TEX.stone, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, 40);
  ground.receiveShadow = true;
  S.scene.add(ground);

  S.fire = makePlayer(0xff5a10, '#ff9d3f', 0xff3a00, 'fire');
  S.water = makePlayer(0x2aa8ff, '#5fd8ff', 0x0a5aff, 'water');

  // ?nobloom ile kapatilabilir (zayif donanim icin)
  if (!location.search.includes('nobloom')) {
    try {
      S.composer = new EffectComposer(S.renderer);
      S.composer.addPass(new RenderPass(S.scene, S.camera));
      S.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.5, 0.28));
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
