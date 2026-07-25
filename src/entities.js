import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { S, levelMeshes, mixers } from './state.js';
import { faceTex, silhouetteTex, sparkTex } from './textures.js';

/**
 * Karakter aurasi: Alev icin yukselen kozler, Damla icin dusen su damlalari.
 * Her parcacigin omru bitince tabandan yeniden dogar.
 */
export function makeAura(color, kind) {
  const N = 26;
  const pos = new Float32Array(N * 3);
  const data = [];
  for (let i = 0; i < N; i++) data.push({ life: Math.random() });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: kind === 'fire' ? 0.4 : 0.28, map: sparkTex(), color, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
  });
  const pts = new THREE.Points(geo, mat);
  S.scene.add(pts);
  return { pts, geo, data, kind };
}

export function updateAura(a, cx, cz, dt) {
  const pos = a.geo.attributes.position.array;
  a.data.forEach((p, i) => {
    p.life -= dt * 1.2;
    if (p.life <= 0) {
      p.life = 1;
      p.x = cx + (Math.random() - 0.5) * 0.6;
      p.z = cz + (Math.random() - 0.5) * 0.6;
      p.y = a.kind === 'fire' ? 0.4 : 1.6;
      p.vy = a.kind === 'fire' ? 1.6 + Math.random() : -1.8 - Math.random();
      p.vx = (Math.random() - 0.5) * 0.5;
      p.vz = (Math.random() - 0.5) * 0.5;
    }
    p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
  });
  a.geo.attributes.position.needsUpdate = true;
}

/**
 * Oyuncu: kutu/kure parcalardan insansi figur + kameraya donuk yuz sprite'i
 * + (foto figur modu icin) tam govde sprite'i. Kendi .glb modeli yuklenirse
 * ikisi de gizlenir.
 */
export function makePlayer(color, faceColor, emissive, kind) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: emissive || color, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.1,
  });
  const human = new THREE.Group();
  g.add(human);

  const part = (w, h, d, y, x = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, 0);
    m.castShadow = true;
    human.add(m);
    return m;
  };
  part(0.62, 0.85, 0.4, 1.15);                                   // govde
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), mat);
  head.position.y = 1.85; head.castShadow = true; human.add(head);
  const lA = part(0.18, 0.7, 0.18, 1.15, -0.46);
  const rA = part(0.18, 0.7, 0.18, 1.15, 0.46);
  const lL = part(0.22, 0.8, 0.22, 0.4, -0.16);
  const rL = part(0.22, 0.8, 0.22, 0.4, 0.16);

  // yuz: her acidan kameraya doner, derinlik testi kapali (kafa ardinda kaybolmasin)
  const face = new THREE.Sprite(new THREE.SpriteMaterial({
    map: faceTex(faceColor), transparent: true, depthTest: false, depthWrite: false,
  }));
  face.scale.set(0.6, 0.6, 1);
  face.position.set(0, 1.86, 0);
  face.renderOrder = 10;
  human.add(face);

  const standee = new THREE.Sprite(new THREE.SpriteMaterial({
    map: silhouetteTex(faceColor), transparent: true,
  }));
  standee.scale.set(1.5, 2.6, 1);
  standee.position.set(0, 1.3, 0);
  standee.visible = false;
  g.add(standee);

  g.add(new THREE.PointLight(color, 1.4, 9)).position.y = 1.2;
  S.scene.add(g);

  return {
    g, mat, human, standee, face, head, model: null,
    arms: [lA, rA], legs: [lL, rL], color, aura: makeAura(color, kind),
    vel: new THREE.Vector3(), health: 100, grounded: true,
    spawn: new THREE.Vector3(), invuln: 0, phase: Math.random() * 6,
    _support: 0, footClock: 0,
  };
}

/** Secilen goruntuleme moduna gore figur / standee / .glb modelden birini gosterir. */
export function applyMode(p) {
  if (p.model) { p.model.visible = true; p.human.visible = false; p.standee.visible = false; return; }
  p.human.visible = !S.useStandee;
  p.standee.visible = S.useStandee;
}

/** Yuklenen fotografi hem yuze hem tam govde figurune uygular. */
export function loadFace(p, file) {
  const url = URL.createObjectURL(file);
  new THREE.TextureLoader().load(url, (tex) => {
    p.face.material.map = tex;
    p.face.material.needsUpdate = true;
    p.face.scale.set(0.85, 0.95, 1);
    p.standee.material.map = tex;
    p.standee.material.needsUpdate = true;
    const im = tex.image;
    const asp = im && im.width ? im.height / im.width : 1.6;
    p.standee.scale.set(1.6, 1.6 * asp, 1);
  });
}

/** Kullanicinin kendi tasarladigi .glb modelini yukler (2 birim boya olceklenir). */
export function loadModel(p, file) {
  const url = URL.createObjectURL(file);
  new GLTFLoader().load(url, (gltf) => {
    const m = gltf.scene;
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(m).getSize(size);
    m.scale.setScalar(2.0 / (size.y || 1));

    const b2 = new THREE.Box3().setFromObject(m);
    const c = new THREE.Vector3();
    b2.getCenter(c);
    m.position.set(-c.x, -b2.min.y, -c.z);      // ayaklari yere otur
    m.traverse((o) => { if (o.isMesh) o.castShadow = true; });

    p.model = m;
    p.g.add(m);
    applyMode(p);

    if (gltf.animations?.length) {
      const mx = new THREE.AnimationMixer(m);
      mx.clipAction(gltf.animations[0]).play();
      mixers.push(mx);
    }
  }, undefined, (err) => console.warn('model yüklenemedi', err));
}

/** Kulge: kapusonlu golge yaratik (pelerin + kapusun + kirmizi gozler + duman). */
export function makeKulge(x, z) {
  const rig = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({
    color: 0x070709, emissive: 0x160020, emissiveIntensity: 0.6, roughness: 1,
  });

  const robe = new THREE.Mesh(new THREE.ConeGeometry(1.05, 3.3, 14), dark);
  robe.position.y = 1.55; rig.add(robe);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.15, 14), dark);
  hood.position.y = 3.1; rig.add(hood);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0, emissive: 0x120018, roughness: 1 }));
  head.position.set(0, 3.0, 0.06); rig.add(head);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1030 });
  const eL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), eyeMat);
  eL.position.set(-0.12, 3.05, 0.3);
  const eR = eL.clone(); eR.position.x = 0.12;
  rig.add(eL, eR);

  const glow = new THREE.PointLight(0xff0033, 0.9, 6.5);
  glow.position.set(0, 3.05, 0.3);
  rig.add(glow);

  const arm = (side) => {
    const a = new THREE.Group();
    a.position.set(side * 0.6, 2.6, 0.1);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 1.4, 8), dark);
    l.position.y = -0.6;
    a.add(l); rig.add(a);
    a.rotation.x = -0.35;
    return a;
  };
  const arms = [arm(-1), arm(1)];

  const wisps = [];
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x120018, transparent: true, opacity: 0.3 }));
    const ang = (i / 3) * Math.PI * 2;
    w.position.set(Math.cos(ang) * 0.7, 0.4, Math.sin(ang) * 0.7);
    w.scale.y = 1.5;
    rig.add(w); wisps.push(w);
  }

  rig.position.set(x, 0, z);
  S.scene.add(rig);
  levelMeshes.push(rig);
  S.kulge = { g: rig, arms, wisps, glow };
}
