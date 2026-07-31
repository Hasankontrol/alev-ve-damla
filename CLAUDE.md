# CLAUDE.md

Bu dosya, bu depoda çalışan Claude Code oturumları içindir.
Amaç: mimariyi ve **tekrar keşfedilmesi pahalı olan tuzakları** kısa yoldan aktarmak.

## Proje

**Alev ve Damla: Gölgeden Kaçış** — iki kişilik 3D işbirliği bulmaca oyunu.
Three.js + Vite. Kurulum gerektirmez, tarayıcıda çalışır.

- Canlı: https://hasankontrol.github.io/alev-ve-damla/
- Depo: `Hasankontrol/alev-ve-damla` (public)
- `main`'e her push GitHub Actions ile otomatik yayınlanır.

## Komutlar

```bash
npm run dev        # http://localhost:5173
npm run build      # dist/
npm run preview    # derlenmiş sürümü dene
```

Yayın: `git push origin main` yeterli. İş akışını izlemek için:
`gh run watch <id> --repo Hasankontrol/alev-ve-damla --exit-status`

## Mimari

Modüller **döngüsel bağımlılık olmayacak** şekilde ayrılmıştır:

```
state.js      hiçbir şeye bağımlı DEĞİL — paylaşılan S nesnesi + içerik dizileri
  ↑
textures.js · audio.js · input.js · liquids.js · net.js
  ↑
entities.js · world.js
  ↑
levels.js
  ↑
game.js
  ↑
main.js       arayüz bağlantıları, önyükleme
```

**En önemli kural:** `world.js` yalnızca *inşa* fonksiyonları içerir
(`makeSaw`, `pool`, `makeGem`…). Kare başı güncellemeler (`updateHazards`,
`updateFires`, `updateMovers`, `updateGems`) **`game.js`'tedir**. Bu ayrım
kaldırılırsa `world → game → world` döngüsü oluşur.

ES modüllerinde dışa aktarılan değişkenler başka modülden yeniden atanamadığı
için tek bir mutable `S` nesnesi kullanılır. Diziler (`solids`, `zones`…)
yeniden atanmadığı, yalnızca içeriği değiştiği için doğrudan dışa aktarılır.

## Tuzaklar (hepsi bu depoda yaşandı)

**Renk yönetimi.** Three r152+ çıkışı sRGB'ye çevirir ve sahne soluklaşır.
`renderer.outputColorSpace = LinearSRGBColorSpace` + `ColorManagement.enabled = false`
oyunun ayarlanmış koyu atmosferini korur. **Kaldırma.**

**Kaynak serbest bırakma.** `clearLevel` sahneden çıkardığı nesnelerin
geometri/materyalini dispose eder, ancak `SHARED` kümesindekileri **atlamalıdır**
(paylaşılan birim kutu, materyal önbelleği). Paylaşılanları dispose etmek bir
sonraki bölümde bozuk çizime yol açar.

