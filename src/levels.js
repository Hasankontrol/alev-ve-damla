import { S, torches } from './state.js';
import { keyLabel, bindFire, bindWater } from './input.js';
import { makeKulge } from './entities.js';
import {
  hWall, vWall, platform, door, pool, box4, corridor,
  makeTorch, makeWallTorch, makeValve, makePlate, makeGoal,
  makeGem, makeMover, makeSaw, makeAxe,
} from './world.js';

/**
 * Sekiz bolum. Her biri TAM KAPALI cepere sahiptir (dis sinir duvari yok),
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

function level6() { // Asili Basamaklar — dikey ziplama zinciri + hareketli platformlar
  // 1) Giris: havuzlar odayi bastan basa keser, kuru sizma yolu yok.
  //    Valf suyun ortasindadir: Damla girmek zorunda, Alev lavdan yurur.
  box4(-12, 12, -4, 12, { n: [-2, 2] });
  pool(-6, 3, 12, 10, 'lava'); pool(6, 3, 12, 10, 'water'); vWall(0, -2, 8);
  makeValve(8, 3);
  S.doorValve = door(0, 12, 4);
  corridor(-2, 2, 12, 16);

  // 2) Kule salonu — iki band, her bandda bir oyuncu platformlara mahkum
  box4(-14, 14, 16, 56, { s: [-2, 2] });

  pool(0, 24, 28, 8, 'water');                          // z 20..28 — Alev ziplayarak gecer
  platform(-7, 20.5, 3.4, 2.6, 0.9);
  platform(-2.5, 24, 3.4, 2.6, 1.2);
  platform(2, 27.5, 3.4, 2.6, 0.9);
  makeMover(7, 24, 3.2, 2.6, 1.0, 'x', 4.5, 0.85);      // elmasa giden yan yol
  makeSaw(10, 30); makeAxe(-4, 30);

  pool(0, 36, 28, 8, 'lava');                           // z 32..40 — Damla ziplayarak gecer
  platform(6, 32.5, 3.4, 2.6, 0.9);
  makeMover(1, 35.5, 3.4, 2.6, 1.2, 'x', 4, 0.8);       // beklemeyi ogreten koprü
  platform(-5, 39.5, 3.4, 3, 0.9);

  // 3) Plaka avlusu — testere/balta arasindan iki plakaya ayni anda basin
  makeSaw(-6, 44); makeSaw(6, 44); makeAxe(0, 47);
  makePlate(-9, 47); makePlate(9, 47);
  hWall(50, -14, -2); hWall(50, 2, 14);
  S.gateDual = door(0, 50, 4);

  makeWallTorch(-13.6, 22); makeWallTorch(13.6, 34); makeWallTorch(-13.6, 46);
  makeGem(-9, 3); makeGem(-2.5, 24, 1.2); makeGem(11, 24);
  S.goalFire = makeGoal(-3, 53, 0xff7a18);
  S.goalWater = makeGoal(3, 53, 0x2fd0ff);
  return {
    fire: [-6, -3], water: [6, -3], chase: false, name: 'Bölüm 6 · Asılı Basamaklar',
    atmos: { fog: 0x0b1420, near: 24, far: 62, hemi: 0x7799bb, dir: 0xdff0ff },
    hint: () => !S.valve.active
      ? `💧 Damla suya girip valfi açsın (${keyLabel(bindWater.interact)}). 🔥 Alev lav gölünü geçsin.`
      : (S.gateDual.solid
          ? '🔥 Alev su bandını, 💧 Damla lav bandını platformlarla aşsın — sonra iki plakaya aynı anda basın.'
          : 'Geçit açıldı — kuzeydeki pedlere ulaşın.'),
  };
}

function level7() { // Yanki Mahzeni — zincirleme kapilar, sirayla birbirini bekleme
  // Zincir: Alev mesaleleri yakar -> Damla'nin kapisi acilir -> Damla valfi acar
  //         -> Alev'in kapisi acilir -> ikisi kuzeyde plakalarda bulusur.

  // 1) Ortak giris — bati gecidi acik (Alev), dogu gecidi mesale kapisiyla kapali
  hWall(-4, -16, 16); vWall(-16, -4, 10); vWall(16, -4, 10);
  hWall(10, -16, -11); hWall(10, -7, 7); hWall(10, 11, 16);
  S.doorTorch = door(9, 10, 4);
  pool(-8, 2, 16, 8, 'lava'); pool(8, 2, 16, 8, 'water'); vWall(0, -2, 6);

  // 2) Bati mahzeni (yalniz Alev) — lav golu, uc mesale
  vWall(-16, 10, 34); vWall(16, 10, 34); vWall(0, 10, 34);
  pool(-8, 20, 16, 16, 'lava');
  makeTorch(-13, 16); makeTorch(-4, 22); makeTorch(-11, 26);
  makeSaw(-8, 14); makeSaw(-8, 26);
  hWall(34, -16, -6); hWall(34, -2, 0);
  S.doorValve = door(-4, 34, 4);                        // Damla valfi acmadan gecilmez

  // 3) Dogu kanali (yalniz Damla) — su golu, baltalar, valf
  pool(8, 20, 16, 16, 'water');
  makeAxe(8, 17); makeAxe(8, 25);
  makeValve(13, 26);
  hWall(34, 0, 2); hWall(34, 6, 16);                    // x 2..6 acik gecis

  // 4) Kuzey salonu — taraflar takas: plakalar karsi elementin icinde
  vWall(-16, 34, 56); vWall(16, 34, 56); hWall(56, -16, 16);
  pool(-12, 40, 8, 8, 'water'); makePlate(-12, 40);     // batidaki plaka Damla'nin
  pool(12, 40, 8, 8, 'lava'); makePlate(12, 40);        // dogudaki plaka Alev'in
  makeSaw(-6, 40); makeSaw(6, 40); makeAxe(0, 37);
  hWall(46, -16, -2); hWall(46, 2, 16);
  S.gateDual = door(0, 46, 4);

  makeWallTorch(-15.6, 20); makeWallTorch(15.6, 20); makeWallTorch(-15.6, 50);
  makeGem(-13, 20); makeGem(13, 20); makeGem(0, 42);
  S.goalFire = makeGoal(-3, 52, 0xff7a18);
  S.goalWater = makeGoal(3, 52, 0x2fd0ff);
  return {
    fire: [-8, -3], water: [8, -3], chase: false, name: 'Bölüm 7 · Yankı Mahzeni',
    atmos: { fog: 0x120c06, near: 22, far: 58, hemi: 0xbb9966, dir: 0xffe4bb },
    hint: () => {
      if (!torches.every((t) => t.lit)) {
        return `🔥 Alev batı mahzenindeki üç meşaleyi yaksın (${keyLabel(bindFire.interact)}) — 💧 Damla kapının açılmasını bekliyor.`;
      }
      if (!S.valve.active) {
        return `💧 Sıra Damla'da: doğu kanalını geçip valfi açsın (${keyLabel(bindWater.interact)}) — 🔥 Alev kilitli kaldı.`;
      }
      return S.gateDual.solid
        ? 'Kuzey salonunda yer değiştirin: 🔥 Alev lav plakasına, 💧 Damla su plakasına aynı anda bassın.'
        : 'Geçit açık — pedlerde buluşun.';
    },
  };
}

function level8() { // Kulge'nin Yukselisi — uzun kovalamaca, uc kapi mekanigi de baski altinda
  // 1) Sessiz prolog: Damla valfi acar, Alev lavdan gecer
  box4(-14, 14, -4, 14, { n: [-2, 2] });
  pool(-7, 4, 14, 12, 'lava'); pool(7, 4, 14, 12, 'water'); vWall(0, -2, 10);
  makeValve(10, 4);
  S.doorValve = door(0, 14, 4);
  corridor(-2, 2, 14, 18);

  // 2) Kacis salonu — Kulge girisin hemen otesinde uyuyor
  box4(-16, 16, 18, 104, { s: [-2, 2] });
  makeKulge(0, 19);

  // 2a) Ayrik bandlar (z 24..36): bolme ikisini kendi sivisina hapseder
  pool(-8, 30, 16, 12, 'lava'); pool(8, 30, 16, 12, 'water'); vWall(0, 24, 36);
  makeSaw(-6, 27); makeSaw(6, 33); makeAxe(-9, 33); makeAxe(9, 27);

  // 2b) Mesale kapisi (z 46): Alev kacarken iki mesaleyi yakmak zorunda
  makeTorch(-6, 41); makeTorch(6, 41); makeAxe(0, 43);
  hWall(46, -16, -2); hWall(46, 2, 16);
  S.doorTorch = door(0, 46, 4);

  // 2c) Plaka kapisi (z 62): plakalar guvenli elementin icinde, orta serit kuru
  makeSaw(0, 49);
  pool(-10, 55, 12, 8, 'lava'); makePlate(-10, 55);
  pool(10, 55, 12, 8, 'water'); makePlate(10, 55);
  hWall(62, -16, -2); hWall(62, 2, 16);
  S.gateDual = door(0, 62, 4);

  // 2d) Son kosu: once lav golu (Damla kopruden), sonra su golu (Alev kopruden)
  pool(0, 70, 32, 8, 'lava');
  platform(-9, 66.5, 3.6, 2.6, 0.9);
  platform(-9, 70, 3.6, 2.6, 1.1);
  platform(-9, 73.5, 3.6, 2.6, 0.9);
  pool(0, 82, 32, 8, 'water');
  platform(8, 78.5, 3.6, 2.6, 0.9);
  makeMover(8, 82, 3.6, 2.6, 1.1, 'x', 2.5, 1.0);
  platform(8, 85.5, 3.6, 2.6, 0.9);
  makeSaw(-4, 92); makeSaw(4, 90); makeAxe(0, 95);

  // 3) Cikis kapisi ve son oda
  hWall(98, -16, -3); hWall(98, 3, 16);

  makeWallTorch(-15.6, 30); makeWallTorch(15.6, 44);
  makeWallTorch(-15.6, 60); makeWallTorch(15.6, 90);
  makeGem(-10, 2); makeGem(13, 55); makeGem(-9, 70, 1.1);
  S.goalFire = makeGoal(-3, 101, 0xff7a18);
  S.goalWater = makeGoal(3, 101, 0x2fd0ff);
  return {
    fire: [-6, -3], water: [6, -3], chase: true, chaseZ: 26, exitZ: 96, cp: [0, 0, 38],
    name: 'Bölüm 8 · Külge’nin Yükselişi',
    atmos: { fog: 0x1a0206, near: 18, far: 50, hemi: 0x77333a, dir: 0xffb4b4 },
    hint: () => {
      if (!S.valve.active) {
        return `💧 Damla suyu geçip valfi açsın (${keyLabel(bindWater.interact)}). 🔥 Alev lavdan geçsin — ötede bir şey uyuyor.`;
      }
      if (!torches.every((t) => t.lit)) {
        return `KAÇIN! 🔥 Alev iki meşaleyi yakmadan kapı açılmaz (${keyLabel(bindFire.interact)}) — Külge yaklaşıyor!`;
      }
      return S.gateDual.solid
        ? 'Plakalara aynı anda basın — 🔥 Alev lavdakine, 💧 Damla sudakine!'
        : 'Son koşu! Lav gölünü Damla, su gölünü Alev köprüden geçsin — kuzey çıkışa!';
    },
  };
}

export const LEVELS = [level1, level2, level3, level4, level5, level6, level7, level8];

/**
 * Bolum adlari — bolum secme menusu icin. Ad, bolum fonksiyonu CALISTIRILMADAN
 * (yani sahne kurulmadan) okunamadigi icin burada ayrica listelenir.
 * LEVELS ile ayni sirada ve ayni uzunlukta olmalidir.
 */
export const LEVEL_NAMES = [
  'Bölüm 1 · Uyanış Odası',
  'Bölüm 2 · Buhar Fabrikası',
  'Bölüm 3 · Terk Edilmiş Kanal',
  'Bölüm 4 · Ayrılık Labirenti',
  'Bölüm 5 · Külge’den Kaçış',
  'Bölüm 6 · Asılı Basamaklar',
  'Bölüm 7 · Yankı Mahzeni',
  'Bölüm 8 · Külge’nin Yükselişi',
];
