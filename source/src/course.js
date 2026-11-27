import * as THREE from 'three';
import { GOAL_HEIGHT, PALETTE } from './constants.js';

// Helper: plump Fall Guys rounded-corner rectangular prism centered at origin
// Top sits at y = +h/2, bottom at y = -h/2
function createRoundedBoxGeometry(w, h, d, radius = 0.22) {
  const r = Math.min(radius, w * 0.42, d * 0.42);
  const hw = w / 2;
  const hd = d / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  const bevel = Math.min(0.08, h * 0.25, r * 0.45);
  const depth = Math.max(0.05, h - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  // Extrude is along +Z; rotate so extrusion is vertical along Y and centered
  geo.rotateX(Math.PI / 2);
  geo.translate(0, depth / 2, 0);
  // Adjust slightly so outer bounds match w, h, d closely
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const curW = bb.max.x - bb.min.x;
  const curH = bb.max.y - bb.min.y;
  const curD = bb.max.z - bb.min.z;
  geo.scale(w / curW, h / curH, d / curD);
  geo.computeVertexNormals();
  return geo;
}

// Helper: candy-striped turntable canvas texture for rotating disc
function createDiscTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const slices = 8;
  for (let i = 0; i < slices; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, size / 2, (i / slices) * Math.PI * 2, ((i + 1) / slices) * Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? '#ffa6d6' : '#fff3a8';
    ctx.fill();
  }
  // Curved direction chevrons
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.32, a, a + 0.7);
    ctx.stroke();
  }
  // Center pastel hub dot
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Helper: cheerful ground meadow radial ring texture
function createGroundTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  ctx.fillStyle = '#9be7c4';
  ctx.fillRect(0, 0, size, size);
  const rings = [240, 195, 150, 105, 62, 26];
  rings.forEach((r, idx) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = idx % 2 === 0 ? '#aeeed0' : '#94e3be';
    ctx.fill();
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Helper: candy stripe texture for rotating sweeper bar & hammer
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

// Helper: bounce pad top concentric bullseye texture
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
  const circles = [
    { r: 58, c: '#fff275' },
    { r: 46, c: '#ff5e8a' },
    { r: 30, c: '#ffffff' },
    { r: 16, c: '#ff7fa6' },
  ];
  for (const item of circles) {
    ctx.beginPath();
    ctx.arc(cx, cy, item.r, 0, Math.PI * 2);
    ctx.fillStyle = item.c;
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Course {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.platforms = [];     // All solid platforms (box, cylinder, seesaw, bounce)
    this.rotatingBars = [];  // Sweeper bars
    this.pendulums = [];     // Pendulum hammers
    this.flags = [];         // Milestone flags
    this.bounceVisuals = []; // Animated bounce pad rings/drums
    this.clouds = null;      // InstancedMesh for fluffy clouds
    this.cloudData = [];
    this.crown = null;
    this.crownHalo = null;
    this.crownPos = new THREE.Vector3(9.6, 35.9, -11.2);
    this.time = 0;

    // Shared material cache to minimize state changes
    this.matCache = new Map();

    this._buildCourse();
    this._buildClouds();
    this._buildDecorations();
  }

  _mat(color, roughness = 0.55, metalness = 0.04) {
    const key = `${color}_${roughness}_${metalness}`;
    if (!this.matCache.has(key)) {
      this.matCache.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness, metalness })
      );
    }
    return this.matCache.get(key);
  }

  _addBox(id, x, topY, z, w, h, d, color, trimColor, extra = {}) {
    const mesh = new THREE.Mesh(
      createRoundedBoxGeometry(w, h, d, Math.min(0.28, Math.min(w, d) * 0.25)),
      this._mat(color, 0.52)
    );
    mesh.position.set(x, topY - h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Subtle colored trim band around the middle for playful Fall Guys depth
    if (trimColor) {
      const trim = new THREE.Mesh(
        createRoundedBoxGeometry(w + 0.04, Math.min(0.18, h * 0.26), d + 0.04, Math.min(0.28, Math.min(w, d) * 0.25)),
        this._mat(trimColor, 0.45)
      );
      trim.position.y = -h * 0.18;
      mesh.add(trim);
    }

    this.group.add(mesh);

    const plat = {
      id,
      shape: 'box',
      x,
      topY,
      z,
      baseX: x,
      baseTopY: topY,
      baseZ: z,
      prevX: x,
      prevTopY: topY,
      prevZ: z,
      w,
      h,
      d,
      mesh,
      ...extra,
    };
    this.platforms.push(plat);
    return plat;
  }

  _addCylinder(id, x, topY, z, r, h, color, trimColor, extra = {}) {
    const geo = new THREE.CylinderGeometry(r, r * 1.03, h, 24);
    let mat = this._mat(color, 0.5);
    if (extra.customTopTexture) {
      const sideMat = this._mat(trimColor || color, 0.5);
      const topMat = new THREE.MeshStandardMaterial({
        map: extra.customTopTexture,
        roughness: 0.45,
        metalness: 0.03,
      });
      mat = [sideMat, topMat, sideMat];
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, topY - h / 2, z);
    mesh.castShadow = !extra.noCastShadow;
    mesh.receiveShadow = true;

    if (trimColor && !extra.customTopTexture) {
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.99, Math.min(0.08, h * 0.14), 8, 28),
        this._mat(trimColor, 0.42)
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = h / 2 - 0.06;
      mesh.add(rim);
    }

    this.group.add(mesh);

    const plat = {
      id,
      shape: 'cylinder',
      x,
      topY,
      z,
      baseX: x,
      baseTopY: topY,
      baseZ: z,
      prevX: x,
      prevTopY: topY,
      prevZ: z,
      r,
      h,
      mesh,
      spinOmega: extra.spinOmega || 0,
      ...extra,
    };
    this.platforms.push(plat);
    return plat;
  }

  _addBouncePad(id, x, topY, z, r, h, bounceVy = 16.5) {
    const drumGroup = new THREE.Group();
    drumGroup.position.set(x, topY - h / 2, z);

    const topTex = createBounceTopTexture();
    const drumMats = [
      this._mat(PALETTE.bounceDrum, 0.4),
      new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.35 }),
      this._mat(PALETTE.bounceDrum, 0.4),
    ];
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, h, 24), drumMats);
    drum.castShadow = true;
    drum.receiveShadow = true;
    drumGroup.add(drum);

    // Glowing bouncy rim ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.02, 0.08, 10, 28),
      this._mat(PALETTE.bounceRing, 0.3)
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = h / 2 - 0.04;
    drumGroup.add(ring);

    // Expanding pulse shockwave ring (hidden until triggered)
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xfff58a,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const pulse = new THREE.Mesh(new THREE.RingGeometry(r * 0.7, r * 1.05, 24), pulseMat);
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.y = h / 2 + 0.05;
    drumGroup.add(pulse);

    this.group.add(drumGroup);

    const visual = { group: drumGroup, pulse, pulseMat, animT: 0, active: false };
    this.bounceVisuals.push(visual);

    const plat = {
      id,
      shape: 'cylinder',
      x,
      topY,
      z,
      baseX: x,
      baseTopY: topY,
      baseZ: z,
      prevX: x,
      prevTopY: topY,
      prevZ: z,
      r,
      h,
      mesh: drumGroup,
      isBouncePad: true,
      bounceVy,
      bounceVisual: visual,
    };
    this.platforms.push(plat);
    return plat;
  }

  _addSeesaw(id, x, pivotTopY, z, w, h, d, maxAngle = 0.4) {
    // Fulcrum cylinder beneath the seesaw
    const fulcrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, w + 0.5, 16),
      this._mat(0xffffff, 0.4)
    );
    fulcrum.rotation.z = Math.PI / 2;
    fulcrum.position.set(x, pivotTopY - h - 0.16, z);
    fulcrum.castShadow = true;
    this.group.add(fulcrum);

    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(x, pivotTopY - h / 2, z);

    const plank = new THREE.Mesh(
      createRoundedBoxGeometry(w, h, d, 0.22),
      this._mat(PALETTE.seesaw, 0.48)
    );
    plank.castShadow = true;
    plank.receiveShadow = true;
    pivotGroup.add(plank);

    // Center white balance stripe
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.03, h + 0.02, 0.24),
      this._mat(0xffffff, 0.35)
    );
    pivotGroup.add(stripe);

    // End stripes so tilt is easy to judge visually
    const endMat = this._mat(PALETTE.seesawTrim, 0.4);
    for (const sign of [-1, 1]) {
      const endBar = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h * 0.55, 0.45), endMat);
      endBar.position.z = sign * (d / 2 - 0.35);
      pivotGroup.add(endBar);
    }

    this.group.add(pivotGroup);

    const plat = {
      id,
      shape: 'seesaw',
      x,
      topY: pivotTopY,
      z,
      baseX: x,
      baseTopY: pivotTopY,
      baseZ: z,
      prevX: x,
      prevTopY: pivotTopY,
      prevZ: z,
      w,
      h,
      d,
      angle: 0,
      prevAngle: 0,
      angVel: 0,
      maxAngle,
      torqueInput: 0,
      mesh: pivotGroup,
    };
    this.platforms.push(plat);
    return plat;
  }

  _addRotatingBar(x, y, z, halfLength, barRadius, omega, hubRadius, floorY) {
    // Solid center hub cylinder
    const hubH = (y - floorY) + 0.85;
    this._addCylinder(
      's6_hub',
      x,
      floorY + hubH,
      z,
      hubRadius,
      hubH,
      0xffe066,
      0xffb703
    );

    const barGroup = new THREE.Group();
    barGroup.position.set(x, y, z);

    const stripeTex = createStripeTexture('#ff6b8b', '#ffffff');
    const barMat = new THREE.MeshStandardMaterial({
      map: stripeTex,
      roughness: 0.38,
      metalness: 0.04,
    });
    const barGeo = new THREE.CylinderGeometry(barRadius, barRadius, halfLength * 2, 16);
    barGeo.rotateZ(Math.PI / 2); // aligned along X at angle = 0
    const barMesh = new THREE.Mesh(barGeo, barMat);
    barMesh.castShadow = true;
    barMesh.receiveShadow = true;
    barGroup.add(barMesh);

    // Cute rounded end caps on the sweeper bar
    const capGeo = new THREE.SphereGeometry(barRadius * 1.18, 12, 10);
    const capMat = this._mat(0xffe066, 0.35);
    for (const sign of [-1, 1]) {
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.x = sign * halfLength;
      cap.castShadow = true;
      barGroup.add(cap);
    }

    this.group.add(barGroup);
    this.rotatingBars.push({
      x,
      y,
      z,
      halfLength,
      barRadius,
      omega,
      angle: 0,
      mesh: barGroup,
    });
  }

  _addPendulumHammer(x, pivotY, z, armLength, swingAmp, speed) {
    // Cute pastel overhead arch frame
    const frameMat = this._mat(0xffffff, 0.45);
    const frameGroup = new THREE.Group();
    frameGroup.position.set(x, pivotY, z);
    const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.4, 12), frameMat);
    crossBar.rotation.z = Math.PI / 2;
    frameGroup.add(crossBar);
    // Decorative spheres at crossBar ends
    for (const sign of [-1, 1]) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), this._mat(PALETTE.sec4, 0.4));
      orb.position.x = sign * 2.2;
      frameGroup.add(orb);
    }
    this.group.add(frameGroup);

    const armGroup = new THREE.Group();
    armGroup.position.set(x, pivotY, z);

    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, armLength, 10),
      this._mat(0xeef5ff, 0.35)
    );
    rod.position.y = -armLength / 2;
    rod.castShadow = true;
    armGroup.add(rod);

    // Padded soft mallet head (candy-striped cylinder)
    const headRadius = 0.44;
    const headLen = 1.05;
    const headMat = new THREE.MeshStandardMaterial({
      map: createStripeTexture('#ff85a8', '#fff4a3'),
      roughness: 0.4,
    });
    const head = new THREE.Mesh(new THREE.CylinderGeometry(headRadius, headRadius, headLen, 16), headMat);
    head.rotation.z = Math.PI / 2;
    head.position.y = -armLength;
    head.castShadow = true;
    armGroup.add(head);

    this.group.add(armGroup);
    this.pendulums.push({
      x,
      pivotY,
      z,
      armLength,
      swingAmp,
      speed,
      headRadius,
      headHalfLen: headLen / 2,
      angle: 0,
      prevAngle: 0,
      headX: x,
      headY: pivotY - armLength,
      headZ: z,
      mesh: armGroup,
    });
  }

  _addFlag(x, baseY, z, label, color = 0xff5e8a) {
    const pct = Math.round((baseY / GOAL_HEIGHT) * 100);
    const flagGroup = new THREE.Group();
    flagGroup.position.set(x, baseY, z);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 2.2, 10),
      this._mat(0xffffff, 0.35)
    );
    pole.position.y = 1.1;
    pole.castShadow = true;
    flagGroup.add(pole);

    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 10),
      this._mat(PALETTE.crownGold, 0.25, 0.4)
    );
    finial.position.y = 2.24;
    flagGroup.add(finial);

    // Triangular pennant
    const triShape = new THREE.Shape();
    triShape.moveTo(0, 0.36);
    triShape.lineTo(1.05, 0.02);
    triShape.lineTo(0, -0.34);
    triShape.closePath();
    const pennantMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });
    const pennant = new THREE.Mesh(new THREE.ShapeGeometry(triShape), pennantMat);
    pennant.position.set(0.05, 1.82, 0);
    flagGroup.add(pennant);

    // Small pedestal ring
    const baseRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, 0.12, 14),
      this._mat(0xffffff, 0.4)
    );
    baseRing.position.y = 0.06;
    flagGroup.add(baseRing);

    this.group.add(flagGroup);
    this.flags.push({
      x,
      y: baseY,
      z,
      pct,
      label,
      reached: false,
      popAnim: 0,
      group: flagGroup,
      pennant,
      pennantMat,
      origColor: color,
    });
  }

  _addGuideRail(x1, y1, z1, x2, y2, z2) {
    const p1 = new THREE.Vector3(x1, y1, z1);
    const p2 = new THREE.Vector3(x2, y2, z2);
    const len = p1.distanceTo(p2);
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, len, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 })
    );
    rail.position.copy(p1).add(p2).multiplyScalar(0.5);
    rail.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      p2.clone().sub(p1).normalize()
    );
    this.group.add(rail);
  }

  _buildCrown() {
    const crownGroup = new THREE.Group();
    crownGroup.position.copy(this.crownPos);

    const goldMat = new THREE.MeshStandardMaterial({
      color: PALETTE.crownGold,
      roughness: 0.22,
      metalness: 0.65,
      emissive: 0x553300,
      emissiveIntensity: 0.25,
    });
    const gemPinkMat = new THREE.MeshStandardMaterial({
      color: PALETTE.crownGemPink,
      roughness: 0.15,
      metalness: 0.2,
      emissive: 0x881144,
      emissiveIntensity: 0.3,
    });
    const gemBlueMat = new THREE.MeshStandardMaterial({
      color: PALETTE.crownGemBlue,
      roughness: 0.15,
      metalness: 0.2,
      emissive: 0x115588,
      emissiveIntensity: 0.3,
    });

    // Base golden band
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.56, 0.42, 20, 1, false), goldMat);
    band.castShadow = true;
    crownGroup.add(band);

    // Lower rim ring
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.57, 0.08, 10, 24), goldMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.2;
    crownGroup.add(rim);

    // 5 royal crown spikes + orb tips + gems
    const spikes = 5;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const sx = Math.cos(a) * 0.6;
      const sz = Math.sin(a) * 0.6;

      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.52, 6), goldMat);
      spike.position.set(sx, 0.42, sz);
      crownGroup.add(spike);

      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), goldMat);
      pearl.position.set(sx, 0.69, sz);
      crownGroup.add(pearl);

      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.11, 0),
        i % 2 === 0 ? gemPinkMat : gemBlueMat
      );
      gem.position.set(Math.cos(a) * 0.67, -0.02, Math.sin(a) * 0.67);
      crownGroup.add(gem);
    }

    // Soft glowing golden halo ring floating beneath the crown
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.06, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff380, transparent: true, opacity: 0.72 })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = -0.65;
    crownGroup.add(halo);

    this.group.add(crownGroup);
    this.crown = crownGroup;
    this.crownHalo = halo;
  }

  _buildCourse() {
    // 0. Vast cheerful pastel meadow ground (y = 0.0m) so falling anywhere lands safely
    this._addCylinder(
      'ground',
      0,
      0.0,
      -14,
      68,
      2.4,
      PALETTE.ground,
      PALETTE.groundRim,
      { customTopTexture: createGroundTexture(), noCastShadow: true, isGround: true }
    );

    // =========================================================================
    // SECTION 1: 階段登り（1mずつ3段） y: 0.0 -> 3.0m
    // =========================================================================
    this._addBox('s1_1', 0, 1.0, -3.5, 4.4, 1.0, 2.8, PALETTE.sec1, PALETTE.sec1Trim);
    this._addBox('s1_2', 0, 2.0, -6.5, 4.2, 1.0, 2.8, PALETTE.sec1, PALETTE.sec1Trim);
    this._addBox('s1_3', 0, 3.0, -9.8, 4.6, 1.0, 3.4, PALETTE.sec1, PALETTE.sec1Trim);
    this._addFlag(1.6, 3.0, -10.8, '階段クリア！', 0xff7b54);

    // =========================================================================
    // SECTION 2: 隙間ジャンプの小足場3つ（斜めに上昇） y: 3.0 -> 6.6m
    // =========================================================================
    this._addCylinder('s2_1', 2.6, 4.0, -14.8, 1.45, 0.8, PALETTE.sec2, PALETTE.sec2Trim);
    this._addCylinder('s2_2', 6.1, 5.0, -17.6, 1.45, 0.8, PALETTE.sec2, PALETTE.sec2Trim);
    this._addCylinder('s2_3', 9.6, 6.0, -20.4, 1.45, 0.8, PALETTE.sec2, PALETTE.sec2Trim);
    this._addBox('s2_pad', 13.5, 6.6, -23.4, 3.6, 0.8, 3.6, PALETTE.sec2, PALETTE.sec2Trim);

    // =========================================================================
    // SECTION 3: 横に往復する移動足場 → 小さなレッジ y: 6.6 -> 8.0m
    // =========================================================================
    this._addBox('s3_move', 13.5, 7.2, -28.0, 3.6, 0.7, 2.8, PALETTE.sec3, PALETTE.sec3Trim, {
      moveAxis: 'x',
      moveAmp: 3.2,
      moveSpeed: 0.95,
      movePhase: 0,
    });
    this._addGuideRail(10.0, 6.85, -28.0, 17.0, 6.85, -28.0);
    this._addBox('s3_ledge', 13.5, 8.0, -33.2, 3.6, 0.8, 4.4, PALETTE.sec3, PALETTE.sec3Trim);
    this._addFlag(14.7, 8.0, -31.7, 'バウンス前！', 0x2ec4b6);

    // =========================================================================
    // SECTION 4: バウンスパッド（真上に跳ね上げ、空中で北へ流れて高台に着地） y: 8.15 -> 11.8m
    // =========================================================================
    this._addBouncePad('s4_bounce', 13.5, 8.15, -34.2, 1.15, 0.28, 16.5);
    this._addBox('s4_high', 13.5, 11.8, -39.6, 4.8, 1.0, 4.4, PALETTE.sec4, PALETTE.sec4Trim);

    // =========================================================================
    // SECTION 5: 細い梁（幅0.7m）＋両脇に低い落下受け足場 y: 11.8 -> 12.2m
    // =========================================================================
    this._addBox('s5_beam', 5.6, 11.9, -39.2, 11.0, 0.45, 0.7, PALETTE.sec5, PALETTE.sec5Trim);
    this._addBox('s5_catch_n', 5.6, 10.7, -41.5, 9.4, 0.6, 2.4, PALETTE.sec5Catch, PALETTE.sec5);
    this._addBox('s5_catch_s', 5.6, 10.7, -36.9, 9.4, 0.6, 2.4, PALETTE.sec5Catch, PALETTE.sec5);
    this._addBox('s5_end', -1.6, 12.0, -39.2, 3.6, 0.8, 3.8, PALETTE.sec5, PALETTE.sec5Trim);
    this._addFlag(-1.6, 12.0, -37.8, '回転バー広場！', 0x4ea8de);

    // =========================================================================
    // SECTION 6: 回転バーが薙ぎ払う広場（バーは当たると押し出される） y: 12.2 -> 13.0m
    // =========================================================================
    this._addCylinder('s6_arena', -8.4, 12.6, -39.2, 4.8, 1.0, PALETTE.sec6, PALETTE.sec6Trim);
    this._addRotatingBar(-8.4, 13.22, -39.2, 4.20, 0.24, 1.55, 0.78, 12.6);
    this._addBox('s6_exit', -8.4, 13.0, -32.6, 3.6, 0.8, 3.2, PALETTE.sec6, PALETTE.sec6Trim);

    // =========================================================================
    // SECTION 7: 縦に往復するエレベーター足場 ＋ 回転する円盤足場 y: 13.0 -> 18.8m
    // =========================================================================
    this._addBox('s7_elev', -8.4, 15.75, -29.0, 3.2, 0.7, 3.2, PALETTE.sec7, PALETTE.sec7Trim, {
      moveAxis: 'y',
      moveAmp: 2.75,
      moveSpeed: 0.85,
      movePhase: -Math.PI / 2, // Starts smoothly at bottom (13.0m)
    });
    this._addGuideRail(-10.1, 12.8, -29.0, -10.1, 18.8, -29.0);
    this._addGuideRail(-6.7, 12.8, -29.0, -6.7, 18.8, -29.0);

    // Bonus Gimmick #1: Rotating Turntable Disc at top of elevator
    this._addCylinder(
      's7_disc',
      -8.4,
      18.6,
      -23.4,
      3.2,
      0.7,
      PALETTE.sec7DiscA,
      PALETTE.sec7Trim,
      { customTopTexture: createDiscTexture(), spinOmega: 0.72 }
    );
    this._addBox('s7_pier', -4.4, 18.8, -23.4, 2.4, 0.7, 2.6, PALETTE.sec7, PALETTE.sec7Trim);
    this._addFlag(-4.4, 18.8, -24.2, '折り返し突破！', 0x38d39f);

    // =========================================================================
    // SECTION 8: 螺旋状の小足場ジャンプ3つ y: 18.8 -> 23.0m
    // =========================================================================
    this._addCylinder('s8_1', -0.2, 20.0, -23.2, 1.4, 0.7, PALETTE.sec8, PALETTE.sec8Trim);
    this._addCylinder('s8_2', 2.2, 21.2, -20.0, 1.4, 0.7, PALETTE.sec8, PALETTE.sec8Trim);
    this._addCylinder('s8_3', -0.2, 22.4, -16.8, 1.4, 0.7, PALETTE.sec8, PALETTE.sec8Trim);
    this._addBox('s8_end', -4.2, 23.0, -16.8, 3.6, 0.8, 3.6, PALETTE.sec8, PALETTE.sec8Trim);

    // =========================================================================
    // SECTION 9: 長い梁（12m）＋ 途中にシーソー足場 ＋ 振り子ハンマー y: 23.0 -> 23.4m
    // =========================================================================
    this._addBox('s9_beam1', -4.2, 23.0, -12.0, 1.25, 0.5, 6.0, PALETTE.sec9, PALETTE.sec9Trim);
    // Bonus Gimmick #2: Pendulum Hammer swinging gently over Beam 9A
    this._addPendulumHammer(-4.2, 27.65, -12.0, 3.7, 0.96, 1.7);
    // Seesaw platform right in the middle of the skywalk
    this._addSeesaw('s9_seesaw', -4.2, 23.1, -6.2, 2.4, 0.45, 5.0, 0.40);
    this._addBox('s9_beam2', -4.2, 23.2, -0.3, 1.25, 0.5, 6.0, PALETTE.sec9, PALETTE.sec9Trim);
    this._addBox('s9_end', -3.7, 23.35, 4.7, 5.0, 0.8, 4.2, PALETTE.sec9, PALETTE.sec9Trim);
    this._addFlag(-5.4, 23.35, 3.4, '連バウンスへ！', 0xffaa33);

    // =========================================================================
    // SECTION 10: バウンスパッド2連チェーン（跳ねて→流れて→また跳ねる） y: 23.55 -> 30.8m
    // =========================================================================
    this._addBouncePad('s10_bounce1', -2.0, 23.50, 4.7, 1.15, 0.28, 16.5);
    this._addCylinder('s10_island', 3.8, 27.1, 4.7, 2.35, 0.7, PALETTE.sec10, PALETTE.sec10Trim);
    this._addBouncePad('s10_bounce2', 3.8, 27.25, 4.7, 1.75, 0.28, 16.5);
    this._addBox('s10_high', 10.0, 30.8, 4.7, 5.2, 1.0, 4.8, PALETTE.sec10, PALETTE.sec10Trim);
    this._addFlag(11.6, 30.8, 3.2, 'ゴール目前！！', 0xff4d88);

    // =========================================================================
    // SECTION 11: 最後の登り階段3段 → 浮いた王冠（34.6m） y: 30.8 -> 34.6m
    // =========================================================================
    this._addBox('s11_1', 9.6, 31.8, 0.4, 4.0, 0.8, 2.8, PALETTE.sec11, PALETTE.sec11Trim);
    this._addBox('s11_2', 9.6, 32.8, -2.9, 3.8, 0.8, 2.8, PALETTE.sec11, PALETTE.sec11Trim);
    this._addBox('s11_3', 9.6, 33.8, -6.2, 3.6, 0.8, 2.8, PALETTE.sec11, PALETTE.sec11Trim);
    this._addCylinder('s11_summit', 9.6, 34.6, -11.2, 3.2, 1.0, 0xfff5c2, PALETTE.crownGold);

    this._buildCrown();
  }

  _buildDecorations() {
    // Playful Start Arch at (0, 0, -0.5)
    const archMat = this._mat(0xffffff, 0.4);
    const pinkMat = this._mat(PALETTE.sec4, 0.4);
    for (const sign of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 3.4, 14), archMat);
      post.position.set(sign * 2.8, 1.7, -0.8);
      post.castShadow = true;
      this.group.add(post);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), pinkMat);
      cap.position.set(sign * 2.8, 3.45, -0.8);
      this.group.add(cap);
    }
    const topArch = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.22, 10, 28, Math.PI), pinkMat);
    topArch.position.set(0, 3.3, -0.8);
    this.group.add(topArch);

    // Decorative pastel spiral centerpiece pillar in Section 8 (visual anchor, non-colliding far center)
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 6.2, 14),
      new THREE.MeshStandardMaterial({ color: 0xffe4f0, roughness: 0.45, transparent: true, opacity: 0.75 })
    );
    pillar.position.set(-0.2, 20.8, -20.0);
    this.group.add(pillar);
  }

  _buildClouds() {
    // Single InstancedMesh of smooth white puff spheres -> 1 draw call for 26 fluffy clouds!
    const cloudDefs = [
      { x: -24, y: 9, z: -8, s: 2.2 },
      { x: 26, y: 12, z: -15, s: 2.6 },
      { x: -26, y: 17, z: -36, s: 2.8 },
      { x: 28, y: 19, z: -42, s: 2.4 },
      { x: 0, y: 26, z: -48, s: 3.0 },
      { x: -28, y: 24, z: -16, s: 2.5 },
      { x: 24, y: 27, z: -4, s: 2.3 },
      { x: -18, y: 31, z: 16, s: 2.7 },
      { x: 18, y: 33, z: 22, s: 2.4 },
      { x: -24, y: 36, z: -30, s: 3.1 },
      { x: 26, y: 38, z: -26, s: 2.9 },
      { x: 4, y: 42, z: -28, s: 2.6 },
      { x: -10, y: 15, z: 18, s: 2.2 },
      { x: 18, y: 8, z: 14, s: 2.0 },
      { x: -34, y: 29, z: 0, s: 3.2 },
      { x: 35, y: 23, z: -18, s: 3.0 },
      { x: -16, y: 40, z: 6, s: 2.8 },
      { x: 22, y: 41, z: 6, s: 2.5 },
    ];

    // Each cloud = 5 clustered puffs
    const puffOffsets = [
      [0, 0, 0, 1.0],
      [0.95, -0.18, 0.15, 0.76],
      [-0.95, -0.2, -0.1, 0.78],
      [0.45, 0.42, -0.22, 0.68],
      [-0.45, 0.35, 0.25, 0.66],
    ];

    const totalPuffs = cloudDefs.length * puffOffsets.length;
    const geo = new THREE.SphereGeometry(1, 12, 10);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.0,
      emissive: 0xdff4ff,
      emissiveIntensity: 0.25,
    });
    this.clouds = new THREE.InstancedMesh(geo, mat, totalPuffs);
    this.clouds.castShadow = false;
    this.clouds.receiveShadow = false;

    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let c = 0; c < cloudDefs.length; c++) {
      const cd = cloudDefs[c];
      this.cloudData.push({
        baseX: cd.x,
        baseY: cd.y,
        baseZ: cd.z,
        s: cd.s,
        speed: 0.18 + (c % 5) * 0.05,
        phase: c * 1.17,
      });
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
        p.mesh.rotation.x = 0;
      } else if (p.mesh) {
        p.mesh.position.set(p.x, p.topY - p.h / 2, p.z);
        if (p.spinOmega) p.mesh.rotation.y = 0;
      }
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
      h.mesh.rotation.z = 0;
    }
  }

  // Physics-rate step for moving platforms, seesaws, bars, pendulums
  stepPhysics(dt) {
    this.time += dt;

    for (const p of this.platforms) {
      p.prevX = p.x;
      p.prevTopY = p.topY;
      p.prevZ = p.z;

      if (p.moveAxis === 'x') {
        p.x = p.baseX + Math.sin(this.time * p.moveSpeed + p.movePhase) * p.moveAmp;
        p.mesh.position.x = p.x;
      } else if (p.moveAxis === 'y') {
        p.topY = p.baseTopY + Math.sin(this.time * p.moveSpeed + p.movePhase) * p.moveAmp;
        p.mesh.position.y = p.topY - p.h / 2;
      } else if (p.spinOmega) {
        p.mesh.rotation.y += p.spinOmega * dt;
      } else if (p.shape === 'seesaw') {
        p.prevAngle = p.angle;
        // Player weight torque + soft spring restore to level + damping
        const restore = -p.angle * 3.8;
        const damp = -p.angVel * 3.6;
        const accel = p.torqueInput * 2.1 + restore + damp;
        p.angVel += accel * dt;
        p.angle += p.angVel * dt;
        if (p.angle > p.maxAngle) {
          p.angle = p.maxAngle;
          if (p.angVel > 0) p.angVel = 0;
        } else if (p.angle < -p.maxAngle) {
          p.angle = -p.maxAngle;
          if (p.angVel < 0) p.angVel = 0;
        }
        p.torqueInput = 0; // Reset for next substep
        p.mesh.rotation.x = p.angle;
      }
    }

    for (const b of this.rotatingBars) {
      b.angle += b.omega * dt;
      b.mesh.rotation.y = b.angle;
    }

    for (const h of this.pendulums) {
      h.prevAngle = h.angle;
      h.angle = Math.sin(this.time * h.speed) * h.swingAmp;
      h.mesh.rotation.z = h.angle;
      // Compute world position of hammer head
      h.headX = h.x + Math.sin(h.angle) * h.armLength;
      h.headY = h.pivotY - Math.cos(h.angle) * h.armLength;
      h.headZ = h.z;
    }
  }

  // Visual-rate updates (bounce animations, crown bobbing, flag waving, clouds drifting)
  updateVisuals(dt) {
    // Bounce pad squash & shockwave pulse
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

    // Floating Golden Crown animation
    if (this.crown) {
      this.crown.rotation.y += dt * 1.45;
      this.crown.position.y = this.crownPos.y + Math.sin(this.time * 2.6) * 0.22;
      if (this.crownHalo) {
        const hs = 1 + Math.sin(this.time * 3.5) * 0.08;
        this.crownHalo.scale.set(hs, hs, 1);
      }
    }

    // Milestone flags gentle wave + celebration pop
    for (const f of this.flags) {
      f.pennant.rotation.y = Math.sin(this.time * 4.2 + f.x) * 0.22;
      if (f.popAnim > 0) {
        f.popAnim = Math.max(0, f.popAnim - dt * 2.4);
        const s = 1 + Math.sin(f.popAnim * Math.PI) * 0.35;
        f.group.scale.set(s, s, s);
      }
    }

    // Drifting fluffy clouds
    if (this.clouds) {
      let idx = 0;
      const dummy = this._cloudDummy;
      for (let c = 0; c < this.cloudData.length; c++) {
        const cd = this.cloudData[c];
        const driftX = cd.baseX + Math.sin(this.time * cd.speed * 0.35 + cd.phase) * 3.2;
        const driftY = cd.baseY + Math.cos(this.time * cd.speed * 0.45 + cd.phase) * 0.45;
        for (const [ox, oy, oz, ps] of this.puffOffsets) {
          dummy.position.set(driftX + ox * cd.s, driftY + oy * cd.s, cd.baseZ + oz * cd.s);
          dummy.scale.set(cd.s * ps * 1.15, cd.s * ps * 0.85, cd.s * ps);
          dummy.updateMatrix();
          this.clouds.setMatrixAt(idx++, dummy.matrix);
        }
      }
      this.clouds.instanceMatrix.needsUpdate = true;
    }
  }
}
