import './style.css';
import { S, solids, zones, gems, plates, torches, hazards } from './state.js';
import { resumeAudio, setMute } from './audio.js';
import { bindFire, bindWater, buildCtrls, buildTouch, showTouch, assignPads, keys } from './input.js';
import { applyMode, loadFace, loadModel } from './entities.js';
import { init, frame, renderFrame, loadLevel } from './game.js';
import { showCutscene, INTRO_SCENE } from './story.js';
import { buildLevelMenu, showLevelMenu, hideLevelMenu } from './menu.js';
import { LEVEL_NAMES } from './levels.js';
import { net, hostRoom, joinRoom, isGuest } from './net.js';

const el = (id) => document.getElementById(id);

// --- baslangic ekrani: tus atama + dokunmatik kontroller ---
buildCtrls('ctrlFire', bindFire);
buildCtrls('ctrlWater', bindWater);

// --- menu sayfalari ---
// Her secenek kendi sayfasinda; ayni anda yalnizca biri gorunur.
function showPage(name) {
  document.querySelectorAll('#startScreen .page').forEach((p) => {
    p.classList.toggle('hidden', p.dataset.page !== name);
  });
  document.getElementById('startScreen').scrollTop = 0;
}
document.querySelectorAll('#startScreen [data-go]').forEach((b) => {
  b.addEventListener('click', () => showPage(b.dataset.go));
});

/**
 * Telefonda tek cihazda iki kisilik oyun KAPALI: iki oyuncunun dokunmatik
 * kontrolleri kucuk ekrana sigmiyor. Bu cihazlarda yalnizca cevrim ici
 * (oda kodu) oynanis sunulur.
 */
const isPhone = matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 820;
if (isPhone) {
  el('soloWrap').classList.add('hidden');
  el('soloBlocked').classList.remove('hidden');
}

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
/**
 * Ayarlar yalnizca ilk baslangicta uygulanir; menuden bolum secilince tekrarlanmaz.
 * @param {'fire'|'water'|'both'} touchMode hangi karakterin dokunmatik tuslari
 *   gosterilecek. Cevrim ici oynanista her cihaz SADECE kendi karakterinin
 *   tuslarini gorur.
 */
function applySettingsOnce(touchMode = 'both') {
  if (S.started) return;
  S.useStandee = el('fotoFigur').checked;
  applyMode(S.fire);
  applyMode(S.water);

  const mode = document.querySelector('input[name="viewMode"]:checked')?.value || 'auto';
  S.view = mode === 'pip' ? 'pip' : 'shared';
  S.splitMode = mode === 'always' ? 'always' : 'auto';

  assignPads();
  showTouch(touchMode);
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
// Ayarlar oyun sirasinda degistirilebilir; degisiklik aninda uygulanir.
document.querySelectorAll('input[name="pauseView"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    S.view = radio.value === 'pip' ? 'pip' : 'shared';
    S.splitMode = radio.value === 'always' ? 'always' : 'auto';
  });
});
el('pauseSound').addEventListener('change', (e) => {
  setMute(!e.target.checked);
  el('gems').style.opacity = S.muted ? 0.5 : 1;
});

el('resumeBtn').addEventListener('click', resume);
el('restartBtn').addEventListener('click', () => { resume(); loadLevel(S.curLevel, { skipIntro: true }); });
el('pauseLevelsBtn').addEventListener('click', () => { resume(); showLevelMenu(); });

el('againBtn').addEventListener('click', () => location.reload());

// --- cevrim ici oynanis (iki ayri cihaz) ---
const netStatus = (msg) => { el('netStatus').innerHTML = msg; };

net.onStatus = (s) => {
  if (s === 'bekleniyor') {
    netStatus(`Oda kodun: <b style="font-size:22px;color:#ff9d3f;letter-spacing:4px">${net.roomCode}</b><br>
               Eşin bu kodu girip katılınca oyun kendiliğinden başlayacak.`);
  } else if (s === 'baglaniyor') {
    netStatus('Bağlanıyor…');
  } else if (s === 'bagli') {
    netStatus('✅ Bağlandı! Oyun başlıyor…');
    el('soloWrap').classList.add('hidden');
    startOnline();
  } else if (s === 'hata') {
    netStatus(`⚠ Bağlantı hatası: ${net.error}<br>
               <span style="color:#7d8290">WebRTC yalnızca HTTPS veya localhost üzerinde çalışır.</span>`);
  } else if (s === 'kapandi') {
    netStatus('Bağlantı koptu. Sayfayı yenileyip tekrar deneyin.');
  }
};

// Host bolum degistirdiginde guest de ayni bolumu kursun.
net.onLevel = (i) => { if (S.started && i !== S.curLevel) loadLevel(i, { skipIntro: true }); };

function startOnline() {
  if (S.started) return;
  // Bu cihaz hangi karakteri oynuyorsa yalnizca onun tuslari cizilir.
  applySettingsOnce(isGuest() ? 'water' : 'fire');
  S.view = 'pip';                 // ana ekran kendi karakterin, kosede esin
  enterGameUI();
  el('pipFrame').querySelector('span').textContent = isGuest() ? '🔥 EŞİM' : '💧 EŞİM';
  S.started = true;
  loadLevel(0, { skipIntro: true });
}

el('hostBtn').addEventListener('click', () => { hostRoom(); });
el('joinBtn').addEventListener('click', () => {
  const code = el('joinCode').value.trim().toUpperCase();
  if (code.length !== 4) { netStatus('⚠ Oda kodu 4 karakter olmalı.'); return; }
  joinRoom(code);
});

// Telefona kurulabilmesi ve internetsiz acilabilmesi icin servis iscisi.
// Yalnizca uretim derlemesinde kaydedilir; gelistirme sunucusunda HMR'i bozar.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('sw kaydedilemedi', e));
  });
}

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
  get hazards() { return hazards; },
  get net() { return net; },
  get binds() { return { fire: { ...bindFire }, water: { ...bindWater } }; },
  get valveActive() { return S.valve && S.valve.active; },
  get keys() { return { ...keys }; },
  loadLevel,
  setYaw(v) { S.camYaw = v; },
  frame,
  render: renderFrame,
  drive(n) { for (let i = 0; i < n; i++) frame(0.016, i * 0.016); renderFrame(); },
};
