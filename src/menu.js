import './menu.css';
import { loadProgress, isUnlocked, resetProgress, formatTime } from './progress.js';

/**
 * Bolum secme ekrani (saf DOM).
 *
 * Bolum adlarini LEVELS'tan okuyamayiz (ad ancak bolum fonksiyonu
 * calistirilinca ortaya cikiyor), bu yuzden liste disaridan verilir:
 *   buildLevelMenu({ levels: [{ name: 'Bölüm 1 · Uyanış Odası', gems: 3 }, ...], onSelect, onClose })
 * `gems` istege bagli: verilirse "💎 2/3", verilmezse "💎 2" gosterilir.
 */

let root = null;   // #levelMenu
let opts = null;   // { levels, onSelect, onClose }
let escBound = false;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Menuyu kurar (gizli baslar), kok elemani doner. */
export function buildLevelMenu(o) {
  opts = o || {};
  root = document.getElementById('levelMenu');
  if (!root) {
    root = document.createElement('div');
    root.id = 'levelMenu';
    document.body.appendChild(root);
  }
  root.classList.add('hidden');
  render();

  if (!escBound) {
    escBound = true;
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && opts.onClose && root && !root.classList.contains('hidden')) opts.onClose();
    });
  }
  return root;
}

/** Kartlari bastan cizer (dinleyiciler innerHTML ile birlikte yenilenir). */
function render() {
  const p = loadProgress();
  const levels = opts.levels || [];

  const cards = levels.map((lv, i) => {
    const locked = !isUnlocked(i);
    const best = p.bestTimes[i];
    const got = p.gemsPerLevel[i] || 0;
    const gemTxt = lv.gems ? `💎 ${got}/${lv.gems}` : `💎 ${got}`;
    return `<button class="lm-card${locked ? ' locked' : ''}" data-i="${i}"${locked ? ' disabled' : ''}>
        <span class="lm-num">${locked ? '🔒' : i + 1}</span>
        <span class="lm-name">${esc(lv.name || 'Bölüm ' + (i + 1))}</span>
        <span class="lm-stats"><span>⏱ ${best != null ? formatTime(best) : '—'}</span><span>${gemTxt}</span></span>
      </button>`;
  }).join('');

  root.innerHTML = `<div class="lm-box">
      <h2 class="lm-title"><span class="a">Alev</span> ve <span class="d">Damla</span> · Bölüm Seç</h2>
      <div class="lm-grid">${cards}</div>
      <div class="lm-foot">
        <span class="lm-stat">☠ ${p.totalDeaths} ölüm</span>
        <button class="lm-btn ghost" id="lmReset">İlerlemeyi sıfırla</button>
        ${opts.onClose ? '<button class="lm-btn" id="lmClose">Kapat</button>' : ''}
      </div>
    </div>`;

  root.querySelector('.lm-grid').addEventListener('click', (e) => {
    const b = e.target.closest('.lm-card');
    if (!b || b.disabled) return;
    opts.onSelect?.(Number(b.dataset.i));
  });
  root.querySelector('#lmReset').addEventListener('click', () => {
    if (confirm('Tüm ilerleme silinecek. Emin misin?')) { resetProgress(); render(); }
  });
  root.querySelector('#lmClose')?.addEventListener('click', () => opts.onClose());
}

/** Menuyu gosterir (istatistikleri tazeleyerek). */
export function showLevelMenu() {
  if (!root) return;
  render();
  root.classList.remove('hidden');
}

/** Menuyu gizler. */
export function hideLevelMenu() {
  root?.classList.add('hidden');
}
