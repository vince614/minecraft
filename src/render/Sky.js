import * as THREE from 'three';
import { RENDER_DISTANCE, CHUNK_SIZE } from '../core/constants.js';

// Cycle jour/nuit complet : soleil/lune mobiles, couleur du ciel et brouillard
// dynamiques, étoiles la nuit, nuages dérivants. Pilote aussi les uniformes
// d'éclairage du shader des blocs (uLightDir / uAmbient) pour que le monde
// s'assombrisse la nuit.

const DAY_LENGTH = 180; // secondes pour un cycle complet
const DOME_RADIUS = RENDER_DISTANCE * CHUNK_SIZE * 1.2;

const NIGHT = new THREE.Color(0x05070f);
const DAY = new THREE.Color(0x87ceeb);
const SUNSET = new THREE.Color(0xe8743b);

export class Sky {
  constructor(scene, materials, camera) {
    this.scene = scene;
    this.materials = materials; // { blockMaterial, waterMaterial }
    this.camera = camera;
    this.time = 0.3; // fraction de journée [0,1) ; on démarre en matinée

    // Brouillard (couleur mise à jour dynamiquement).
    const far = RENDER_DISTANCE * CHUNK_SIZE;
    scene.fog = new THREE.Fog(DAY.clone(), far * 0.55, far * 0.95);
    scene.background = DAY.clone();

    // Réglages (modifiables via les options).
    this.brightness = 1;
    this.fogEnabled = true;
    this.dayLength = DAY_LENGTH;
    this.weatherEnabled = true;
    this._fogNear = far * 0.55;
    this._fogFar = far * 0.95;

    // Lumières (pour les meshes non-shader : avatar, bras, highlight).
    this.sun = new THREE.DirectionalLight(0xffffff, 1.0);
    scene.add(this.sun);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(this.ambient);

    // Groupe céleste qui suit la caméra (soleil, lune, étoiles, nuages).
    this.dome = new THREE.Group();
    scene.add(this.dome);

    this._buildStars();
    this._buildSunMoon();
    this._buildClouds();
    this._buildRain();

    // Météo : alterne ciel clair / pluie.
    this.raining = false;
    this.weatherTimer = 40 + Math.random() * 40;
  }

  _buildRain() {
    const N = 800;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 30 - 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMat = new THREE.PointsMaterial({
      color: 0xaecbe6, size: 2.2, sizeAttenuation: false,
      transparent: true, opacity: 0.6, depthWrite: false, fog: true,
    });
    this.rain = new THREE.Points(geo, this.rainMat);
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  _updateWeather(dt) {
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.raining = !this.raining;
      this.weatherTimer = this.raining ? 25 + Math.random() * 25 : 60 + Math.random() * 60;
    }
    this.rain.visible = this.raining;
    if (!this.raining) return;

    // La nappe de pluie suit la caméra ; les gouttes tombent et bouclent.
    this.rain.position.set(this.camera.position.x, this.camera.position.y, this.camera.position.z);
    const p = this.rain.geometry.attributes.position;
    const arr = p.array;
    for (let i = 1; i < arr.length; i += 3) {
      arr[i] -= 28 * dt;
      if (arr[i] < -15) arr[i] += 30;
    }
    p.needsUpdate = true;
  }

  _buildStars() {
    const N = 700;
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // Points répartis sur une demi-sphère haute.
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const y = Math.abs(u) * 0.9 + 0.1;
      positions[i * 3] = Math.cos(theta) * r * DOME_RADIUS;
      positions[i * 3 + 1] = y * DOME_RADIUS;
      positions[i * 3 + 2] = Math.sin(theta) * r * DOME_RADIUS;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.2, sizeAttenuation: false,
      transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    this.stars = new THREE.Points(geo, this.starsMat);
    this.dome.add(this.stars);
  }

  _buildSunMoon() {
    this.sunSprite = makeDiscSprite(0xfff2a8, 14);
    this.moonSprite = makeDiscSprite(0xdfe6f0, 10);
    this.dome.add(this.sunSprite);
    this.dome.add(this.moonSprite);
  }