**Işık bütçesi.** Her dinamik ışık TÜM materyallerin gölgelendiricisini
pahalılaştırır — asıl performans darboğazı buydu (Bölüm 8'de 16 nokta ışık vardı,
7'ye indirildi). Yeni ışık eklemeden önce iki kez düşün; parlama için
`sparkTex()` sprite'ı genellikle yeterli. Lav ışığı bölüm başına 2 ile sınırlı
(`resetLightBudget`).

**Sıvı gölgelendiricileri** (`liquids.js`) ışıksızdır (`lights: false`) — dinamik
ışık sayısından etkilenmezler. Dalga yer değiştirmesi **yalnızca yukarı** olmalıdır;
aşağı da inerse yüzey zemin düzleminin altına geçer, zemin onu örter ve suyun
üstünde sert siyah lekeler oluşur.

**Ekran boyutu.** Dikey telefon ekranında `PerspectiveCamera.fov` dikey olduğu
için yatay görüş çok daralır. `applyFov()` hedef bir *yatay* açıdan geriye doğru
dikey fov hesaplar. Köşe penceresi yatay olduğundan sabit 60° kullanır.

## Çevrim içi oynanış (`net.js`)

**Sunucu-yetkili.** Oda kuran (host) tüm simülasyonu yürütür ve **Alev**'i oynar.
Katılan (guest) hiçbir simülasyon yapmaz — yalnızca girdisini yollar (~30/sn) ve
gelen durumu uygular (~20/sn), **Damla**'yı oynar. Bu sayede desync yapısal olarak
imkânsızdır. Guest tarafında `frame()` erken döner; `visualsOnly()` çalışır.

⚠️ **WebRTC ve PWA kurulumu güvenli bağlam ister** — HTTPS veya `localhost`.
`http://192.168.x.x` ile **çalışmaz**. Telefonda test için canlı adresi kullan.

Çevrim içi oynanışta her cihaz yalnızca **kendi** karakterinin dokunmatik
tuşlarını çizer (`buildTouch('fire'|'water'|'both')`).

## Bölüm tasarımı (`levels.js`)

- Oyuncu konumu `x ∈ [-40, 40]`, `z ∈ [-20, 130]` aralığına kısıtlanır.
- Zıplama tepe yüksekliği **~1.6 birim**; platform yükseklikleri 0.8–1.4 idealdir.
- Her bölüm **tam kapalı** kendi çeperini kurar (dış sınır duvarı yoktur).
- `hWall`/`vWall` uzunluğa +0.5 ekler → köşeler örtüşür, köşegen sızma olmaz.
- Bulmaca kuralları: TÜM `makeTorch`'lar yanınca `S.doorTorch` açılır
  (`makeWallTorch` dekoratiftir, `lit:true` başlar, engellemez) · `makeValve` →
  `S.doorValve` · **tam 2** `makePlate` → `S.gateDual`.
- `LEVEL_NAMES` dizisi `LEVELS` ile aynı sırada ve uzunlukta tutulmalıdır.
- Tehlikeler (testere/balta) **ölümcüldür** — bölüm tasarlarken etraflarından
  dolaşılabildiğinden emin ol.

## Test etme

Önizleme sekmesi arka planda olduğunda `requestAnimationFrame` durur, bu yüzden
oyun kendiliğinden ilerlemez. Hata ayıklama kancası:

```js
window.__g.drive(n)          // n kareyi elle ilerlet
window.__g.loadLevel(i, {skipIntro:true})
window.__g.S / fire / water / solids / zones / hazards / gems / net
```

Ekran görüntüsü için `?capture` ile aç (`preserveDrawingBuffer` açılır), sonra
`canvas.toDataURL()` sonucunu yerel bir yükleme sunucusuna POST edip PNG'yi oku.
Pencere gizliyse canvas 0×0 olabilir — `renderer.setSize(1280,720,false)` ile zorla.

**Bölüm adaleti testi:** 0.5 birimlik ızgarada doldurma (flood fill) —
`wall` (top > 1.6 katı) ile `lethal` (yanlış element / tehlike) ayrılır; sıvının
*üzerinden* zıplamaya izin verilir (8 hücreye kadar), duvarın üzerinden
verilmez. Zıplama modellenmezse test yanlışlıkla "ulaşılamaz" der.

Yön testi yaparken "D ekran sağı mı" sorusunu **kameranın gerçek sağ vektörüyle**
(matrixWorld X sütunu) karşılaştır, dünya +x ile değil.

## Yapılmayanlar / bilinen sınırlar

- **Gerçek Android APK yok.** Bu makinede JDK / Android SDK / Android Studio /
  gradle kurulu değil. Oyun PWA olarak kurulabilir; APK için Capacitor adımları
  README'dedir.
- Kullanıcı fotoğrafları depoda **değildir** — çalışma anında cihazdan seçilir.

## Dil

Kullanıcı Türkçe konuşur. Kod yorumları ve arayüz metinleri Türkçedir; commit
mesajları da Türkçe (ASCII harflerle) yazılır.
