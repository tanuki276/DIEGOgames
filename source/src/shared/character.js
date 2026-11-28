import * as THREE from 'three';
import { DEFAULT_SKIN, normalizeSkin } from './storage.js';

let cachedDropShadowTex = null;
function getDropShadowTexture() {
  if (cachedDropShadowTex) return cachedDropShadowTex;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(20, 35, 60, 0.44)');
  grad.addColorStop(0.6, 'rgba(20, 35, 60, 0.22)');
  grad.addColorStop(1, 'rgba(20, 35, 60, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  cachedDropShadowTex = new THREE.CanvasTexture(canvas);
  cachedDropShadowTex.needsUpdate = true;
  return cachedDropShadowTex;
}

function createStarShape(outerR = 0.16, innerR = 0.072, points = 5) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createWingGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.18, 0.24, 0.44, 0.18);
  shape.quadraticCurveTo(0.42, 0.04, 0.28, -0.02);
  shape.quadraticCurveTo(0.36, -0.10, 0.22, -0.14);
  shape.quadraticCurveTo(0.14, -0.22, 0.02, -0.14);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.015,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -0.022);
  geo.computeVertexNormals();
  return geo;
}

function createNameTagSprite(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);

  const text = (name || 'プレイヤー').slice(0, 14);
  ctx.font = '800 28px "Hiragino Maru Gothic ProN", "Yu Gothic", system-ui, sans-serif';
  const metrics = ctx.measureText(text);
  const pillW = Math.min(244, Math.max(88, metrics.width + 36));
  const pillX = (256 - pillW) / 2;

  ctx.fillStyle = 'rgba(20, 34, 58, 0.78)';
  ctx.beginPath();
  ctx.roundRect(pillX, 10, pillW, 44, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.75, 0.44, 1);
  sprite.position.set(0, 1.62, 0);
  sprite.renderOrder = 20;
  return sprite;
}

