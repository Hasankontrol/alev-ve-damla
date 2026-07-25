# 🔥 Alev ve Damla: Gölgeden Kaçış 💧

İki kişilik 3D işbirliği bulmaca oyunu. *Ateş ve Su* tarzından esinlenir, ama
tamamen özgün karakterler, **3B hareket** (ileri‑geri‑yan‑çapraz) ve bazı
bölümlerde peşinize düşen bir korku karakteri (**Külge**) içerir.

Three.js + Vite ile yazılmıştır, tarayıcıda çalışır, kurulum gerektirmez.

---

## Oynanış

| | Alev 🔥 | Damla 💧 |
|---|---|---|
| Güvenli | Lav | Su |
| Ölümcül | Su | Lav |
| Görev | Meşaleleri yakar | Valfleri açar |

- Yanlış sıvı **anında öldürür** — havuzlar gerçek engeldir, içinden geçilemez.
- Bazı geçitler yalnızca **iki oyuncu birlikte** plakalara basınca açılır.
- Her bölümde 3 gizli 💎 elmas vardır (toplam 15).
- Bir bölümü bitirmek için **ikiniz de** kendi renk pedinize basmalısınız.

### Bölümler

1. **Uyanış Odası** — element kuralı, meşale, zıplama
2. **Buhar Fabrikası** — valf, dönen testere, platform köprü, basınç plakaları
3. **Terk Edilmiş Kanal** — ayrı element koridorları, testere ve balta
4. **Ayrılık Labirenti** — oyuncular ayrılır, herkes kendi bulmacasını çözer
5. **Külge'den Kaçış** — hareketli platform, balta ve ilk kovalamaca
6. **Asılı Basamaklar** — baştan başa uzanan havuzları platform zincirleriyle geçme
7. **Yankı Mahzeni** — zincirleme kapılar; biri çalışırken diğeri bekler
8. **Külge'nin Yükselişi** — üç kapı mekaniği de kovalamaca baskısı altında

### Diğer özellikler

- **Hikâye** — açılış, her bölüm için giriş ve final ara sahneleri (atlanabilir).
- **Bölüm seçme** — açtığın bölümlere dönebilirsin; en iyi süre ve elmas kaydedilir.
- **Güvenli nokta** — ölünce bölüm başına değil, en son güvenle durduğun yere dönersin.
- **Kronometre** — bölüm süresi ekranda; en iyi süreler `localStorage`'da tutulur.
- **Uyarlanabilir kalite** — kare hızı düşerse parlama/gölge kademeli olarak kapanır.

## Kontroller

Tuşlar **başlangıç ekranından değiştirilebilir**. Varsayılanlar:

| Eylem | Alev 🔥 | Damla 💧 |
|---|---|---|
| Hareket | `W A S D` | Ok tuşları |
| Zıpla | `Boşluk` | `Sağ Shift` |
| Etkileşim | `E` | `Sağ Ctrl` |

Sabit tuşlar: `P` duraklat (menü açılır) · `R` bölümü yeniden başlat · `M` ses aç/kapa
Kamera: fare ile sürükle, tekerlekle yakınlaş.

**Oyun kumandası:** Bağlıysa otomatik algılanır (1. kumanda Alev, 2. Damla).
**Mobil:** Dokunmatik kontroller otomatik görünür.

### Ekran düzeni (tek cihazda oynarken)

Başlangıç ekranından seçilir:

| Mod | Davranış |
|---|---|
| **Akıllı** (varsayılan) | Oyuncular uzaklaşınca ekran kendiliğinden ikiye bölünür, yan yana gelince tek görüntüde birleşir |
| **Hep bölünmüş** | Ekran her zaman ikiye bölü — 2 kumanda ile ideal |
| **Köşe penceresi** | Ana ekran 🔥 Alev, sağ üstteki küçük pencerede 💧 Damla |

Ortak tek kamera, oyuncular ayrılınca geri çekilip ikisini de görünmez hâle
getiriyordu; "akıllı" mod bu sorunu çözer.

### Telefona kurma (Android)

Oyun bir **PWA**'dır: Chrome ile açıp menüden *"Ana ekrana ekle"* dersen
telefona uygulama gibi kurulur, tam ekran açılır ve **internetsiz de çalışır**
(servis işçisi varlıkları önbelleğe alır).

Gerçek bir `.apk` istersen [Capacitor](https://capacitorjs.com) ile paketlenebilir;
bunun için bilgisayarda **JDK + Android Studio** kurulu olmalıdır:

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init "Alev ve Damla" com.hecin.alevdamla --web-dir=dist
npm run build && npx cap add android && npx cap sync
npx cap open android        # Android Studio'da Build > Build APK
```

## Karakterini özelleştir

Başlangıç ekranından üç seçenek:

1. **Fotoğraf** — yüklediğin fotoğraf karakterin yüzüne gelir.
2. **Foto figür modu** — fotoğraf tüm gövde olur (arka planı silinmiş PNG önerilir).
3. **Kendi 3D modelin (`.glb`)** — [Ready Player Me](https://readyplayer.me),
   [VRoid Studio](https://vroid.com/studio) veya Blender ile tasarlayıp yükle.

---

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ klasörüne üretim derlemesi
npm run preview  # derlenmiş sürümü yerelde dene
```

### Proje yapısı

```
src/
  main.js      Başlangıç ekranı bağlantıları ve önyükleme
  game.js      Fizik, kamera, kovalamaca, ana döngü, bölüm yükleme
  levels.js    Sekiz bölümün tasarımı + bölüm adları
  world.js     Bölüm yapı taşları (duvar, havuz, kapı, tehlike…) — yalnızca inşa
  entities.js  Oyuncu, Külge, parçacık auraları, .glb yükleyici
  input.js     Klavye + oyun kumandası + dokunmatik girdi, tuş atama
  audio.js     Prosedürel ses (dosya yok, hepsi WebAudio ile üretilir)
  textures.js  Canvas ile üretilen dokular (tuğla, lav, su, alev)
  story.js     Ara sahne motoru ve hikâye metinleri
  menu.js      Bölüm seçme ekranı
  progress.js  localStorage ile ilerleme, en iyi süreler, ölüm sayacı
  state.js     Paylaşılan durum — döngüsel bağımlılığı önler
```

Modüller **döngüsel bağımlılık olmayacak** şekilde ayrılmıştır: `state.js` hiçbir
şeye bağımlı değildir, `world.js` yalnızca *inşa* fonksiyonlarını tutar, kare başı
güncellemeler (`updateFires`, `updateHazards`, …) `game.js`'tedir.

### Yayınlama (GitHub Pages)

Depo şu an **gizli**. Ücretsiz hesapta GitHub Pages yalnızca herkese açık
depolarda çalıştığı için otomatik yayın kapalıdır.

Oyunu linkle paylaşmak istersen:

1. GitHub'da depo → **Settings → General → Change visibility → Public**
2. **Settings → Pages → Source: GitHub Actions**
3. `.github/workflows/deploy.yml` içindeki `push` tetikleyicisinin yorumunu kaldır

Sonrasında her `git push` otomatik olarak yeni sürümü yayınlar.

### Notlar

- `?nobloom` — parlama efektini kapatır (zayıf donanım için).
- `?capture` — ekran görüntüsü alabilmek için çizim tamponunu korur.
- Tüm ses ve dokular çalışma anında üretilir; oyun hiçbir varlık dosyası indirmez.

## Lisans

MIT — bkz. [LICENSE](LICENSE).
