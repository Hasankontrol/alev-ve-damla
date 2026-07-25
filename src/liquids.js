import * as THREE from 'three';

/**
 * Okyanus ve akan lav icin ozel gölgelendiriciler.
 *
 * Ikisi de ISIKSIZ (ShaderMaterial, lights:false): sahnedeki dinamik isiklarin
 * govde gölgelendiricisine hic girmezler. Bu hem cok daha iyi gorunmelerini
 * hem de eski MeshLambert havuzlardan DAHA UCUZ olmalarini saglar.
 *
 * Gurultu, doku okumasi olmadan tamamen prosedureldir (deger gurultusu + FBM),
 * boylece ek doku bellegi harcanmaz.
 */

const NOISE_GLSL = /* glsl */`
  // ucuz deger gurultusu — doku okumasi yok
  float hash(vec2 p){
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);                 // yumusak gecis
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  // 3 oktav yeterli: mobilde de akici kalsin
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
    return v;
  }
`;

const VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  uniform float uTime;
  uniform float uWave;
  ${NOISE_GLSL}
  void main(){
    vUv = uv;
    vec3 p = position;
    // Yuzey dalgalanmasi (duzlem XY'de yatiyor, z yukseklik).
    // SADECE YUKARI dogru: asagi da inseydi yuzey zemin duzleminin altina gecer,
    // zemin havuzu orter ve suyun uzerinde sert siyah lekeler olusurdu.
    p.z += fbm(p.xy * 0.25 + uTime * 0.15) * uWave;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const OCEAN_FRAG = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  ${NOISE_GLSL}
  void main(){
    vec2 uv = vWorld.xz * 0.16;                  // dunya uzayi: havuz boyutundan bagimsiz olcek

    // ters yonde akan iki katman -> girdap hissi
    float n1 = fbm(uv + vec2(uTime * 0.05, uTime * 0.03));
    float n2 = fbm(uv * 1.9 - vec2(uTime * 0.07, uTime * 0.04));
    float h = n1 * 0.65 + n2 * 0.35;

    // derinlik: cukurlar koyu, tepeler acik. Aralik dar tutulur ki yuzeyde
    // "delik" gibi duran sert siyah lekeler olusmasin.
    vec3 col = mix(uDeep, uShallow, smoothstep(0.28, 0.62, h));

    // dalga tepelerinde kopuk seridi
    float foam = smoothstep(0.68, 0.84, h);
    col = mix(col, uFoam, foam * 0.7);

    // ince parildama
    float sparkle = pow(fbm(uv * 7.0 + uTime * 0.5), 7.0);
    col += uFoam * sparkle * 0.9;

    gl_FragColor = vec4(col, 0.95);
  }
`;

const LAVA_FRAG = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  uniform float uTime;
  uniform vec3 uHot;
  uniform vec3 uMid;
  uniform vec3 uCrust;
  ${NOISE_GLSL}
  void main(){
    vec2 uv = vWorld.xz * 0.14;

    // alan carpitma: akan magma gorunumu
    vec2 warp = vec2(fbm(uv + uTime * 0.05), fbm(uv + 5.2 - uTime * 0.04));
    float n = fbm(uv * 1.4 + warp * 1.6 + vec2(0.0, uTime * 0.08));

    // Yuzeyin cogu KABUK olsun, erimis kanallar aralarindan aksin. Tersi
    // yapildiginda tum havuz beyaza patliyordu (ustune parlama efekti de binince).
    vec3 col = mix(uCrust, uMid, smoothstep(0.34, 0.60, n));

    // catlak damarlari: kabuk ile magma sinirinda sicak cizgi
    float vein = 1.0 - smoothstep(0.0, 0.06, abs(n - 0.34));
    col += uHot * vein * 0.55;

    // yavas nabiz — lav soguyup isiniyormus gibi
    col *= 0.86 + 0.14 * sin(uTime * 1.6 + n * 6.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Guncellenecek uniform'lari tutar (game.js her karede uTime'i ilerletir). */
export const liquidUniforms = [];

function makeLiquid(frag, uniforms, wave) {
  const u = { uTime: { value: 0 }, uWave: { value: wave }, ...uniforms };
  liquidUniforms.push(u);
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms: u,
    lights: false,                 // isiksiz: dinamik isik sayisindan etkilenmez
    transparent: true,
    depthWrite: true,
  });
}

export function makeOceanMaterial() {
  return makeLiquid(OCEAN_FRAG, {
    uDeep:    { value: new THREE.Color(0x0a3570) },
    uShallow: { value: new THREE.Color(0x2e9ae0) },
    uFoam:    { value: new THREE.Color(0xbff2ff) },
  }, 0.55);
}

export function makeLavaMaterial() {
  return makeLiquid(LAVA_FRAG, {
    uHot:   { value: new THREE.Color(0xffd06a) },
    uMid:   { value: new THREE.Color(0xd83c05) },
    uCrust: { value: new THREE.Color(0x25060a) },
  }, 0.28);
}

/** Her karede cagrilir — tum sivi gölgelendiricilerinin zamanini ilerletir. */
export function updateLiquids(t) {
  for (const u of liquidUniforms) u.uTime.value = t;
}
