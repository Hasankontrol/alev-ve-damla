import * as THREE from 'three';

/**
 * Paylasilan oyun durumu.
 *
 * Tek bir `S` nesnesi kullaniyoruz cunku ES modullerinde disari aktarilan
 * degiskenler baska modulden yeniden atanamaz. Diziler ise yeniden atanmadigi
 * (sadece icerigi degistigi) icin dogrudan disari aktarilabilir.
 *
 * Bu modulun HICBIR seye bagimliligi yoktur — boylece dongusel import olusmaz.
 */
export const S = {
  // sahne / render
  scene: null, camera: null, camFire: null, camWater: null,
  renderer: null, clock: null, composer: null,
  dirLight: null, hemi: null,

  // oyuncular ve yaratik
  fire: null, water: null, kulge: null,

  // bolume ozel nesneler
  doorTorch: null, doorValve: null, gateDual: null, valve: null,
  goalFire: null, goalWater: null,

  // akis durumu
  curLevel: 0, started: false, won: false, paused: false, muted: false,
  transitioning: false, useStandee: false,
  /** O an ekran bolunmus mu (her karede yeniden karar verilir). */
  split: false,
  /** 'auto' = oyuncular uzaklasinca kendiliginden bolunur, 'always' = hep bolunmus. */
  splitMode: 'auto',
  /** Goruntuleme bicimi: 'shared' (akilli/bolunmus) veya 'pip' (kose penceresi). */
  view: 'shared',

  // kovalamaca
  levelHasChase: false, levelChaseZ: 0, levelExitZ: 0, kulgeActive: false,

  // elmas sayaclari
  gemsGot: 0, gemsTotal: 0, gemsAll: 0,

  // kamera
  camYaw: -0.12, camPitch: 0.6, camDistBase: 15,
  /** Sabit bakis acisi: kamera fare/dokunusla dondurulemez, hep ayni acidan bakar. */
  fixedCam: false,

  // aktif bolumun ipucu metni
  curHint: () => '',
};

/** Kontrol noktasi (kovalamaca sirasinda yeniden dogma yeri). */
export const chaseCP = new THREE.Vector3();

// --- bolum icerigi listeleri (loadLevel her bolumde temizler) ---
export const solids = [];       // {minX,maxX,minZ,maxZ,top,stand,solid,mesh}
export const bounds = [];       // ayni yapi, kalici sinirlar icin
export const boundMeshes = [];
export const zones = [];        // lav / su alanlari
export const torches = [];
export const plates = [];
export const animated = [];     // dalgalanan havuz yuzeyleri
export const levelMeshes = [];  // bolum degisiminde sahneden silinecekler
export const gems = [];
export const movers = [];       // hareketli platformlar
export const hazards = [];      // testere / balta
export const fires = [];        // lav ustundeki alev partikulleri
export const mixers = [];       // .glb animasyonlari

/**
 * Bolumler arasinda YENIDEN KULLANILAN kaynaklar (paylasilan geometri ve
 * materyaller). clearLevel bunlari dispose ETMEZ — aksi halde bir sonraki
 * bolumde bozuk cizim olusur.
 */
export const SHARED = new Set();

/** Paylasilan kaynagi kaydeder ve geri dondurur (zincirlemeye uygun). */
export function share(resource) {
  SHARED.add(resource);
  return resource;
}

/** Bolum degisiminde tum icerik listelerini bosaltir. */
export function resetLevelLists() {
  for (const list of [solids, zones, torches, plates, animated,
                      levelMeshes, gems, movers, hazards, fires]) {
    list.length = 0;
  }
}