  _buildClouds() {
    const tex = makeCloudTexture();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    this.cloudTex = tex;
    const geo = new THREE.PlaneGeometry(DOME_RADIUS * 4, DOME_RADIUS * 4);
    geo.rotateX(-Math.PI / 2);
    this.cloudMat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.8, depthWrite: false,
    });
    this.clouds = new THREE.Mesh(geo, this.cloudMat);
    this.clouds.position.y = CHUNK_SIZE * 0 + 64; // au-dessus du terrain
    this.dome.add(this.clouds);
  }

  setFogDistance(far) {
    this._fogNear = far * 0.55;
    this._fogFar = far * 0.95;
  }

  update(dt) {
    this.time = (this.time + dt / this.dayLength) % 1;

    // Le dôme suit la caméra pour que le ciel reste « à l'infini ».
    this.dome.position.copy(this.camera.position);
    this.clouds.position.y = this.camera.position.y + 64;

    // Position du soleil : lever à l'est (.25), zénith à midi (.5), coucher (.75).
    const ang = this.time * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.sin(ang), -Math.cos(ang), 0.25).normalize();
    const dayFactor = THREE.MathUtils.clamp(sunDir.y, 0, 1);

    // Soleil / lune placés sur le dôme.
    this.sunSprite.position.copy(sunDir).multiplyScalar(DOME_RADIUS);
    this.moonSprite.position.copy(sunDir).multiplyScalar(-DOME_RADIUS);
    this.sunSprite.material.opacity = THREE.MathUtils.clamp(sunDir.y * 4 + 0.2, 0, 1);
    this.moonSprite.material.opacity = THREE.MathUtils.clamp(-sunDir.y * 4 + 0.2, 0, 1);

    // Couleur du ciel : nuit -> jour, avec teinte coucher près de l'horizon.
    const t = smoothstep(0, 0.3, dayFactor);
    const sky = NIGHT.clone().lerp(DAY, t);
    const sunset = THREE.MathUtils.clamp(1 - Math.abs(sunDir.y) / 0.22, 0, 1);
    sky.lerp(SUNSET, sunset * 0.6 * (dayFactor > -0.1 ? 1 : 0));
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(sky);
    if (this.fogEnabled) {
      this.scene.fog.near = this._fogNear;
      this.scene.fog.far = this._fogFar;
    } else {
      this.scene.fog.near = 1e5;
      this.scene.fog.far = 1e5 + 1;
    }

    // Lumières scène (modulées par la luminosité).
    const b = this.brightness;
    this.sun.position.copy(sunDir).multiplyScalar(100);
    this.sun.intensity = (0.2 + dayFactor * 0.9) * b;
    this.ambient.intensity = (0.25 + dayFactor * 0.35) * b;

    // Éclairage du shader des blocs : direction du soleil + ambiant variable.
    const amb = Math.min(1, (0.25 + dayFactor * 0.25) * b);
    for (const m of [this.materials.blockMaterial, this.materials.waterMaterial]) {
      m.uniforms.uLightDir.value.copy(sunDir);
      m.uniforms.uAmbient.value = amb;
    }

    // Étoiles visibles la nuit ; rotation lente du dôme.
    this.starsMat.opacity = 1 - smoothstep(0, 0.18, dayFactor);
    this.dome.rotation.y += dt * 0.005;

    // Dérive des nuages.
    this.cloudTex.offset.x += dt * 0.004;
    this.cloudMat.opacity = 0.5 + dayFactor * 0.4;

    // Météo (pluie) : assombrit et grise le ciel.
    if (this.weatherEnabled) this._updateWeather(dt);
    else { this.raining = false; this.rain.visible = false; }
    if (this.raining) {
      const grey = new THREE.Color(0x6a7480);
      this.scene.background.lerp(grey, 0.55);
      this.scene.fog.color.copy(this.scene.background);
      this.sun.intensity *= 0.5;
      this.ambient.intensity *= 0.85;
      for (const m of [this.materials.blockMaterial, this.materials.waterMaterial]) {
        m.uniforms.uAmbient.value *= 0.8;
      }
      this.cloudMat.opacity = Math.min(1, this.cloudMat.opacity + 0.3);
    }
  }
}

function smoothstep(a, b, x) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Sprite disque dégradé (soleil / lune).
function makeDiscSprite(color, size) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(color);
  const r = (col.r * 255) | 0, g = (col.g * 255) | 0, b = (col.b * 255) | 0;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.6, `rgba(${r},${g},${b},0.9)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  return sprite;
}

// Texture de nuages : taches blanches douces sur fond transparent.
function makeCloudTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const rad = 18 + Math.random() * 40;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return new THREE.CanvasTexture(c);
}
