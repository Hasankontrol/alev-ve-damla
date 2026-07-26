import { Peer } from 'peerjs';

/**
 * Iki cihaz arasinda P2P baglanti (WebRTC / PeerJS).
 *
 * MIMARI: SUNUCU-YETKILI (host-authoritative).
 *   - Oda KURAN taraf (host) tum simulasyonu yurutur: fizik, bulmacalar, Kulge.
 *     Host her zaman ALEV'i oynar.
 *   - Oda KATILAN taraf (guest) hicbir simulasyon yapmaz; yalnizca kendi
 *     tuslarini gonderir ve gelen durumu ekrana uygular. Guest DAMLA'yi oynar.
 *   Boylece iki cihazda farkli sonuc olusmasi (desync) yapisal olarak imkansiz.
 *
 * PeerJS'in ucretsiz genel aracisi yalnizca TANISTIRMA icin kullanilir;
 * oyun verisi dogrudan iki cihaz arasinda akar, sunucudan gecmez.
 *
 * NOT: WebRTC yalnizca guvenli baglamda calisir (HTTPS veya localhost).
 * Telefonlarda http://192.168... adresiyle BAGLANMAZ.
 */

export const net = {
  mode: 'off',        // 'off' | 'host' | 'guest'
  status: 'idle',     // idle | bekleniyor | baglaniyor | bagli | hata | kapandi
  roomCode: '',
  error: '',
  /** guest'ten gelen en son girdi (host okur) */
  remoteInput: { up: false, down: false, left: false, right: false, jump: false, interact: false },
  /** host'tan gelen en son durum (guest uygular) */
  snapshot: null,
  onStatus: null,     // (status, extra) => void
  onLevel: null,      // (levelIndex) => void  — guest bolum yuklemesi icin
};

let peer = null, conn = null;
let lastSent = 0;

const isOnline = () => net.mode !== 'off' && net.status === 'bagli';
export const isHost = () => net.mode === 'host' && isOnline();
export const isGuest = () => net.mode === 'guest' && isOnline();
export const isNetActive = () => net.mode !== 'off';

function setStatus(s, extra) {
  net.status = s;
  net.onStatus?.(s, extra);
}

/** Okunmasi kolay 4 karakterli oda kodu (karistirilabilen harfler yok). */
function makeCode() {
  const abc = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

// Oda kodu global ad alaninda cakismasin diye sabit bir onek kullanilir.
const idFor = (code) => `alevdamla-${code}`;

function wire(c) {
  conn = c;
  c.on('open', () => setStatus('bagli'));
  c.on('data', (msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'in' && net.mode === 'host') {
      net.remoteInput = msg.v;
    } else if (msg.t === 's' && net.mode === 'guest') {
      net.snapshot = msg.v;
      if (msg.v.lv !== undefined && msg.v.lv !== net._lastLevel) {
        net._lastLevel = msg.v.lv;
        net.onLevel?.(msg.v.lv);
      }
    }
  });
  c.on('close', () => setStatus('kapandi'));
  c.on('error', (e) => { net.error = String(e); setStatus('hata', e); });
}

/** Oda kurar; geriye oda kodunu doner. Host ALEV'i oynar. */
export function hostRoom() {
  net.mode = 'host';
  net.roomCode = makeCode();
  setStatus('bekleniyor');
  peer = new Peer(idFor(net.roomCode));
  peer.on('open', () => setStatus('bekleniyor'));
  peer.on('connection', (c) => { setStatus('baglaniyor'); wire(c); });
  peer.on('error', (e) => {
    // Ayni kod kullanimdaysa yeni kod uret ve tekrar dene
    if (String(e).includes('is taken')) { peer.destroy(); hostRoom(); return; }
    net.error = String(e); setStatus('hata', e);
  });
  return net.roomCode;
}

/** Odaya katilir. Guest DAMLA'yi oynar. */
export function joinRoom(code) {
  net.mode = 'guest';
  net.roomCode = (code || '').toUpperCase().trim();
  setStatus('baglaniyor');
  peer = new Peer();
  peer.on('open', () => wire(peer.connect(idFor(net.roomCode), { reliable: false })));
  peer.on('error', (e) => { net.error = String(e); setStatus('hata', e); });
}

export function disconnect() {
  try { conn?.close(); } catch { /* zaten kapali */ }
  try { peer?.destroy(); } catch { /* zaten yok */ }
  conn = peer = null;
  net.mode = 'off';
  net.snapshot = null;
  setStatus('idle');
}

const send = (obj) => { if (conn?.open) { try { conn.send(obj); } catch { /* dusen paket onemsiz */ } } };

/** Guest: kendi tuslarini host'a yollar (saniyede ~30). */
export function sendInput(now, v) {
  if (!isGuest() || now - lastSent < 33) return;
  lastSent = now;
  send({ t: 'in', v });
}

/** Host: yetkili durumu guest'e yollar (saniyede ~20). */
export function sendSnapshot(now, v) {
  if (!isHost() || now - lastSent < 50) return;
  lastSent = now;
  send({ t: 's', v });
}
