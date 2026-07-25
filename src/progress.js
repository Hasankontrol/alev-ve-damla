/**
 * Ilerleme kaydi (localStorage).
 *
 * Gizli sekmede / depolama kapaliyken `localStorage` erisimi hata firlatir.
 * O durumda bellekteki `mem` yedegine duseriz: oyun COKMEZ, sadece kayit
 * sekme kapanana kadar yasar.
 *
 * Kayit bicimi:
 *   { unlockedLevel: 0, bestTimes: {0:12.4}, gemsPerLevel: {0:3}, totalDeaths: 0 }
 */

const KEY = 'alev-damla-progress';

/** Bos / varsayilan ilerleme. */
const empty = () => ({ unlockedLevel: 0, bestTimes: {}, gemsPerLevel: {}, totalDeaths: 0 });

let mem = null;   // localStorage kullanilamiyorsa buraya duseriz

/** Sadece sayi degerlerini gecir; bozuk anahtarlari at. */
function numMap(o) {
  const out = {};
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (Number.isFinite(v) && v >= 0) out[k] = v;
    }
  }
  return out;
}

const nonNegInt = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Disaridan gelen her seyi guvenli bir ilerleme nesnesine cevirir. */
function sanitize(p) {
  if (!p || typeof p !== 'object') return empty();
  return {
    unlockedLevel: nonNegInt(p.unlockedLevel),
    bestTimes: numMap(p.bestTimes),
    gemsPerLevel: numMap(p.gemsPerLevel),
    totalDeaths: nonNegInt(p.totalDeaths),
  };
}

/** Kayitli ilerlemeyi okur. Bozuk/eksik veride varsayilana doner. */
export function loadProgress() {
  if (mem) return mem;
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    mem = empty();                 // depolama yok: bellege dus
    return mem;
  }
  try {
    return sanitize(JSON.parse(raw));   // raw null ise JSON.parse null doner, sanitize yakalar
  } catch {
    return empty();                // bozuk JSON: varsayilana don (depolama calisiyor, mem'e dusme)
  }
}

/** Ilerlemeyi yazar ve temizlenmis halini geri doner. */
export function saveProgress(p) {
  const clean = sanitize(p);
  if (mem) { mem = clean; return clean; }
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    mem = clean;                   // kota dolu / yazma yasak: bellege dus
  }
  return clean;
}

/** En yuksek acilmis bolumu gunceller (geri almaz). */
export function unlockLevel(i) {
  const p = loadProgress();
  if (i > p.unlockedLevel) p.unlockedLevel = Math.floor(i);
  return saveProgress(p);
}

/** Bolum bitisi: sure ve elmas SADECE daha iyiyse yazilir. */
export function recordLevelComplete(i, seconds, gems) {
  const p = loadProgress();
  const best = p.bestTimes[i];
  if (Number.isFinite(seconds) && seconds >= 0 && (best == null || seconds < best)) {
    p.bestTimes[i] = seconds;
  }
  const bestGems = p.gemsPerLevel[i];
  if (Number.isFinite(gems) && gems >= 0 && (bestGems == null || gems > bestGems)) {
    p.gemsPerLevel[i] = gems;
  }
  return saveProgress(p);
}

/** Olum sayacini artirir. */
export function recordDeath() {
  const p = loadProgress();
  p.totalDeaths++;
  return saveProgress(p);
}

/** Her seyi sifirlar. */
export function resetProgress() {
  return saveProgress(empty());
}

/** i. bolum oynanabilir mi? */
export function isUnlocked(i) {
  return i <= loadProgress().unlockedLevel;
}

/** 83.4 -> "1:23". Gecersiz deger -> "—". */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const t = Math.floor(seconds);
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}
