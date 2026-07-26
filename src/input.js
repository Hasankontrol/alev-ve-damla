/**
 * Birlesik girdi katmani: klavye + oyun kumandasi + dokunmatik.
 * Oyun mantigi sadece `inp(who, action)` cagirir; kaynagin hangisi oldugu onemsiz.
 *
 * Bu modul oyun durumuna bagimli DEGILDIR (P/R/M gibi sistem tuslari game.js'te).
 */

/** Oyuncularin baslangic ekranindan degistirebildigi tus atamalari. */
export const bindFire  = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', interact: 'KeyE' };
export const bindWater = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', jump: 'ShiftRight', interact: 'ControlRight' };

export const keys = {};
export const touchIn = { fire: {}, water: {} };

let activeBinds = new Set();
function refreshBinds() {
  activeBinds = new Set([...Object.values(bindFire), ...Object.values(bindWater)]);
}
refreshBinds();

const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  // atanmis tuslar ve ok/bosluk sayfayi kaydirmasin
  if (activeBinds.has(e.code) || SCROLL_KEYS.includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

// --- oyun kumandasi ---
const pads = { fire: null, water: null };

/** Bagli kumandalari oyunculara sirayla dagitir (1. kumanda Alev, 2. Damla). */
export function assignPads() {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  const ids = [];
  for (let i = 0; i < gps.length; i++) if (gps[i]) ids.push(i);
  pads.fire = ids.length > 0 ? ids[0] : null;
  pads.water = ids.length > 1 ? ids[1] : null;
}
addEventListener('gamepadconnected', assignPads);
addEventListener('gamepaddisconnected', assignPads);

function padAct(idx, action) {
  if (idx == null) return false;
  const gp = (navigator.getGamepads ? navigator.getGamepads() : [])[idx];
  if (!gp) return false;
  const ax = gp.axes || [], b = gp.buttons || [], DZ = 0.45;
  const pr = (i) => b[i] && b[i].pressed;
  switch (action) {
    case 'up':       return ax[1] < -DZ || pr(12);
    case 'down':     return ax[1] > DZ  || pr(13);
    case 'left':     return ax[0] < -DZ || pr(14);
    case 'right':    return ax[0] > DZ  || pr(15);
    case 'jump':     return pr(0) || pr(3);
    case 'interact': return pr(2) || pr(1);
    default:         return false;
  }
}

/** who: 'fire' | 'water' — action: up/down/left/right/jump/interact */
export function inp(who, action) {
  const bind = who === 'fire' ? bindFire : bindWater;
  return !!keys[bind[action]] || !!touchIn[who][action] || padAct(pads[who], action);
}

// --- tus atama arayuzu (baslangic ekrani) ---
const ACTIONS = [
  ['up', 'İleri'], ['down', 'Geri'], ['left', 'Sol'],
  ['right', 'Sağ'], ['jump', 'Zıpla'], ['interact', 'Etkileşim'],
];

/** KeyboardEvent.code degerini okunabilir Turkce etikete cevirir. */
export function keyLabel(code) {
  const m = {
    Space: 'Boşluk', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    ControlLeft: 'Sol Ctrl', ControlRight: 'Sağ Ctrl', ShiftLeft: 'Sol Shift', ShiftRight: 'Sağ Shift',
    AltLeft: 'Sol Alt', AltRight: 'Sağ Alt', Enter: 'Enter', Tab: 'Tab', Backquote: '`',
    Slash: '/', Backslash: '\\', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", Minus: '-', Equal: '=',
  };
  if (m[code]) return m[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  return code;
}

let listening = null;

/** Ayni oyuncuda ayni tusa iki eylem atanmissa kirmizi cerceve ile isaretler. */
function markDups() {
  document.querySelectorAll('.kbtn').forEach((b) => b.classList.remove('dup'));
  ['ctrlFire', 'ctrlWater'].forEach((id) => {
    const seen = {};
    document.querySelectorAll('#' + id + ' .kbtn').forEach((b) => {
      if (seen[b._code]) { b.classList.add('dup'); seen[b._code].classList.add('dup'); }
      else seen[b._code] = b;
    });
  });
}

export function buildCtrls(id, bind) {
  const c = document.getElementById(id);
  c.innerHTML = '';
  ACTIONS.forEach(([act, label]) => {
    const row = document.createElement('div');
    row.className = 'krow';
    const s = document.createElement('span');
    s.textContent = label;
    const btn = document.createElement('button');
    btn.className = 'kbtn';
    btn.type = 'button';
    btn._code = bind[act];
    btn.textContent = keyLabel(bind[act]);
    btn.onclick = () => {
      if (listening) listening.btn.textContent = keyLabel(listening.btn._code);
      document.querySelectorAll('.kbtn.listening').forEach((b) => b.classList.remove('listening'));
      btn.classList.add('listening');
      btn.textContent = '… bir tuşa bas';
      listening = { bind, act, btn };
    };
    row.appendChild(s); row.appendChild(btn);
    c.appendChild(row);
  });
}

// Yakalama capture fazinda: normal keydown dinleyicisinden ONCE calisir,
// boylece atanan tus oyuna sizmaz ve basili kalmaz.
addEventListener('keydown', (e) => {
  if (!listening) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const code = e.code;
  delete keys[code];
  listening.bind[listening.act] = code;
  listening.btn._code = code;
  listening.btn.textContent = keyLabel(code);
  listening.btn.classList.remove('listening');
  listening = null;
  refreshBinds();
  markDups();
}, true);

// --- dokunmatik kontroller (mobil) ---
function mkBtn(box, who, act, label, style, cls) {
  const b = document.createElement('button');
  b.className = 'tbtn ' + who + (cls ? ' ' + cls : '');
  b.textContent = label;
  Object.assign(b.style, style);
  const on  = (e) => { e.preventDefault(); touchIn[who][act] = true; };
  const off = (e) => { e.preventDefault(); touchIn[who][act] = false; };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off);
  b.addEventListener('pointerleave', off);
  box.appendChild(b);
}

/**
 * Dokunmatik tuslari kurar.
 *
 * @param {'fire'|'water'|'both'} mode
 *   'fire' / 'water' : TEK oyuncu duzeni — yon tuslari sol altta, eylem tuslari
 *     sag altta, tuslar buyuk. Cevrim ici oynanista her cihaz yalnizca KENDI
 *     karakterinin tuslarini gorur; ikisini birden gostermek ekrani karistirip
 *     tuslarin ust uste binmesine yol aciyordu.
 *   'both' : ayni cihazda iki kisi — iki kucuk kume, solda Alev, sagda Damla.
 */
export function buildTouch(mode = 'both') {
  const box = document.getElementById('touchCtrls');
  box.innerHTML = '';
  box.classList.toggle('solo', mode !== 'both');

  if (mode === 'both') {
    mkBtn(box, 'fire', 'up', '▲', { left: '70px', bottom: '132px' });
    mkBtn(box, 'fire', 'down', '▼', { left: '70px', bottom: '14px' });
    mkBtn(box, 'fire', 'left', '◀', { left: '10px', bottom: '73px' });
    mkBtn(box, 'fire', 'right', '▶', { left: '130px', bottom: '73px' });
    mkBtn(box, 'fire', 'jump', '⤒', { left: '198px', bottom: '26px' });
    mkBtn(box, 'fire', 'interact', '✦', { left: '198px', bottom: '92px' });
    mkBtn(box, 'water', 'up', '▲', { right: '70px', bottom: '132px' });
    mkBtn(box, 'water', 'down', '▼', { right: '70px', bottom: '14px' });
    mkBtn(box, 'water', 'left', '◀', { right: '130px', bottom: '73px' });
    mkBtn(box, 'water', 'right', '▶', { right: '10px', bottom: '73px' });
    mkBtn(box, 'water', 'jump', '⤒', { right: '198px', bottom: '26px' });
    mkBtn(box, 'water', 'interact', '✦', { right: '198px', bottom: '92px' });
    return;
  }

  // Tek oyuncu: yon tuslari solda buyuk bir yon pedi, eylemler sagda.
  const w = mode;
  mkBtn(box, w, 'up', '▲', { left: '92px', bottom: '176px' }, 'big');
  mkBtn(box, w, 'down', '▼', { left: '92px', bottom: '32px' }, 'big');
  mkBtn(box, w, 'left', '◀', { left: '20px', bottom: '104px' }, 'big');
  mkBtn(box, w, 'right', '▶', { left: '164px', bottom: '104px' }, 'big');
  // Eylem tuslari sag kenarda DIKEY dizilir; yan yana konuldugunda dar
  // ekranlarda sag yon tusuyla ust uste biniyorlardi.
  mkBtn(box, w, 'jump', '⤒', { right: '20px', bottom: '40px' }, 'big act');
  mkBtn(box, w, 'interact', '✦', { right: '20px', bottom: '124px' }, 'big act');
}

const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || location.search.includes('touch');

/** @param {'fire'|'water'|'both'} mode */
export function showTouch(mode = 'both') {
  buildTouch(mode);
  if (isTouch) document.getElementById('touchCtrls').classList.remove('hidden');
}
