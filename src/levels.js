import { S, torches } from './state.js';
import { keyLabel, bindFire, bindWater } from './input.js';
import { makeKulge } from './entities.js';
import {
  hWall, vWall, platform, door, pool, box4, corridor,
  makeTorch, makeWallTorch, makeValve, makePlate, makeGoal,
  makeGem, makeMover, makeSaw, makeAxe,
} from './world.js';

/**
 * Bes bolum. Her biri TAM KAPALI cepere sahiptir (dis sinir duvari yok),
 * boylece "labirent icinde labirent" gorunumu olusmaz.
 *
 * Donen nesne:
 *   fire/water : baslangic konumlari [x, z]
 *   chase      : Kulge kovalamacasi var mi
 *   chaseZ     : bu z degeri asilinca Kulge uyanir
 *   exitZ      : bu z asilinca kovalamaca biter
 *   cp         : kovalamaca sirasinda yeniden dogma noktasi
 *   atmos      : sis/isik tonu (bolume kimlik kazandirir)
 *   hint       : HUD'da gosterilen dinamik gorev metni
 */

function level1() { // Uyanis — element gecisi + mesale + ziplama
  box4(-9, 9, -4, 10, { n: [-2, 2] });
  pool(-5, 3, 7, 8, 'lava'); pool(5, 3, 7, 8, 'water'); vWall(0, -1, 7);
  makeTorch(-3, 8.5); makeTorch(3, 8.5);
  S.doorTorch = door(0, 10, 4);
  corridor(-2, 2, 10, 16);
  box4(-9, 9, 16, 32, { s: [-2, 2] });
  platform(-4, 21, 3, 2.4, 0.9); platform(0, 24, 3, 2.4, 1.3); platform(4, 27, 3, 2.4, 0.9);
  makeWallTorch(-8.6, 22); makeWallTorch(8.6, 26);
  makeGem(-5, 3); makeGem(0, 24, 1.3); makeGem(7, 30);
  S.goalFire = makeGoal(-3, 30, 0xff7a18);
  S.goalWater = makeGoal(3, 30, 0x2fd0ff);
  return {
    fire: [-3, -2], water: [3, -2], chase: false, name: 'Bölüm 1 · Uyanış Odası',
    atmos: { fog: 0x0a0e18, near: 26, far: 70, hemi: 0x8899cc, dir: 0xffffff },
    hint: () => !torches.every((t) => t.lit)
      ? `🔥 Alev lavdan geçip iki meşaleyi yaksın (${keyLabel(bindFire.interact)}). 💧 Damla sudan geçsin — yanlış sıvı ölümcül!`
      : 'Platformlardan zıplayıp pedlere ulaşın.',
  };
}

function level2() { // Buhar Fabrikasi — valf + testere + platform kopru + plaka
  box4(-10, 10, -4, 12, { n: [-2, 2] });
  pool(-6, 4, 7, 9, 'lava'); pool(6, 4, 7, 9, 'water'); vWall(0, -1, 8.5);
  makeValve(6, 10);
  S.doorValve = door(0, 12, 4);
  corridor(-2, 2, 12, 18);
  box4(-11, 11, 18, 36, { s: [-2, 2], n: [-2, 2] });
  pool(0, 26, 9, 8, 'lava');
  platform(-3, 23, 2.4, 2.4, 0.9); platform(0, 26, 2.4, 2.4, 0.9); platform(3, 29, 2.4, 2.4, 0.9);
  makeSaw(-5, 21); makeSaw(5, 31);
  makeWallTorch(-10.6, 26); makeWallTorch(10.6, 26);
  corridor(-2, 2, 36, 42);
  box4(-9, 9, 42, 56, { s: [-2, 2] });
  makePlate(-4, 47); makePlate(4, 47);
  hWall(51, -9, -2); hWall(51, 2, 9);
  S.gateDual = door(0, 51, 4);
  makeGem(-6, 4); makeGem(0, 26, 0.9); makeGem(7, 47);
  S.goalFire = makeGoal(-3, 54, 0xff7a18);
  S.goalWater = makeGoal(3, 54, 0x2fd0ff);
  return {
    fire: [-3, -2], water: [3, -2], chase: false, name: 'Bölüm 2 · Buhar Fabrikası',
    atmos: { fog: 0x140e08, near: 24, far: 64, hemi: 0xccaa88, dir: 0xffe8cc },
    hint: () => !S.valve.active
      ? `💧 Damla valfi açsın (${keyLabel(bindWater.interact)}). 🔥 Alev lavdan geçer.`
      : (S.gateDual.solid
          ? 'Testereden kaçın — Damla platformlarla lavı geçsin, ikiniz de plakalara basın.'
          : 'Kuzeydeki çıkışa ulaşın.'),
  };
}

