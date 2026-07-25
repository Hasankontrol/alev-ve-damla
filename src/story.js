import './story.css';

/**
 * Ara sahne (cutscene) motoru + hikaye metinleri.
 *
 * Motor oyun durumunu (S) HIC bilmez — duraklatma isini cagiran taraf
 * `onOpen` / `onClose` geri cagirmalari ile yapar. Boylece dongusel import olmaz.
 *
 * Disari acilanlar:
 *   showCutscene({ title, lines, onOpen, onClose }) -> Promise (kapaninca resolve)
 *   getLevelIntro(levelIndex) -> { title, lines } | null
 *   INTRO_SCENE, FINAL_SCENE -> { title, lines }
 *   isCutsceneOpen() -> boolean
 *
 * Satir basinda 🔥 varsa satir turuncu, 💧 varsa mavi renklenir (bkz. story.css).
 */

// ---------- hikaye metinleri (duzenlemek icin SADECE burayi degistir) ----------

/** Oyunun basindaki acilis sahnesi. */
export const INTRO_SCENE = {
  title: 'Gölgeden Kaçış',
  lines: [
    'Yerin altında unutulmuş bir tesis. Işıklar çoktan öldü, borular hâlâ nefes alıyor.',
    '🔥 Alev: "Uyandım... ve sen buradasın. Gerisi önemli değil."',
    '💧 Damla: "Sana dokunursam ikimiz de söneriz. Yine de bırakmıyorum."',
    'Koridorların derinliğinde bir şey kıpırdadı. Dumandan ve kara sudan. Adı: Külge.',
  ],
};

/** Bolum giris sahneleri — dizi sirasi levels.js icindeki LEVELS sirasidir (5 bolum). */
const LEVEL_INTROS = [
  { // 0 — Bölüm 1 · Uyanış Odası
    title: 'Bölüm 1 · Uyanış Odası',
    lines: [
      'İlk oda ikiye bölünmüş: bir yanda kaynayan lav, öbür yanda durgun su.',
      '🔥 Alev: "Sen sudan geç, ben ateşten. Başka türlü yürüyemeyiz."',
      '💧 Damla: "Ayrı yollardan. Ama aynı kapıya."',
    ],
  },
  { // 1 — Bölüm 2 · Buhar Fabrikası
    title: 'Bölüm 2 · Buhar Fabrikası',
    lines: [
      'Fabrika ölmemiş, sadece uyuyor. Buhar tavana vurup geri düşüyor.',
      '💧 Damla: "Valfi ben açarım. Bir süre beni göremeyeceksin."',
      '🔥 Alev: "Görmeme gerek yok. Sesini duyuyorum, yeter."',
    ],
  },
  { // 2 — Bölüm 3 · Terk Edilmiş Kanal
    title: 'Bölüm 3 · Terk Edilmiş Kanal',
    lines: [
      'İki uzun kanal, aralarında ince bir bölme. Bir taraf lav, bir taraf su.',
      '🔥 Alev: "Duvarın öbür yanındasın. Adımlarını sayıyorum."',
      '💧 Damla: "Say. Sonuna kadar say, sakın şaşırma."',
    ],
  },
  { // 3 — Bölüm 4 · Ayrılık Labirenti
    title: 'Bölüm 4 · Ayrılık Labirenti',
    lines: [
      'Burada yollar birbirini hiç görmüyor. Tesis sanki ayırmak için yapılmış.',
      '💧 Damla: "Ya kuzeyde buluşamazsak?"',
      '🔥 Alev: "Ben meşaleleri yakarım, sen valfi açarsın. Kapılar ikimizi birden bekler."',
    ],
  },
  { // 4 — Bölüm 5 · Külge'den Kaçış
    title: 'Bölüm 5 · Külge’den Kaçış',
    lines: [
      'Duman koridoru doldurdu. Kapüşonun altında yüz yok, sadece boşluk var.',
      'Külge yıllardır burada yalnız — ve yalnızlığını paylaşacak birini arıyor.',
      '🔥 Alev: "Koş. Arkana bakma, ben arkandayım."',
    ],
  },
];

