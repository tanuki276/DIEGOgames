import * as THREE from 'three';
import { GOAL_HEIGHT, STAGES } from './constants.js';
import { StaticBatcher } from './batcher.js';
import { buildAllStageScenery } from './scenery.js';

function createDiscTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, size / 2, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? '#ffa6d6' : '#fff3a8';
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.32, a, a + 0.7);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createStripeTexture(colorA = '#ff6b8b', colorB = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colorA;
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = colorB;
  for (let x = -64; x < 192; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 14, 0);
    ctx.lineTo(x + 42, 64);
    ctx.lineTo(x + 28, 64);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBounceTopTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  ctx.fillStyle = '#ff5e8a';
  ctx.fillRect(0, 0, size, size);
  for (const [r, c] of [[58, '#fff275'], [46, '#ff5e8a'], [30, '#ffffff'], [16, '#ff7fa6']]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSignTexture(stageNum, stageName, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, 144, 28);
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = accent;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = '900 32px "Hiragino Maru Gothic ProN", "Yu Gothic", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`STAGE ${stageNum}`, 256, 52);

  ctx.fillStyle = '#1f2d42';
  ctx.font = '900 44px "Hiragino Maru Gothic ProN", "Yu Gothic", system-ui, sans-serif';
  ctx.fillText(stageName, 256, 108);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Course {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.batcher = new StaticBatcher();
    this.platforms = [];
    this.rotatingBars = [];
    this.pendulums = [];
    this.vineSwings = [];
    this.fireGeysers = [];
    this.fireJets = [];
    this.flags = [];
    this.bounceVisuals = [];
    this.clouds = null;
    this.cloudData = [];
    this.crown = null;
    this.crownHalo = null;
    this.crownPos = new THREE.Vector3(15.0, 101.4, -10.0);
    this.time = 0;

    // Shared materials & textures for dynamic objects (low draw calls!)
    this.matCache = new Map();
    this.discTex = createDiscTexture();
    this.stripeTex = createStripeTexture('#ff6b8b', '#ffffff');
    this.hammerTex = createStripeTexture('#ff85a8', '#fff4a3');
    this.bounceTex = createBounceTopTexture();
    this.flameMatOuter = new THREE.MeshBasicMaterial({ color: 0xff6b24, transparent: true, opacity: 0.85 });
    this.flameMatInner = new THREE.MeshBasicMaterial({ color: 0xffe45e, transparent: true, opacity: 0.92 });
    this.warnMat = new THREE.MeshBasicMaterial({ color: 0xff9d2e, transparent: true, opacity: 0.7 });

    this._buildAllStages();
    buildAllStageScenery(this.batcher);
    this.batcher.finalize(this.group);
    this._buildClouds();
    this._buildCrown();
  }

  _mat(color, roughness = 0.52, metalness = 0.04) {
    const key = `${color}_${roughness}_${metalness}`;
    if (!this.matCache.has(key)) {
      this.matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    }
    return this.matCache.get(key);
  }

  // Static Box (baked into StaticBatcher -> 0 extra draw calls!)
  _addStaticBox(id, stageId, x, topY, z, w, h, d, color, trimColor, extra = {}) {
    const bucket = extra.bucket || (extra.slippery ? 'glossy' : 'matte');
    this.batcher.addTrimmedBox(bucket, x, topY, z, w, h, d, color, trimColor);
    const plat = {
      id, stageId, shape: 'box',
      x, topY, z, baseX: x, baseTopY: topY, baseZ: z,
      prevX: x, prevTopY: topY, prevZ: z,
      w, h, d, mesh: null,
      slippery: Boolean(extra.slippery),
      isGround: Boolean(extra.isGround),
      ...extra,
    };
    this.platforms.push(plat);
    return plat;
  }

  // Static Cylinder (baked into StaticBatcher -> 0 extra draw calls!)
  _addStaticCyl(id, stageId, x, topY, z, r, h, color, trimColor, extra = {}) {
    const bucket = extra.bucket || (extra.slippery ? 'glossy' : 'matte');
    this.batcher.addTrimmedCyl(bucket, x, topY, z, r, h, color, trimColor);
    const plat = {
      id, stageId, shape: 'cylinder',
      x, topY, z, baseX: x, baseTopY: topY, baseZ: z,
      prevX: x, prevTopY: topY, prevZ: z,
      r, h, mesh: null,
      slippery: Boolean(extra.slippery),
      isGround: Boolean(extra.isGround),
      ...extra,
    };
    this.platforms.push(plat);
    return plat;
  }

  // Dynamic Moving/Floating Box
  _addDynamicBox(id, stageId, x, topY, z, w, h, d, color, trimColor, extra = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this._mat(color, extra.slippery ? 0.16 : 0.48)
    );
    mesh.position.set(x, topY - h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (trimColor) {
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.06, Math.min(0.18, h * 0.28), d + 0.06),
        this._mat(trimColor, 0.42)
      );
      trim.position.y = -h * 0.18;
      mesh.add(trim);
    }
    this.group.add(mesh);
    const plat = {
      id, stageId, shape: 'box',
      x, topY, z, baseX: x, baseTopY: topY, baseZ: z,
      prevX: x, prevTopY: topY, prevZ: z,
      w, h, d, mesh,
      moveAxis: extra.moveAxis || null,
      moveAmp: extra.moveAmp || 0,
      moveSpeed: extra.moveSpeed || 1,
      movePhase: extra.movePhase || 0,
      isFloating: Boolean(extra.isFloating),
      ...extra,
    };
    this.platforms.push(plat);
    return plat;
  }

  // Dynamic Rotating Disc Platform
  _addRotatingDisc(id, stageId, x, topY, z, r, h, spinOmega = 0.75) {
    const sideMat = this._mat(0x4cc797, 0.48);
    const topMat = new THREE.MeshStandardMaterial({ map: this.discTex, roughness: 0.45 });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.03, h, 22), [sideMat, topMat, sideMat]);
    mesh.position.set(x, topY - h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    const plat = {
      id, stageId, shape: 'cylinder',
      x, topY, z, baseX: x, baseTopY: topY, baseZ: z,
      prevX: x, prevTopY: topY, prevZ: z,
      r, h, mesh, spinOmega,
    };
    this.platforms.push(plat);
    return plat;
  }

  // Dynamic Bounce Pad
  _addBouncePad(id, stageId, x, topY, z, r, h = 0.28, bounceVy = 16.5) {
    const drumGroup = new THREE.Group();
    drumGroup.position.set(x, topY - h / 2, z);

    const drumMats = [
      this._mat(0xff5e8a, 0.4),
      new THREE.MeshStandardMaterial({ map: this.bounceTex, roughness: 0.35 }),
      this._mat(0xff5e8a, 0.4),
    ];
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, h, 20), drumMats);
    drum.castShadow = true;
    drum.receiveShadow = true;
    drumGroup.add(drum);

    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xfff58a, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const pulse = new THREE.Mesh(new THREE.RingGeometry(r * 0.72, r * 1.08, 20), pulseMat);
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.y = h / 2 + 0.05;
    drumGroup.add(pulse);

    this.group.add(drumGroup);
    const visual = { group: drumGroup, pulse, pulseMat, animT: 0, active: false };
    this.bounceVisuals.push(visual);

    const plat = {
      id, stageId, shape: 'cylinder',
      x, topY, z, baseX: x, baseTopY: topY, baseZ: z,
      prevX: x, prevTopY: topY, prevZ: z,
      r, h, mesh: drumGroup,
      isBouncePad: true, bounceVy, bounceVisual: visual,
    };
    this.platforms.push(plat);
    return plat;
  }

  // Dynamic Seesaw (supports tiltAxis 'x' or 'z')
  _addSeesaw(id, stageId, x, pivotTopY, z, w, h, d, tiltAxis = 'z', maxAngle = 0.36, color = 0xb794ff) {
    // Static fulcrum baked into batcher!
    if (tiltAxis === 'x') {
      this.batcher.addCyl('matte', x, pivotTopY - h - 0.14, z, 0.28, d + 0.4, 0xffffff, Math.PI / 2, 0, 0, true);
    } else {
      this.batcher.addCyl('matte', x, pivotTopY - h - 0.14, z, 0.28, w + 0.4, 0xffffff, 0, 0, Math.PI / 2, true);
    }

    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(x, pivotTopY - h / 2, z);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._mat(color, 0.46));
    plank.castShadow = true;
    plank.receiveShadow = true;
    pivotGroup.add(plank);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(tiltAxis === 'x' ? 0.24 : w + 0.04, h + 0.02, tiltAxis === 'x' ? d + 0.04 : 0.24),
      this._mat(0xffffff, 0.35)
    );
    pivotGroup.add(stripe);
    this.group.add(pivotGroup);

    const plat = {
      id, stageId, shape: 'seesaw', tiltAxis,
      x, topY: pivotTopY, z, baseX: x, baseTopY: pivotTopY, baseZ: z,
      prevX: x, prevTopY: pivotTopY, prevZ: z,
      w, h, d, angle: 0, prevAngle: 0, angVel: 0, maxAngle, torqueInput: 0,
      mesh: pivotGroup,
    };
    this.platforms.push(plat);
    return plat;
  }

  // NEW GIMMICK: Vine Swing Platform (swings smoothly on overhead vine rope!)
  _addVineSwing(id, stageId, pivotX, pivotY, pivotZ, armLen, w, h, d, swingAxis = 'z', swingAmp = 0.36, speed = 1.25, phase = 0) {
    // Overhead branch anchor baked into batcher
    this.batcher.addCyl('matte', pivotX, pivotY, pivotZ, 0.24, 3.6, 0x6b4426, swingAxis === 'z' ? 0 : Math.PI / 2, 0, swingAxis === 'z' ? Math.PI / 2 : 0, true);

    const ropePivot = new THREE.Group();
    ropePivot.position.set(pivotX, pivotY, pivotZ);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, armLen, 8), this._mat(0x3ba854, 0.6));
    rope.position.y = -armLen / 2;
    ropePivot.add(rope);
    this.group.add(ropePivot);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._mat(0x9c6e44, 0.55));
    deck.castShadow = true;
    deck.receiveShadow = true;
    const mossRim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.14, d + 0.06), this._mat(0x4ec96f, 0.5));
    mossRim.position.y = h * 0.32;
    deck.add(mossRim);
    this.group.add(deck);

    const startY = pivotY - armLen;
    deck.position.set(pivotX, startY - h / 2, pivotZ);

    const plat = {
      id, stageId, shape: 'box', isVineSwing: true,
      x: pivotX, topY: startY, z: pivotZ,
      baseX: pivotX, baseTopY: startY, baseZ: pivotZ,
      prevX: pivotX, prevTopY: startY, prevZ: pivotZ,
      w, h, d, mesh: deck,
      pivotX, pivotY, pivotZ, armLen, swingAxis, swingAmp, speed, phase,
      ropePivot,
    };
    this.platforms.push(plat);
    this.vineSwings.push(plat);
    return plat;
  }

  // NEW GIMMICK: Fire Geyser (periodic upward flame bounce!)
  _addFireGeyser(id, stageId, x, topY, z, r = 1.35, h = 0.28, bounceVy = 16.5, cycle = 3.0, onDuration = 1.25, phase = 0) {
    const group = new THREE.Group();
    group.position.set(x, topY - h / 2, z);

    const vent = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.12, h, 16), this._mat(0x3d2a30, 0.65));
    vent.castShadow = true;
    vent.receiveShadow = true;
    group.add(vent);

    const coreGlow = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r * 0.72, 0.08, 14), this.warnMat);
    coreGlow.position.y = h / 2 + 0.02;
    group.add(coreGlow);

    // Tall flame plume (visible & animated during eruption!)
    const plumeGroup = new THREE.Group();
    plumeGroup.position.y = h / 2;
    const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(r * 0.85, 3.6, 12), this.flameMatOuter);
    outerFlame.position.y = 1.8;
    const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(r * 0.48, 2.7, 10), this.flameMatInner);
    innerFlame.position.y = 1.35;
    plumeGroup.add(outerFlame, innerFlame);
    plumeGroup.visible = false;
    group.add(plumeGroup);

    this.group.add(group);

    const plat = {
      id, stageId, shape: 'cylinder', isFireGeyser: true,
      x, topY, z, baseX: x, baseTopY: topY, baseZ: z,
      prevX: x, prevTopY: topY, prevZ: z,
      r, h, mesh: group,
      bounceVy, cycle, onDuration, phase,
      erupting: false, warning: false,
      plumeGroup, coreGlow,
    };
    this.platforms.push(plat);
    this.fireGeysers.push(plat);
    return plat;
  }

  // NEW GIMMICK: Horizontal Fire Jet (periodic knockback flame beam)
  _addFireJet(stageId, x, y, z, dirX, dirZ, length = 5.0, cycle = 3.2, onDuration = 1.0, phase = 0) {
    // Nozzle mounted on side baked into batcher
    this.batcher.addBox('matte', x - dirX * 0.35, y, z - dirZ * 0.35, 0.75, 0.75, 0.75, 0x453138);
    this.batcher.addSphere('emissive', x, y, z, 0.28, 0.28, 0.28, 0xff7b29);

    const beamGroup = new THREE.Group();
    beamGroup.position.set(x, y, z);
    const angleY = Math.atan2(dirX, dirZ);
    beamGroup.rotation.y = angleY;

    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.46, length, 10), this.flameMatOuter);
    outer.rotation.x = Math.PI / 2;
    outer.position.z = length * 0.5;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.24, length * 0.9, 8), this.flameMatInner);
    inner.rotation.x = Math.PI / 2;
    inner.position.z = length * 0.45;
    beamGroup.add(outer, inner);
    beamGroup.visible = false;
    this.group.add(beamGroup);

    this.fireJets.push({
      stageId, x, y, z, dirX, dirZ, length, radius: 0.42,
      cycle, onDuration, phase, active: false, beamGroup,
    });
  }

  // Rotating Sweeper Bar
  _addRotatingBar(id, stageId, x, y, z, halfLength, barRadius, omega, hubRadius, floorY) {
    const hubH = (y - floorY) + 0.8;
    this._addStaticCyl(`${id}_hub`, stageId, x, floorY + hubH, z, hubRadius, hubH, 0xffe066, 0xffb703);

    const barGroup = new THREE.Group();
    barGroup.position.set(x, y, z);
    const barMat = new THREE.MeshStandardMaterial({ map: this.stripeTex, roughness: 0.38 });
    const barGeo = new THREE.CylinderGeometry(barRadius, barRadius, halfLength * 2, 14);
    barGeo.rotateZ(Math.PI / 2);
    const barMesh = new THREE.Mesh(barGeo, barMat);
    barMesh.castShadow = true;
    barGroup.add(barMesh);

    const capMat = this._mat(0xffe066, 0.35);
    for (const sign of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(barRadius * 1.18, 10, 8), capMat);
      cap.position.x = sign * halfLength;
      barGroup.add(cap);
    }
    this.group.add(barGroup);
    this.rotatingBars.push({ id, stageId, x, y, z, halfLength, barRadius, omega, angle: 0, mesh: barGroup });
  }

  // Pendulum Hammer (supports swingAxis 'x' or 'z')
  _addPendulumHammer(stageId, x, pivotY, z, armLength, swingAxis = 'z', swingAmp = 0.92, speed = 1.65) {
    // Overhead bar baked into batcher
    if (swingAxis === 'z') {
      this.batcher.addCyl('matte', x, pivotY, z, 0.14, 4.2, 0xffffff, Math.PI / 2, 0, 0, true);
    } else {
      this.batcher.addCyl('matte', x, pivotY, z, 0.14, 4.2, 0xffffff, 0, 0, Math.PI / 2, true);
    }

    const armGroup = new THREE.Group();
    armGroup.position.set(x, pivotY, z);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, armLength, 8), this._mat(0xeef5ff, 0.35));
    rod.position.y = -armLength / 2;
    armGroup.add(rod);

    const headRadius = 0.42;
    const headLen = 1.0;
    const headMat = new THREE.MeshStandardMaterial({ map: this.hammerTex, roughness: 0.4 });
    const head = new THREE.Mesh(new THREE.CylinderGeometry(headRadius, headRadius, headLen, 14), headMat);
    if (swingAxis === 'z') head.rotation.x = Math.PI / 2;
    else head.rotation.z = Math.PI / 2;
    head.position.y = -armLength;
    head.castShadow = true;
    armGroup.add(head);

    this.group.add(armGroup);
    this.pendulums.push({
      stageId, x, pivotY, z, armLength, swingAxis, swingAmp, speed,
      headRadius, headHalfLen: headLen / 2,
      angle: 0, prevAngle: 0,
      headX: x, headY: pivotY - armLength, headZ: z,
      mesh: armGroup,
    });
  }

  // Stage Entrance Arch + Signboard
  _addStageArch(stageNum, x, baseY, z, yaw) {
    const st = STAGES[stageNum - 1];
    const accentHex = parseInt(st.accent.replace('#', ''), 16);
    this.batcher.addArch('matte', x, baseY, z, yaw, 0xffffff, accentHex, 4.0, 3.4);

    // Canvas signboard mounted above arch (1 draw call per stage = 10 total)
    const signTex = createSignTexture(stageNum, st.name, st.accent);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, transparent: true });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.06), signMat);
    sign.position.set(x, baseY + 4.25, z);
    sign.rotation.y = yaw;
    this.group.add(sign);
  }

  // Stage Milestone Flag
  _addFlag(stageNum, x, baseY, z, label, color) {
    const pct = Math.min(99, Math.round((baseY / GOAL_HEIGHT) * 100));
    const flagGroup = new THREE.Group();
    flagGroup.position.set(x, baseY, z);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 2.2, 8), this._mat(0xffffff, 0.35));
    pole.position.y = 1.1;
    flagGroup.add(pole);

    const triShape = new THREE.Shape();
    triShape.moveTo(0, 0.35);
    triShape.lineTo(1.05, 0.02);
    triShape.lineTo(0, -0.32);
    triShape.closePath();
    const pennantMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, side: THREE.DoubleSide });
    const pennant = new THREE.Mesh(new THREE.ShapeGeometry(triShape), pennantMat);
    pennant.position.set(0.05, 1.82, 0);
    flagGroup.add(pennant);

    this.group.add(flagGroup);
    this.flags.push({
      stageNum, x, y: baseY, z, pct, label,
      reached: false, popAnim: 0,
      group: flagGroup, pennant, pennantMat, origColor: color,
    });
  }

  _buildAllStages() {
    // =========================================================================
    // STAGE 1: 青空草原 (0.0m -> 10.0m, x=0, z: +6 -> -26)
    // =========================================================================
    this._addStaticCyl('ground', 1, 15, 0.0, -10, 85, 2.4, 0x9be7c4, 0x76d6aa, { isGround: true });
    this._addStageArch(1, 0, 0.0, 2.5, 0);
    this._addStaticBox('st1_s1', 1, 0, 1.1, -0.5, 4.6, 1.1, 3.0, 0xffb38a, 0xff9362);
    this._addStaticBox('st1_s2', 1, 0, 2.2, -3.7, 4.4, 1.1, 2.8, 0xffb38a, 0xff9362);
    this._addStaticBox('st1_s3', 1, 0, 3.3, -6.9, 4.4, 1.1, 2.8, 0xffb38a, 0xff9362);
    this._addStaticCyl('st1_j1', 1, -1.6, 4.5, -10.5, 1.6, 0.8, 0xffe478, 0xffcf48);
    this._addStaticCyl('st1_j2', 1, 1.6, 5.7, -13.5, 1.6, 0.8, 0xffe478, 0xffcf48);
    this._addStaticBox('st1_j3', 1, 0, 6.8, -16.7, 3.8, 0.8, 2.8, 0x7de8d2, 0x4fd4ba);
    this._addDynamicBox('st1_move', 1, 0, 7.8, -20.3, 3.6, 0.7, 2.6, 0x7de8d2, 0x4fd4ba, {
      moveAxis: 'x', moveAmp: 2.8, moveSpeed: 0.9, movePhase: 0,
    });
    this._addStaticBox('st1_exit', 1, 0, 9.0, -25.2, 4.2, 0.9, 4.4, 0xa8f0c6, 0x56c77a);
    this._addFlag(1, -1.2, 9.0, -24.5, 'STAGE 1 クリア！', 0x4ec97b);

    // =========================================================================
    // STAGE 2: お菓子工場 (10.0m -> 20.0m, z=-26, x: 2.4 -> 30)
    // =========================================================================
    this._addStaticBox('st2_base', 2, 16.2, 10.0, -26.0, 27.6, 1.0, 9.6, 0xffc6df, 0xff8fb8);
    this._addStageArch(2, 4.2, 10.0, -26.0, -Math.PI / 2);
    this._addBouncePad('st2_b1', 2, 7.0, 10.15, -26.0, 1.25, 0.28, 16.5);
    this._addStaticCyl('st2_mid1', 2, 12.6, 13.4, -26.0, 2.25, 0.7, 0xff9ec4, 0xff6b9e);
    this._addBouncePad('st2_b2', 2, 12.6, 13.55, -26.0, 1.6, 0.28, 16.5);
    this._addStaticBox('st2_mid2', 2, 18.2, 16.8, -26.0, 3.8, 0.8, 3.8, 0xffe49e, 0xffc857);
    this._addSeesaw('st2_seesaw', 2, 22.3, 16.95, -26.0, 4.2, 0.45, 2.4, 'x', 0.30, 0xff8fc4);
    this._addStaticCyl('st2_arena', 2, 28.0, 17.6, -26.0, 3.2, 0.9, 0xffb3d6, 0xff78b2);
    this._addRotatingBar('st2_bar', 2, 28.0, 18.22, -26.0, 2.7, 0.22, 1.4, 0.6, 17.6);
    this._addStaticBox('st2_exit', 2, 30.0, 18.8, -21.6, 4.0, 0.8, 2.8, 0xffe5f1, 0xff70a6);
    this._addFlag(2, 31.2, 18.8, -21.6, 'STAGE 2 クリア！', 0xff6ba6);

    // =========================================================================
    // STAGE 3: 浮遊諸島 (20.0m -> 30.0m, x=30, z: -20.0 -> +6)
    // =========================================================================
    this._addStaticBox('st3_base', 3, 30.0, 20.0, -7.0, 9.6, 1.0, 26.0, 0x9ce8b2, 0x67cc88);
    this._addStageArch(3, 30.0, 20.0, -18.2, Math.PI);
    this._addStaticBox('st3_s1', 3, 30.0, 21.1, -15.5, 3.8, 0.8, 2.8, 0xb2e2ff, 0x6bc2ff);
    this._addDynamicBox('st3_f1', 3, 30.0, 22.8, -11.5, 3.4, 0.7, 2.8, 0x8fd4ff, 0x4cb5ff, {
      moveAxis: 'y', moveAmp: 0.9, moveSpeed: 0.9, movePhase: 0, isFloating: true,
    });
    this._addDynamicBox('st3_f2', 3, 30.0, 24.6, -7.3, 3.4, 0.7, 2.8, 0x8fd4ff, 0x4cb5ff, {
      moveAxis: 'y', moveAmp: 0.9, moveSpeed: 0.9, movePhase: 1.8, isFloating: true,
    });
    this._addDynamicBox('st3_f3', 3, 30.0, 26.4, -3.1, 3.4, 0.7, 2.8, 0x8fd4ff, 0x4cb5ff, {
      moveAxis: 'y', moveAmp: 0.9, moveSpeed: 0.9, movePhase: 3.6, isFloating: true,
    });
    this._addRotatingDisc('st3_disc', 3, 30.0, 27.9, 1.5, 2.8, 0.7, 0.75);
    this._addStaticBox('st3_exit', 3, 30.0, 29.0, 6.0, 4.0, 0.8, 3.4, 0xd4f2ff, 0x48b8ff);
    this._addFlag(3, 31.2, 29.0, 6.8, 'STAGE 3 クリア！', 0x48b8ff);

    // =========================================================================
    // STAGE 4: 水上の港 (30.0m -> 40.0m, z=+6, x: 27.6 -> 0)
    // =========================================================================
    // Shimmering aqua water base (solid safety water floor at 30.0m!)
    this._addStaticBox('st4_base', 4, 13.8, 30.0, 6.0, 27.6, 0.8, 9.6, 0x49c6e8, null, { bucket: 'water' });
    this._addStaticBox('st4_pier', 4, 25.4, 30.2, 6.0, 4.4, 0.4, 4.6, 0xd9a673, 0xb5804d);
    this._addStageArch(4, 25.4, 30.2, 6.0, Math.PI / 2);
    this._addStaticCyl('st4_buoy1', 4, 21.4, 31.2, 6.0, 1.48, 0.8, 0xff8a7a, 0xffffff);
    this._addStaticCyl('st4_buoy2', 4, 17.6, 32.3, 4.8, 1.48, 0.8, 0xffe066, 0xffffff);
    this._addStaticCyl('st4_buoy3', 4, 13.8, 33.4, 6.0, 1.48, 0.8, 0x72e0d2, 0xffffff);
    this._addStaticBox('st4_beam', 4, 9.2, 34.2, 6.0, 6.4, 0.5, 0.9, 0xd49c66, 0xa87442);
    this._addDynamicBox('st4_elev', 4, 3.8, 36.6, 6.0, 3.2, 0.7, 3.2, 0x7de8d2, 0x2bb8d6, {
      moveAxis: 'y', moveAmp: 2.4, moveSpeed: 0.88, movePhase: -Math.PI / 2,
    });
    this._addStaticBox('st4_exit', 4, 0.0, 39.0, 6.0, 3.6, 0.8, 3.6, 0xe8c499, 0x2bb8d6);
    this._addFlag(4, -1.0, 39.0, 6.8, 'STAGE 4 クリア！', 0x2bb8d6);

    // =========================================================================
    // STAGE 5: ツタの密林 (40.0m -> 50.0m, x=0, z: +3.8 -> -26)
    // =========================================================================
    this._addStaticBox('st5_base', 5, 0.0, 40.0, -11.1, 9.6, 1.0, 29.8, 0x62bd6e, 0x3b8f49);
    this._addStageArch(5, 0.0, 40.0, 2.0, 0);
    this._addStaticBox('st5_s1', 5, 0.0, 41.1, -0.8, 3.8, 0.8, 2.8, 0x99cc66, 0x6ba33e);
    this._addVineSwing('st5_swing1', 5, 0.0, 47.4, -5.0, 5.4, 3.2, 0.45, 2.6, 'z', 0.36, 1.2, 0);
    this._addStaticCyl('st5_leaf1', 5, 0.0, 43.2, -9.4, 1.75, 0.7, 0x76d672, 0x45a84b);
    this._addVineSwing('st5_swing2', 5, 0.0, 49.5, -13.6, 5.4, 3.2, 0.45, 2.6, 'z', 0.36, 1.2, 2.0);
    this._addStaticCyl('st5_leaf2', 5, -1.3, 45.4, -17.6, 1.5, 0.7, 0x8be072, 0x52b548);
    this._addStaticCyl('st5_leaf3', 5, 1.3, 46.5, -20.2, 1.5, 0.7, 0x8be072, 0x52b548);
    this._addSeesaw('st5_seesaw', 5, 0.0, 47.6, -23.0, 2.4, 0.45, 4.0, 'z', 0.34, 0xa3784a);
    this._addStaticBox('st5_exit', 5, 0.0, 49.0, -26.4, 4.0, 0.8, 3.2, 0x9ee082, 0x41b86d);
    this._addFlag(5, -1.2, 49.0, -26.4, 'STAGE 5 クリア！', 0x41b86d);

    // =========================================================================
    // STAGE 6: 氷の山 (50.0m -> 60.0m, z=-26, x: 2.4 -> 30)
    // =========================================================================
    this._addStaticBox('st6_base', 6, 16.2, 50.0, -26.0, 27.6, 1.0, 9.6, 0xdff5ff, 0x9cd8f5);
    this._addStageArch(6, 4.2, 50.0, -26.0, -Math.PI / 2);
    this._addStaticBox('st6_i1', 6, 6.8, 51.1, -26.0, 3.4, 0.8, 3.2, 0xa8e6ff, 0x6bc4ff, { slippery: true });
    this._addStaticBox('st6_i2', 6, 10.8, 52.2, -26.0, 3.4, 0.8, 3.2, 0xa8e6ff, 0x6bc4ff, { slippery: true });
    this._addStaticCyl('st6_sp1', 6, 14.2, 53.4, -24.2, 1.65, 0.7, 0x9be2ff, 0x5bb8f5, { slippery: true });
    this._addStaticCyl('st6_sp2', 6, 17.4, 54.6, -26.0, 1.65, 0.7, 0x9be2ff, 0x5bb8f5, { slippery: true });
    this._addStaticCyl('st6_sp3', 6, 19.8, 55.8, -28.0, 1.65, 0.7, 0x9be2ff, 0x5bb8f5, { slippery: true });
    this._addStaticBox('st6_beam_in', 6, 21.8, 56.8, -26.0, 2.8, 0.7, 3.0, 0xb8ecff, 0x6bc4ff, { slippery: true });
    this._addStaticBox('st6_beam', 6, 26.2, 57.9, -26.0, 5.6, 0.5, 0.95, 0x8cdbff, 0x4eb3f2, { slippery: true });
    this._addStaticBox('st6_catch_n', 6, 26.2, 56.7, -28.2, 5.0, 0.5, 2.0, 0xebf8ff, 0xb8e4ff);
    this._addStaticBox('st6_catch_s', 6, 26.2, 56.7, -23.8, 5.0, 0.5, 2.0, 0xebf8ff, 0xb8e4ff);
    this._addStaticBox('st6_exit', 6, 30.0, 59.0, -23.0, 3.8, 0.8, 4.4, 0xc9f0ff, 0x6bc4ff);
    this._addFlag(6, 31.1, 59.0, -22.0, 'STAGE 6 クリア！', 0x6bc4ff);

    // =========================================================================
    // STAGE 7: 炎の火山 (60.0m -> 70.0m, x=30, z: -20.0 -> +6)
    // =========================================================================
    this._addStaticBox('st7_base', 7, 30.0, 60.0, -7.0, 9.6, 1.0, 26.0, 0x5c4045, 0x3b262a);
    this._addStageArch(7, 30.0, 60.0, -18.2, Math.PI);
    this._addStaticBox('st7_s1', 7, 30.0, 61.0, -15.4, 4.0, 0.8, 3.6, 0x7a504b, 0xff7038);
    this._addFireGeyser('st7_geyser1', 7, 30.0, 61.15, -14.6, 1.35, 0.28, 16.5, 3.0, 1.3, 0);
    this._addStaticBox('st7_mid1', 7, 30.0, 64.4, -8.8, 4.2, 0.9, 5.2, 0x734a47, 0xff7c3b);
    this._addFireJet(7, 27.4, 65.1, -8.4, 1, 0, 5.2, 3.2, 0.95, 0.4);
    this._addFireGeyser('st7_geyser2', 7, 30.0, 64.55, -7.0, 1.35, 0.28, 16.5, 3.0, 1.3, 1.2);
    this._addStaticBox('st7_mid2', 7, 30.0, 67.8, -1.2, 4.2, 0.9, 5.2, 0x734a47, 0xff7c3b);
    this._addFireJet(7, 32.6, 68.5, -0.6, -1, 0, 5.2, 3.2, 0.95, 1.8);
    this._addStaticBox('st7_exit', 7, 30.0, 69.0, 4.8, 4.0, 0.8, 4.0, 0x8a564c, 0xff6633);
    this._addFlag(7, 31.2, 69.0, 6.0, 'STAGE 7 クリア！', 0xff6633);

    // =========================================================================
    // STAGE 8: おもちゃ箱 (70.0m -> 80.0m, z=+6, x: 27.6 -> 0)
    // =========================================================================
    this._addStaticBox('st8_base', 8, 13.8, 70.0, 6.0, 27.6, 1.0, 9.6, 0xfff0b8, 0xffc857);
    this._addStageArch(8, 25.8, 70.0, 6.0, Math.PI / 2);
    this._addStaticBox('st8_s1', 8, 23.6, 71.1, 6.0, 2.8, 1.1, 3.4, 0xff6b7a, 0xff4257);
    this._addStaticCyl('st8_arena', 8, 18.0, 72.2, 6.0, 4.2, 1.0, 0xc59bff, 0xa26ef7);
    this._addRotatingBar('st8_bar', 8, 18.0, 72.82, 6.0, 3.65, 0.24, 1.5, 0.72, 72.2);
    this._addStaticBox('st8_bridge', 8, 11.0, 73.4, 6.0, 4.4, 0.7, 2.2, 0x72d6ff, 0x3eb8f0);
    this._addPendulumHammer(8, 11.0, 77.6, 6.0, 3.3, 'z', 0.92, 1.65);
    this._addRotatingDisc('st8_disc', 8, 6.2, 74.6, 6.0, 2.4, 0.7, 0.75);
    this._addStaticCyl('st8_u1', 8, 3.0, 75.8, 8.2, 1.5, 0.7, 0xffe066, 0xffb703);
    this._addStaticCyl('st8_u2', 8, 0.0, 77.0, 8.8, 1.5, 0.7, 0x72efdd, 0x38d39f);
    this._addStaticCyl('st8_u3', 8, -3.2, 78.0, 6.2, 1.45, 0.7, 0xff9ec4, 0xff5e8a);
    this._addStaticBox('st8_exit', 8, 0.0, 79.0, 5.2, 3.4, 0.8, 2.8, 0xffe484, 0xffae2b);
    this._addFlag(8, -1.0, 79.0, 5.2, 'STAGE 8 クリア！', 0xffae2b);

    // =========================================================================
    // STAGE 9: 機械工場 (80.0m -> 90.0m, x=0, z: +3.4 -> -26)
    // =========================================================================
    this._addStaticBox('st9_base', 9, 0.0, 80.0, -11.3, 9.6, 1.0, 29.4, 0x7a859e, 0x566078);
    this._addStageArch(9, 0.0, 80.0, 1.8, 0);
    this._addDynamicBox('st9_elev1', 9, 0.0, 82.0, -1.6, 3.4, 0.7, 3.2, 0xe8b468, 0xc78938, {
      moveAxis: 'y', moveAmp: 2.0, moveSpeed: 0.9, movePhase: -Math.PI / 2,
    });
    this._addStaticBox('st9_mid1', 9, 0.0, 84.2, -6.2, 4.0, 0.8, 4.4, 0x9aa6bf, 0xe08e45);
    this._addBouncePad('st9_bounce', 9, 0.0, 84.35, -7.2, 1.25, 0.28, 16.5);
    this._addDynamicBox('st9_move', 9, 0.0, 87.4, -12.8, 4.2, 0.7, 3.4, 0xf2c272, 0xd49435, {
      moveAxis: 'x', moveAmp: 2.4, moveSpeed: 0.82, movePhase: 0,
    });
    this._addDynamicBox('st9_elev2', 9, 0.0, 87.9, -16.8, 3.4, 0.7, 3.0, 0x8cc7e8, 0x4f9cc9, {
      moveAxis: 'y', moveAmp: 0.9, moveSpeed: 0.95, movePhase: 0,
    });
    this._addStaticCyl('st9_arena', 9, 0.0, 88.2, -22.2, 3.6, 0.8, 0xb8c2d9, 0xe08e45);
    this._addRotatingBar('st9_bar', 9, 0.0, 88.82, -22.2, 3.1, 0.24, 1.65, 0.65, 88.2);
    this._addStaticBox('st9_exit', 9, 0.0, 89.0, -27.2, 3.8, 0.8, 2.8, 0xd4dced, 0xe08e45);
    this._addFlag(9, -1.1, 89.0, -27.2, 'STAGE 9 クリア！', 0xe08e45);

    // =========================================================================
    // STAGE 10: 天空の王宮・最終決戦 (90.0m -> 100.0m, ALL GIMMICKS!)
    // =========================================================================
    this._addStaticBox('st10_base', 10, 15.0, 90.0, -10.0, 23.6, 1.0, 25.6, 0xfffaf0, 0xf2c94c);
    this._addStaticBox('st10_arrival', 10, 4.8, 90.0, -25.0, 4.6, 1.0, 4.6, 0xfffaf0, 0xf2c94c);
    this._addStageArch(10, 5.8, 90.0, -20.0, -Math.PI / 2);

    // 1. Slippery Ice Runway
    this._addStaticBox('st10_ice', 10, 10.0, 91.0, -20.0, 5.4, 0.7, 2.2, 0xa8e6ff, 0x6bc4ff, { slippery: true });
    // 2. Floating Platform
    this._addDynamicBox('st10_float', 10, 15.6, 92.1, -20.0, 3.2, 0.7, 2.8, 0x9cd8ff, 0xf2c94c, {
      moveAxis: 'y', moveAmp: 0.75, moveSpeed: 0.95, movePhase: 0, isFloating: true,
    });
    // 3. Vine Swing
    this._addVineSwing('st10_swing', 10, 20.0, 98.2, -20.0, 5.4, 2.8, 0.45, 2.8, 'x', 0.34, 1.2, 0);
    // Corner Pier -> 4. Seesaw + Fire Jet
    this._addStaticBox('st10_p1', 10, 23.4, 93.4, -19.2, 3.0, 0.7, 2.6, 0xfff2cc, 0xf2c94c);
    this._addSeesaw('st10_seesaw', 10, 23.4, 93.6, -15.4, 2.4, 0.45, 4.6, 'z', 0.34, 0xc59bff);
    this._addFireJet(10, 25.8, 94.3, -15.4, -1, 0, 4.8, 3.3, 0.95, 0.5);
    // 5. Fire Geyser Launch (94.15 -> 96.8m!)
    this._addStaticBox('st10_p2', 10, 23.4, 94.0, -10.8, 3.6, 0.8, 3.4, 0xffe4b8, 0xff7c3b);
    this._addFireGeyser('st10_geyser', 10, 23.4, 94.15, -10.4, 1.35, 0.28, 16.5, 3.0, 1.3, 0);
    // 6. High Pier -> Moving Platform -> Pendulum Hammer Bridge
    this._addStaticBox('st10_p3', 10, 23.4, 96.8, -4.6, 3.8, 0.8, 4.4, 0xfff4d4, 0xf2c94c);
    this._addDynamicBox('st10_move', 10, 18.6, 96.8, -2.6, 3.4, 0.7, 2.8, 0x7de8d2, 0x4cc797, {
      moveAxis: 'z', moveAmp: 1.8, moveSpeed: 0.85, movePhase: 0,
    });
    this._addStaticBox('st10_ham_bridge', 10, 13.2, 96.8, -2.6, 5.2, 0.7, 2.4, 0xffe599, 0xf2c94c);
    this._addPendulumHammer(10, 13.2, 101.0, -2.6, 3.3, 'z', 0.9, 1.65);
    // 7. Rotating Bar Arena -> Royal Bounce Pad -> 100.0m Crown Summit!
    this._addStaticCyl('st10_arena', 10, 8.0, 96.8, -4.8, 3.2, 0.8, 0xe8c5ff, 0xf2c94c);
    this._addRotatingBar('st10_bar', 10, 8.0, 97.42, -4.8, 2.75, 0.24, 1.5, 0.6, 96.8);
    this._addStaticBox('st10_bpier', 10, 9.8, 96.8, -9.2, 3.0, 0.8, 3.0, 0xfff5d6, 0xffcf33);
    this._addBouncePad('st10_bounce', 10, 9.8, 96.95, -9.2, 1.25, 0.28, 16.5);
    // Final Summit Podium at exact 100.0m!
    this._addStaticCyl('st10_summit', 10, 15.0, 100.0, -10.0, 3.6, 1.0, 0xfff8d6, 0xffcf33, { bucket: 'glossy' });
  }

  _buildCrown() {
    const crownGroup = new THREE.Group();
    crownGroup.position.copy(this.crownPos);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffcf33, roughness: 0.2, metalness: 0.68, emissive: 0x663d00, emissiveIntensity: 0.28,
    });
    const gemPink = new THREE.MeshStandardMaterial({ color: 0xff4f9a, roughness: 0.15, emissive: 0x881144, emissiveIntensity: 0.35 });
    const gemBlue = new THREE.MeshStandardMaterial({ color: 0x3bc9ff, roughness: 0.15, emissive: 0x115588, emissiveIntensity: 0.35 });

    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.58, 0.44, 18), goldMat);
    crownGroup.add(band);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const sx = Math.cos(a) * 0.62;
      const sz = Math.sin(a) * 0.62;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.54, 6), goldMat);
      spike.position.set(sx, 0.44, sz);
      crownGroup.add(spike);
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), goldMat);
      pearl.position.set(sx, 0.72, sz);
      crownGroup.add(pearl);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), i % 2 === 0 ? gemPink : gemBlue);
      gem.position.set(Math.cos(a) * 0.7, -0.02, Math.sin(a) * 0.7);
      crownGroup.add(gem);
    }

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.065, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xfff380, transparent: true, opacity: 0.75 })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = -0.68;
    crownGroup.add(halo);

    this.group.add(crownGroup);
    this.crown = crownGroup;
    this.crownHalo = halo;
  }

  _buildClouds() {
    // 1 InstancedMesh for fluffy sky clouds spanning the full 100m tower height!
    const cloudDefs = [];
    for (let i = 0; i < 32; i++) {
      const a = i * 1.15;
      const dist = 36 + (i % 4) * 9;
      cloudDefs.push({
        x: 15 + Math.cos(a) * dist,
        y: 12 + (i / 31) * 96,
        z: -10 + Math.sin(a) * dist,
        s: 2.3 + (i % 3) * 0.65,
      });
    }
    const puffOffsets = [
      [0, 0, 0, 1.0],
      [0.95, -0.18, 0.15, 0.76],
      [-0.95, -0.2, -0.1, 0.78],
      [0.45, 0.42, -0.22, 0.68],
      [-0.45, 0.35, 0.25, 0.66],
    ];
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.92, emissive: 0xe6f6ff, emissiveIntensity: 0.25,
    });
    this.clouds = new THREE.InstancedMesh(geo, mat, cloudDefs.length * puffOffsets.length);
    this.clouds.frustumCulled = false;

    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let c = 0; c < cloudDefs.length; c++) {
      const cd = cloudDefs[c];
      this.cloudData.push({ ...cd, speed: 0.18 + (c % 5) * 0.04, phase: c * 1.3 });
      for (const [ox, oy, oz, ps] of puffOffsets) {
        dummy.position.set(cd.x + ox * cd.s, cd.y + oy * cd.s, cd.z + oz * cd.s);
        dummy.scale.set(cd.s * ps * 1.15, cd.s * ps * 0.85, cd.s * ps);
        dummy.updateMatrix();
        this.clouds.setMatrixAt(idx++, dummy.matrix);
      }
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    this.puffOffsets = puffOffsets;
    this._cloudDummy = dummy;
    this.scene.add(this.clouds);
  }

  triggerBounceVisual(plat) {
    if (!plat.bounceVisual) return;
    plat.bounceVisual.active = true;
    plat.bounceVisual.animT = 0;
  }

  resetDynamic() {
    this.time = 0;
    for (const p of this.platforms) {
      p.x = p.baseX;
      p.topY = p.baseTopY;
      p.z = p.baseZ;
      p.prevX = p.baseX;
      p.prevTopY = p.baseTopY;
      p.prevZ = p.baseZ;
      if (p.shape === 'seesaw') {
        p.angle = 0;
        p.prevAngle = 0;
        p.angVel = 0;
        p.torqueInput = 0;
        p.mesh.rotation.set(0, 0, 0);
      } else if (p.mesh) {
        p.mesh.position.set(p.x, p.topY - p.h / 2, p.z);
        if (p.spinOmega) p.mesh.rotation.y = 0;
      }
    }
    for (const v of this.vineSwings) {
      v.ropePivot.rotation.set(0, 0, 0);
    }
    for (const f of this.flags) {
      f.reached = false;
      f.popAnim = 0;
      f.pennantMat.color.setHex(f.origColor);
      f.group.scale.set(1, 1, 1);
    }
    for (const b of this.rotatingBars) {
      b.angle = 0;
      b.mesh.rotation.y = 0;
    }
    for (const h of this.pendulums) {
      h.angle = 0;
      h.prevAngle = 0;
      h.mesh.rotation.set(0, 0, 0);
    }
  }

  stepPhysics(dt) {
    this.time += dt;

    for (const p of this.platforms) {
      p.prevX = p.x;
      p.prevTopY = p.topY;
      p.prevZ = p.z;

      if (p.isVineSwing) {
        const a = Math.sin(this.time * p.speed + p.phase) * p.swingAmp;
        const swingOffset = Math.sin(a) * p.armLen;
        const dropY = Math.cos(a) * p.armLen;
        if (p.swingAxis === 'z') {
          p.z = p.pivotZ + swingOffset;
          p.ropePivot.rotation.x = -a;
        } else {
          p.x = p.pivotX + swingOffset;
          p.ropePivot.rotation.z = a;
        }
        p.topY = p.pivotY - dropY;
        p.mesh.position.set(p.x, p.topY - p.h / 2, p.z);
      } else if (p.moveAxis === 'x') {
        p.x = p.baseX + Math.sin(this.time * p.moveSpeed + p.movePhase) * p.moveAmp;
        p.mesh.position.x = p.x;
      } else if (p.moveAxis === 'y') {
        p.topY = p.baseTopY + Math.sin(this.time * p.moveSpeed + p.movePhase) * p.moveAmp;
        p.mesh.position.y = p.topY - p.h / 2;
      } else if (p.moveAxis === 'z') {
        p.z = p.baseZ + Math.sin(this.time * p.moveSpeed + p.movePhase) * p.moveAmp;
        p.mesh.position.z = p.z;
      } else if (p.spinOmega) {
        p.mesh.rotation.y += p.spinOmega * dt;
      } else if (p.shape === 'seesaw') {
        p.prevAngle = p.angle;
        const accel = p.torqueInput * 2.1 - p.angle * 3.8 - p.angVel * 3.6;
        p.angVel += accel * dt;
        p.angle += p.angVel * dt;
        if (p.angle > p.maxAngle) { p.angle = p.maxAngle; if (p.angVel > 0) p.angVel = 0; }
        else if (p.angle < -p.maxAngle) { p.angle = -p.maxAngle; if (p.angVel < 0) p.angVel = 0; }
        p.torqueInput = 0;
        if (p.tiltAxis === 'x') p.mesh.rotation.z = -p.angle;
        else p.mesh.rotation.x = p.angle;
      }
    }

    for (const g of this.fireGeysers) {
      const t = (this.time + g.phase) % g.cycle;
      g.erupting = t < g.onDuration;
      g.warning = !g.erupting && t > g.cycle - 0.45;
      g.plumeGroup.visible = g.erupting;
      g.coreGlow.visible = g.erupting || g.warning;
    }

    for (const j of this.fireJets) {
      const t = (this.time + j.phase) % j.cycle;
      j.active = t < j.onDuration;
      j.beamGroup.visible = j.active;
    }

    for (const b of this.rotatingBars) {
      b.angle += b.omega * dt;
      b.mesh.rotation.y = b.angle;
    }

    for (const h of this.pendulums) {
      h.prevAngle = h.angle;
      h.angle = Math.sin(this.time * h.speed) * h.swingAmp;
      if (h.swingAxis === 'z') {
        h.mesh.rotation.x = -h.angle;
        h.headX = h.x;
        h.headZ = h.z + Math.sin(h.angle) * h.armLength;
      } else {
        h.mesh.rotation.z = h.angle;
        h.headX = h.x + Math.sin(h.angle) * h.armLength;
        h.headZ = h.z;
      }
      h.headY = h.pivotY - Math.cos(h.angle) * h.armLength;
    }
  }

  updateVisuals(dt) {
    for (const bv of this.bounceVisuals) {
      if (!bv.active) continue;
      bv.animT += dt;
      const t = bv.animT;
      if (t < 0.35) {
        const spring = 1 + Math.sin(t * 28) * Math.exp(-t * 9) * 0.28;
        bv.group.scale.set(1 / Math.sqrt(spring), spring, 1 / Math.sqrt(spring));
        const pScale = 1 + t * 3.2;
        bv.pulse.scale.set(pScale, pScale, 1);
        bv.pulseMat.opacity = Math.max(0, 0.85 * (1 - t / 0.35));
      } else {
        bv.group.scale.set(1, 1, 1);
        bv.pulseMat.opacity = 0;
        bv.active = false;
      }
    }

    // Flicker erupting fire geyser plumes & fire jets
    const flicker = 0.92 + Math.sin(this.time * 32) * 0.1;
    for (const g of this.fireGeysers) {
      if (g.erupting) g.plumeGroup.scale.set(flicker, 0.9 + Math.cos(this.time * 26) * 0.14, flicker);
    }
    for (const j of this.fireJets) {
      if (j.active) j.beamGroup.scale.set(flicker, flicker, 0.94 + Math.sin(this.time * 28) * 0.08);
    }

    if (this.crown) {
      this.crown.rotation.y += dt * 1.45;
      this.crown.position.y = this.crownPos.y + Math.sin(this.time * 2.6) * 0.22;
      if (this.crownHalo) {
        const hs = 1 + Math.sin(this.time * 3.5) * 0.08;
        this.crownHalo.scale.set(hs, hs, 1);
      }
    }

    for (const f of this.flags) {
      f.pennant.rotation.y = Math.sin(this.time * 4.2 + f.x) * 0.22;
      if (f.popAnim > 0) {
        f.popAnim = Math.max(0, f.popAnim - dt * 2.4);
        const s = 1 + Math.sin(f.popAnim * Math.PI) * 0.35;
        f.group.scale.set(s, s, s);
      }
    }

    if (this.clouds) {
      let idx = 0;
      const dummy = this._cloudDummy;
      for (let c = 0; c < this.cloudData.length; c++) {
        const cd = this.cloudData[c];
        const driftX = cd.x + Math.sin(this.time * cd.speed * 0.35 + cd.phase) * 3.0;
        const driftY = cd.y + Math.cos(this.time * cd.speed * 0.4 + cd.phase) * 0.4;
        for (const [ox, oy, oz, ps] of this.puffOffsets) {
          dummy.position.set(driftX + ox * cd.s, driftY + oy * cd.s, cd.z + oz * cd.s);
          dummy.scale.set(cd.s * ps * 1.15, cd.s * ps * 0.85, cd.s * ps);
          dummy.updateMatrix();
          this.clouds.setMatrixAt(idx++, dummy.matrix);
        }
      }
      this.clouds.instanceMatrix.needsUpdate = true;
    }
  }
}