function level3() { // Terk Edilmis Kanal — ayri element koridorlari + tehlikeler
  box4(-12, 12, -4, 44, { n: [-2, 2] });
  vWall(0, -2, 40);                                     // iki kanali ayiran bolme
  pool(-6, 16, 11, 34, 'lava'); makeSaw(-6, 12); makeSaw(-5, 24); makeSaw(-7, 34);
  pool(6, 16, 11, 34, 'water'); makeAxe(6, 14); makeAxe(6, 30);
  makeWallTorch(-11.6, 10); makeWallTorch(-11.6, 32); makeWallTorch(11.6, 22);
  makeGem(-6, 8); makeGem(6, 20); makeGem(-6, 38);
  S.goalFire = makeGoal(-4, 42, 0xff7a18);
  S.goalWater = makeGoal(4, 42, 0x2fd0ff);
  return {
    fire: [-4, -2], water: [4, -2], chase: false, name: 'Bölüm 3 · Terk Edilmiş Kanal',
    atmos: { fog: 0x08120e, near: 22, far: 58, hemi: 0x557766, dir: 0xbfeedd },
    hint: () => 'Ayrı kanallardan ilerleyin — Alev solda lavda, Damla sağda suda. Testere/baltadan sakının!',
  };
}

function level4() { // Ayrilik Labirenti — iki muhurlu yari, kuzeyde bulusma
  vWall(0, -4, 26);                                     // sol/sag yariyi ayiran tam bolme
  hWall(-4, -13, 13); vWall(-13, -4, 38); vWall(13, -4, 38); hWall(38, -13, 13);
  // kuzey duvari iki kapi boslugu ile: sol (x -9..-4), sag (x 4..9)
  hWall(26, -13, -9); hWall(26, -4, 0); hWall(26, 0, 4); hWall(26, 9, 13);
  S.doorTorch = door(-6.5, 26, 5);
  S.doorValve = door(6.5, 26, 5);
  // SOL yari (Alev): lav + testere + iki mesale
  pool(-7, 6, 11, 9, 'lava'); makeSaw(-4, 3);
  makeTorch(-11, 18); makeTorch(-4, 18);
  // SAG yari (Damla): su + balta + valf
  pool(7, 6, 11, 9, 'water'); makeAxe(7, 10); makeValve(11, 18);
  makeWallTorch(-12.6, 20); makeWallTorch(12.6, 20);
  makeGem(-7, 6); makeGem(7, 6); makeGem(0, 32);
  S.goalFire = makeGoal(-3, 34, 0xff7a18);
  S.goalWater = makeGoal(3, 34, 0x2fd0ff);
  return {
    fire: [-4, -2], water: [4, -2], chase: false, name: 'Bölüm 4 · Ayrılık Labirenti',
    atmos: { fog: 0x0c0a16, near: 22, far: 58, hemi: 0x6a6a99, dir: 0xd8d0ff },
    hint: () => 'Ayrıldınız! 🔥 Alev meşaleleri yaksın, 💧 Damla valfi açsın — herkes kendi kapısından geçip kuzeyde buluşsun.',
  };
}

function level5() { // Kulge'den Kacis — bulmaca + uzun kovalamaca finali
  box4(-12, 12, -4, 10, { n: [-2, 2] });
  pool(-5, 3, 7, 7, 'lava'); pool(5, 3, 7, 7, 'water'); vWall(0, -1, 7);
  makeTorch(-3, 8); makeTorch(3, 8);
  S.doorTorch = door(0, 10, 4);
  corridor(-2, 2, 10, 14);
  box4(-12, 12, 14, 56, { s: [-2, 2] });
  pool(-6, 26, 9, 12, 'lava'); pool(7, 36, 9, 12, 'water');
  platform(0, 20, 3, 3, 0.9); platform(4, 24, 3, 3, 1.3); platform(-4, 30, 3, 3, 0.9);
  makeAxe(0, 42); makeSaw(-6, 47); makeSaw(6, 50);
  makeMover(0, 33, 3, 2, 0.8, 'x', 5, 1.0);
  makeKulge(0, 16);
  makeWallTorch(-11.6, 30); makeWallTorch(11.6, 44);
  makeGem(0, 20, 0.9); makeGem(8, 40); makeGem(-8, 50);
  S.goalFire = makeGoal(-3, 54, 0xff7a18);
  S.goalWater = makeGoal(3, 54, 0x2fd0ff);
  return {
    fire: [-3, -2], water: [3, -2], chase: true, chaseZ: 16, exitZ: 52, cp: [0, 0, 16],
    name: 'Bölüm 5 · Külge’den Kaçış',
    atmos: { fog: 0x140306, near: 20, far: 56, hemi: 0x66445a, dir: 0xffd0d0 },
    hint: () => 'Kapıyı açın, sonra KAÇIN! Külge peşinizde — engellerden geçip kuzey çıkışa koşun.',
  };
}

export const LEVELS = [level1, level2, level3, level4, level5];