/** Oyunun sonundaki final sahnesi. */
export const FINAL_SCENE = {
  title: 'Yüzeyde',
  lines: [
    'Kapı arkalarında kapandı. Külge karanlıkta kaldı; kovalayacak kimsesi yok artık.',
    'Yukarıda gökyüzü var. Alev ısıtıyor, Damla parlıyor, aralarında hep bir parmak boşluk.',
    '💧 Damla: "Hâlâ dokunamıyoruz."',
    '🔥 Alev: "Ama artık aynı yoldayız."',
  ],
};

/** Bolum indeksine gore giris sahnesi; yoksa null. */
export function getLevelIntro(levelIndex) {
  return LEVEL_INTROS[levelIndex] ?? null;
}

// ---------- ara sahne motoru ----------

const TYPE_MS = 26;          // harf basina gecen sure
const AUTO_CLOSE_MS = 2500;  // metin bittikten sonra otomatik kapanma

let current = null;          // acik sahne ({ close }) veya null

/** Su an ekranda bir ara sahne var mi? */
export const isCutsceneOpen = () => current !== null;

/**
 * Ara sahneyi gosterir. Kapaninca resolve olan Promise doner.
 * @param {{title:string, lines:string[], onOpen?:Function, onClose?:Function}} scene
 */
export function showCutscene({ title, lines = [], onOpen, onClose }) {
  current?.close();          // ayni anda tek sahne

  return new Promise((resolve) => {
    // --- DOM ---
    const root = document.createElement('div');
    root.className = 'cutscene';

    const box = document.createElement('div');
    box.className = 'cs-box';

    const head = document.createElement('h2');
    head.className = 'cs-title';
    head.textContent = title;
    box.appendChild(head);

    const paras = lines.map((line) => {
      const p = document.createElement('p');
      p.className = 'cs-line'
        + (line.startsWith('🔥') ? ' alev' : line.startsWith('💧') ? ' damla' : '');
      box.appendChild(p);
      return p;
    });

    const skip = document.createElement('button');
    skip.className = 'cs-skip';
    skip.type = 'button';
    skip.textContent = 'Atla ▸';

    root.append(box, skip);

    // --- yazi makinesi durumu ---
    // emoji yuzey ciftlerini bolmemek icin kod noktalarina ayiriyoruz
    const chars = lines.map((l) => [...l]);
    let li = 0, ci = 0;
    let typeTimer = 0, autoTimer = 0;
    let typed = false, closed = false;

    function stopTyping() {                 // yazim bitti: timer'i birak, otomatik kapanmayi kur
      clearInterval(typeTimer); typeTimer = 0;
      typed = true;
      autoTimer = setTimeout(close, AUTO_CLOSE_MS);
    }

    function typeStep() {
      if (li >= chars.length) { stopTyping(); return; }
      paras[li].textContent += chars[li][ci++];
      if (ci >= chars[li].length) { li++; ci = 0; }
    }

    function completeNow() {                // metni aninda tamamla
      paras.forEach((p, i) => { p.textContent = lines[i]; });
      stopTyping();
    }

    function close() {
      if (closed) return;
      closed = true;
      clearInterval(typeTimer);             // sizinti olmasin: iki timer da temizlenir
      clearTimeout(autoTimer);
      removeEventListener('keydown', onKey, true);
      root.remove();
      if (current === api) current = null;
      onClose?.();
      resolve();
    }

    // ilk basis metni tamamlar, ikincisi sahneyi kapatir
    const advance = () => (typed ? close() : completeNow());

    function onKey(e) {
      if (e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'NumpadEnter') return;
      e.preventDefault();
      e.stopPropagation();                  // tus oyuna sizmasin (yakalama asamasi)
      advance();
    }

    root.addEventListener('click', advance);
    skip.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    addEventListener('keydown', onKey, true);

    const api = { close };
    current = api;
    document.body.appendChild(root);
    onOpen?.();
    typeTimer = setInterval(typeStep, TYPE_MS);
  });
}