export class OtaCharacter {
  constructor(initialSkin = DEFAULT_SKIN, options = {}) {
    this.skin = normalizeSkin(initialSkin);
    this.enableShadows = options.castShadow !== false;

    this.root = new THREE.Group();
    this.squashPivot = new THREE.Group();
    this.tiltGroup = new THREE.Group();
    this.squashPivot.add(this.tiltGroup);
    this.root.add(this.squashPivot);

    // Dynamic materials so skin changes reflect instantaneously
    this.hoodMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.skin.hood),
      roughness: 0.42,
      metalness: 0.04,
    });
    this.hoodRimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.skin.hood).multiplyScalar(0.76),
      roughness: 0.48,
      metalness: 0.04,
    });
    this.faceMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.skin.face),
      roughness: 0.35,
      metalness: 0.0,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x11131a,
      roughness: 0.2,
      metalness: 0.1,
    });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Main Blue Dome Hood (plump rounded bean-dome covering head & upper body)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.45, 22, 16), this.hoodMat);
    dome.position.set(0, 0.64, 0);
    dome.scale.set(1.0, 1.06, 0.98);
    dome.castShadow = this.enableShadows;
    dome.receiveShadow = true;
    this.tiltGroup.add(dome);

    // Lower rounded hood cloak skirt
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.435, 0.46, 0.44, 22), this.hoodMat);
    skirt.position.set(0, 0.38, 0);
    skirt.castShadow = this.enableShadows;
    skirt.receiveShadow = true;
    this.tiltGroup.add(skirt);

    // Cute bottom rim hem
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.445, 0.045, 8, 22), this.hoodRimMat);
    hem.rotation.x = Math.PI / 2;
    hem.position.set(0, 0.17, 0);
    hem.castShadow = this.enableShadows;
    this.tiltGroup.add(hem);

    // Hood opening collar framing the round face (+Z is forward)
    const hoodCollar = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.052, 10, 22), this.hoodRimMat);
    hoodCollar.position.set(0, 0.61, 0.375);
    hoodCollar.scale.set(1.04, 1.0, 0.72);
    this.tiltGroup.add(hoodCollar);

    // Round Face proudly nestled in the front opening of the hood dome
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.285, 20, 16), this.faceMat);
    face.position.set(0, 0.61, 0.315);
    face.scale.set(1.0, 0.96, 0.62);
    face.receiveShadow = true;
    this.tiltGroup.add(face);

    // Two Black Oval Eyes
    const eyeGeo = new THREE.SphereGeometry(1, 12, 10);
    const glintGeo = new THREE.SphereGeometry(0.018, 8, 8);

    this.leftEye = new THREE.Group();
    const leftEyeBall = new THREE.Mesh(eyeGeo, eyeMat);
    leftEyeBall.scale.set(0.052, 0.095, 0.032);
    const leftGlint = new THREE.Mesh(glintGeo, glintMat);
    leftGlint.position.set(-0.016, 0.038, 0.025);
    this.leftEye.add(leftEyeBall, leftGlint);
    this.leftEye.position.set(-0.092, 0.635, 0.482);
    this.leftEye.rotation.y = -0.18;
    this.tiltGroup.add(this.leftEye);

    this.rightEye = new THREE.Group();
    const rightEyeBall = new THREE.Mesh(eyeGeo, eyeMat);
    rightEyeBall.scale.set(0.052, 0.095, 0.032);
    const rightGlint = new THREE.Mesh(glintGeo, glintMat);
    rightGlint.position.set(-0.016, 0.038, 0.025);
    this.rightEye.add(rightEyeBall, rightGlint);
    this.rightEye.position.set(0.092, 0.635, 0.482);
    this.rightEye.rotation.y = 0.18;
    this.tiltGroup.add(this.rightEye);

    // Cute stubby little feet tucked under the dome rim
    const footGeo = new THREE.SphereGeometry(0.115, 10, 8);
    this.leftFoot = new THREE.Mesh(footGeo, this.hoodRimMat);
    this.leftFoot.scale.set(0.9, 0.65, 1.25);
    this.leftFoot.position.set(-0.17, 0.075, 0.04);
    this.leftFoot.castShadow = this.enableShadows;

    this.rightFoot = new THREE.Mesh(footGeo, this.hoodRimMat);
    this.rightFoot.scale.set(0.9, 0.65, 1.25);
    this.rightFoot.position.set(0.17, 0.075, 0.04);
    this.rightFoot.castShadow = this.enableShadows;
    this.tiltGroup.add(this.leftFoot, this.rightFoot);

    // Back hood fold tail
    const hoodTip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 10), this.hoodRimMat);
    hoodTip.position.set(0, 0.72, -0.43);
    hoodTip.rotation.x = -1.25;
    this.tiltGroup.add(hoodTip);

    // Build all 5 decoration groups (toggle visibility on skin switch)
    this._buildDecorations();

    // Optional name tag (for multiplayer)
    this.nameTag = null;
    if (options.showNameTag) {
      this.setNameTag(this.skin.name);
    }

    // Drop shadow blob
    const shadowGeo = new THREE.CircleGeometry(0.48, 18);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: getDropShadowTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.dropShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.dropShadow.position.y = 0.02;

    // Animation state
    this.facingYaw = Math.PI;
    this.scaleY = 1.0;
    this.scaleVel = 0.0;
    this.walkPhase = 0.0;
    this.decoTime = 0.0;
    this.blinkTimer = 2.8;
    this.blinkDuration = 0;

    this.applySkin(this.skin);
  }

  _buildDecorations() {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffcf33,
      roughness: 0.24,
      metalness: 0.6,
      emissive: 0x5c3800,
      emissiveIntensity: 0.25,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.05,
      emissive: 0xdceeff,
      emissiveIntensity: 0.18,
    });

    // 1. Mini Crown (on top of head)
    this.decoCrown = new THREE.Group();
    this.decoCrown.position.set(0, 1.15, 0.02);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.12, 14), goldMat);
    this.decoCrown.add(band);
    const gemPink = new THREE.MeshStandardMaterial({ color: 0xff4f9a, roughness: 0.2, emissive: 0x661133, emissiveIntensity: 0.3 });
    const gemBlue = new THREE.MeshStandardMaterial({ color: 0x3bc9ff, roughness: 0.2, emissive: 0x114466, emissiveIntensity: 0.3 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const sx = Math.cos(a) * 0.155;
      const sz = Math.sin(a) * 0.155;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 5), goldMat);
      spike.position.set(sx, 0.11, sz);
      this.decoCrown.add(spike);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), i % 2 === 0 ? gemPink : gemBlue);
      gem.position.set(Math.cos(a) * 0.175, -0.01, Math.sin(a) * 0.175);
      this.decoCrown.add(gem);
    }
    this.tiltGroup.add(this.decoCrown);

    // 2. White Wings (2 wings on back, flap with walking & jumping)
    this.decoWings = new THREE.Group();
    this.decoWings.position.set(0, 0.62, -0.42);
    const wingGeo = createWingGeometry();
    this.wingLeft = new THREE.Mesh(wingGeo, wingMat);
    this.wingLeft.position.set(-0.08, 0, 0);
    this.wingLeft.scale.x = -1;
    this.wingLeft.rotation.y = 0.45;
    this.wingRight = new THREE.Mesh(wingGeo, wingMat);
    this.wingRight.position.set(0.08, 0, 0);
    this.wingRight.rotation.y = -0.45;
    this.decoWings.add(this.wingLeft, this.wingRight);
    this.tiltGroup.add(this.decoWings);

    // 3. Golden Halo (floats above head and slowly spins)
    this.decoHalo = new THREE.Group();
    this.decoHalo.position.set(0, 1.32, 0);
    const haloRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.036, 10, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffe055,
        roughness: 0.2,
        metalness: 0.55,
        emissive: 0xffb800,
        emissiveIntensity: 0.55,
      })
    );
    haloRing.rotation.x = Math.PI / 2;
    this.decoHalo.add(haloRing);
    this.tiltGroup.add(this.decoHalo);

    // 4. Sparkling Star (floats beside head & glitters)
    this.decoStar = new THREE.Group();
    this.decoStar.position.set(0.48, 1.06, 0.06);
    const starGeo = new THREE.ExtrudeGeometry(createStarShape(0.15, 0.068, 5), {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.012,
      bevelSegments: 2,
    });
    starGeo.translate(0, 0, -0.02);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xffe44d,
      roughness: 0.2,
      metalness: 0.45,
      emissive: 0xffae00,
      emissiveIntensity: 0.55,
    });
    this.starMain = new THREE.Mesh(starGeo, starMat);
    this.decoStar.add(this.starMain);
    this.starSparks = [];
    const sparkGeo = new THREE.OctahedronGeometry(0.035, 0);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfff8b5 });
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(sparkGeo, sparkMat);
      this.decoStar.add(sp);
      this.starSparks.push(sp);
    }
    this.tiltGroup.add(this.decoStar);
  }

  applySkin(skin) {
    this.skin = normalizeSkin(skin);
    const hoodColor = new THREE.Color(this.skin.hood);
    this.hoodMat.color.copy(hoodColor);
    this.hoodRimMat.color.copy(hoodColor).multiplyScalar(0.75);
    this.faceMat.color.set(this.skin.face);

    this.decoCrown.visible = this.skin.deco === 'crown';
    this.decoWings.visible = this.skin.deco === 'wings';
    this.decoHalo.visible = this.skin.deco === 'halo';
    this.decoStar.visible = this.skin.deco === 'star';

    if (this.nameTag) {
      this.setNameTag(this.skin.name);
    }
  }

  setNameTag(name) {
    if (this.nameTag) {
      this.root.remove(this.nameTag);
      this.nameTag.material.map.dispose();
      this.nameTag.material.dispose();
      this.nameTag = null;
    }
    if (name) {
      this.nameTag = createNameTagSprite(name);
      this.root.add(this.nameTag);
    }
  }

  reset() {
    this.facingYaw = Math.PI;
    this.scaleY = 1.0;
    this.scaleVel = 0.0;
    this.walkPhase = 0.0;
    this.root.rotation.y = this.facingYaw;
    this.squashPivot.scale.set(1, 1, 1);
    this.tiltGroup.rotation.set(0, 0, 0);
  }

  triggerJump(isBounce = false) {
    if (isBounce) {
      this.scaleY = 1.46;
      this.scaleVel = 3.2;
    } else {
      this.scaleY = 1.32;
      this.scaleVel = 2.0;
    }
  }

  triggerLand(impactSpeed) {
    const strength = Math.min(1.0, Math.max(0.18, impactSpeed / 18.0));
    this.scaleY = Math.max(0.56, 0.90 - strength * 0.34);
    this.scaleVel = -2.4 - strength * 2.6;
  }

  triggerBonk() {
    this.scaleY = 0.68;
    this.scaleVel = -3.0;
  }

  updateDecorations(dt, grounded = true, horizSpeed = 0) {
    this.decoTime += dt;
    if (this.decoWings.visible) {
      const flapSpeed = grounded ? (horizSpeed > 0.3 ? 13 : 3.2) : 18;
      const flapAmp = grounded ? (horizSpeed > 0.3 ? 0.35 : 0.1) : 0.52;
      const flap = Math.sin(this.decoTime * flapSpeed) * flapAmp;
      this.wingLeft.rotation.y = 0.42 + flap;
      this.wingRight.rotation.y = -0.42 - flap;
      this.wingLeft.rotation.z = flap * 0.25;
      this.wingRight.rotation.z = -flap * 0.25;
    }
    if (this.decoHalo.visible) {
      this.decoHalo.rotation.y += dt * 1.4;
      this.decoHalo.position.y = 1.32 + Math.sin(this.decoTime * 2.8) * 0.035;
    }
    if (this.decoStar.visible) {
      this.starMain.rotation.y += dt * 2.2;
      this.decoStar.position.y = 1.06 + Math.sin(this.decoTime * 3.2) * 0.055;
      for (let i = 0; i < this.starSparks.length; i++) {
        const a = this.decoTime * 3.1 + (i * Math.PI * 2) / 3;
        this.starSparks[i].position.set(
          Math.cos(a) * 0.21,
          Math.sin(a * 1.4) * 0.14,
          Math.sin(a) * 0.21
        );
        const s = 0.7 + 0.55 * Math.sin(this.decoTime * 7 + i * 2);
        this.starSparks[i].scale.setScalar(s);
      }
    }
  }

  update(dt, state, shadowY) {
    const horizSpeed = Math.hypot(state.vx, state.vz);
    if (horizSpeed > 0.35) {
      const targetYaw = Math.atan2(state.vx, state.vz);
      let diff = targetYaw - this.facingYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = Math.min(1, dt * 15);
      this.facingYaw += diff * turnRate;
    }
    this.root.position.set(state.x, state.y, state.z);
    this.root.rotation.y = this.facingYaw;

    let targetScaleY = 1.0;
    let targetRoll = 0;
    let targetPitch = 0;

    if (state.grounded) {
      if (horizSpeed > 0.25) {
        const freq = state.isDashing ? 15.0 : 10.5;
        this.walkPhase += dt * freq;
        const amp = state.isDashing ? 0.095 : 0.065;
        targetScaleY = 1.0 + Math.sin(this.walkPhase * 2) * amp;
        targetRoll = Math.sin(this.walkPhase) * (state.isDashing ? 0.13 : 0.085);
        targetPitch = state.isDashing ? 0.16 : 0.07;

        const footSwing = Math.sin(this.walkPhase);
        this.leftFoot.position.z = 0.04 + footSwing * 0.12;
        this.leftFoot.position.y = 0.075 + Math.max(0, footSwing) * 0.07;
        this.rightFoot.position.z = 0.04 - footSwing * 0.12;
        this.rightFoot.position.y = 0.075 + Math.max(0, -footSwing) * 0.07;
      } else {
        this.walkPhase += dt * 2.4;
        targetScaleY = 1.0 + Math.sin(this.walkPhase) * 0.025;
        this.leftFoot.position.set(-0.17, 0.075, 0.04);
        this.rightFoot.position.set(0.17, 0.075, 0.04);
      }
    } else {
      if (state.vy > 1.5) {
        targetScaleY = 1.0 + Math.min(0.24, state.vy * 0.018);
        targetPitch = -0.08;
      } else if (state.vy < -6.0) {
        const fallRatio = Math.min(1, (-state.vy - 6.0) / 18.0);
        targetScaleY = 1.0 - fallRatio * 0.16;
        targetPitch = 0.06 + fallRatio * 0.08;
      } else {
        targetScaleY = 1.02;
      }
      this.leftFoot.position.set(-0.17, 0.05, -0.02);
      this.rightFoot.position.set(0.17, 0.05, 0.06);
    }

    const stiffness = 195.0;
    const damping = 14.5;
    const force = (targetScaleY - this.scaleY) * stiffness - this.scaleVel * damping;
    this.scaleVel += force * dt;
    this.scaleY += this.scaleVel * dt;
    this.scaleY = Math.max(0.52, Math.min(1.55, this.scaleY));

    const scaleXZ = 1.0 / Math.sqrt(this.scaleY);
    this.squashPivot.scale.set(scaleXZ, this.scaleY, scaleXZ);

    const tiltLerp = Math.min(1, dt * 14);
    this.tiltGroup.rotation.z += (targetRoll - this.tiltGroup.rotation.z) * tiltLerp;
    this.tiltGroup.rotation.x += (targetPitch - this.tiltGroup.rotation.x) * tiltLerp;

    this.updateDecorations(dt, state.grounded, horizSpeed);

    // Blink
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkDuration = 0.11;
      this.blinkTimer = 2.4 + Math.random() * 2.8;
    }
    const eyeSY = this.blinkDuration > 0 ? 0.12 : 1.0;
    if (this.blinkDuration > 0) this.blinkDuration -= dt;
    this.leftEye.scale.y = eyeSY;
    this.rightEye.scale.y = eyeSY;

    // Drop shadow
    if (shadowY !== null && shadowY !== undefined) {
      this.dropShadow.visible = true;
      const heightAbove = Math.max(0, state.y - shadowY);
      this.dropShadow.position.set(state.x, shadowY + 0.025, state.z);
      const s = Math.max(0.38, 1.05 - heightAbove * 0.085);
      this.dropShadow.scale.set(s, s, s);
      this.dropShadow.material.opacity = Math.max(0.12, 0.9 - heightAbove * 0.09);
    } else {
      this.dropShadow.visible = false;
    }
  }
}
