import './style.css';
import { S, solids, zones, gems, plates, torches } from './state.js';
import { resumeAudio } from './audio.js';
import { bindFire, bindWater, buildCtrls, buildTouch, showTouch, assignPads, keys } from './input.js';
import { applyMode, loadFace, loadModel } from './entities.js';
import { init, frame, renderFrame, loadLevel } from './game.js';
import { showCutscene, INTRO_SCENE } from './story.js';
import { buildLevelMenu, showLevelMenu, hideLevelMenu } from './menu.js';
import { LEVEL_NAMES } from './levels.js';

const el = (id) => document.getElementById(id);

// --- baslangic ekrani: tus atama + dokunmatik kontroller ---
buildCtrls('ctrlFire', bindFire);
buildCtrls('ctrlWater', bindWater);
buildTouch();

// --- fotograf ve .glb model yukleme ---
el('fileFire').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  loadFace(S.fire, f);
  el('thumbFire').style.backgroundImage = `url(${URL.createObjectURL(f)})`;
});
el('fileWater').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  loadFace(S.water, f);
  el('thumbWater').style.backgroundImage = `url(${URL.createObjectURL(f)})`;
});
el('modelFire').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) loadModel(S.fire, f);
});
el('modelWater').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) loadModel(S.water, f);
});

// --- oyunu baslat ---
/** Ayarlar yalnizca ilk baslangicta uygulanir; menuden bolum secilince tekrarlanmaz. */
function applySettingsOnce() {
  if (S.started) return;
  S.useStandee = el('fotoFigur').checked;
  applyMode(S.fire);
  applyMode(S.water);

  // Isaretliyse ekran hep bolunur; degilse oyuncular uzaklasinca otomatik bolunur.
  S.splitMode = el('splitMode').checked ? 'always' : 'auto';

  assignPads();
  showTouch();
}

function enterGameUI() {
  el('startScreen').classList.add('hidden');
  el('hud').classList.remove('hidden');
  el('topbar').classList.remove('hidden');
  el('gems').classList.remove('hidden');
  el('timer').classList.remove('hidden');
  resumeAudio();               // ses ancak kullanici etkilesiminden sonra baslatilabilir
}

/** Menuden secilen bolume dogrudan atlar (acilis sahnesi gosterilmez). */
function startAtLevel(i) {
  applySettingsOnce();
  enterGameUI();
  S.started = true;
  loadLevel(i);
}

el('startBtn').addEventListener('click', () => {
  applySettingsOnce();
  enterGameUI();
  S.started = true;
  // Acilis sahnesi oynasin; hemen ardindan gelen bolum girisi iki kez
  // ust uste binmesin diye ilk bolumun girisi atlanir.
  showCutscene({
    ...INTRO_SCENE,
    onOpen: () => { S.paused = true; },
    onClose: () => { S.paused = false; loadLevel(0, { skipIntro: true }); },
  });
});

// --- bolum secme menusu ---
buildLevelMenu({
  levels: LEVEL_NAMES.map((name) => ({ name, gems: 3 })),
  onSelect: (i) => { hideLevelMenu(); startAtLevel(i); },
  onClose: () => hideLevelMenu(),
});
el('levelsBtn').addEventListener('click', showLevelMenu);

// --- duraklama ekrani dugmeleri ---
function resume() {
  S.paused = false;
  el('pauseScreen').classList.add('hidden');
}
el('resumeBtn').addEventListener('click', resume);
el('restartBtn').addEventListener('click', () => { resume(); loadLevel(S.curLevel, { skipIntro: true }); });
el('pauseLevelsBtn').addEventListener('click', () => { resume(); showLevelMenu(); });

el('againBtn').addEventListener('click', () => location.reload());

init();

/**
 * Hata ayiklama / otomatik test kancasi.
 * `drive(n)` sekme arka plandayken requestAnimationFrame durdugu icin
 * kareleri elle ilerletmeye yarar.
 */
window.__g = {
  get S() { return S; },
  get fire() { return S.fire; },
  get water() { return S.water; },
  get camera() { return S.camera; },
  get scene() { return S.scene; },
  get started() { return S.started; },
  get level() { return S.curLevel; },
  get solids() { return solids; },
  get zones() { return zones; },
  get gems() { return gems; },
  get plates() { return plates; },
  get torches() { return torches; },
  get binds() { return { fire: { ...bindFire }, water: { ...bindWater } }; },
  get valveActive() { return S.valve && S.valve.active; },
  get keys() { return { ...keys }; },
  loadLevel,
  setYaw(v) { S.camYaw = v; },
  frame,
  render: renderFrame,
  drive(n) { for (let i = 0; i < n; i++) frame(0.016, i * 0.016); renderFrame(); },
};
