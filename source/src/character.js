import * as THREE from 'three';
import { PALETTE } from './constants.js';

function createDropShadowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(20, 35, 60, 0.42)');
  grad.addColorStop(0.6, 'rgba(20, 35, 60, 0.22)');
  grad.addColorStop(1, 'rgba(20, 35, 60, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export class OtaCharacter {
  constructor() {
    this.root = new THREE.Group();
    this.squashPivot = new THREE.Group();
    this.tiltGroup = new THREE.Group();
    this.squashPivot.add(this.tiltGroup);
    this.root.add(this.squashPivot);

    // Materials (clean, bright, Fall Guys-style soft vinyl/plush look)
    const hoodMat = new THREE.MeshStandardMaterial({
      color: PALETTE.hoodBlue,
      roughness: 0.42,
      metalness: 0.04,
    });
    const hoodRimMat = new THREE.MeshStandardMaterial({
      color: PALETTE.hoodBlueDark,
      roughness: 0.48,
      metalness: 0.04,
    });
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.0,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x11131a,
      roughness: 0.2,
      metalness: 0.1,
    });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Main Blue Dome Hood (plump rounded bean-dome covering the whole head & body)
    // Upper dome + cylindrical midsection + rounded bottom
    const domeGeo = new THREE.SphereGeometry(0.45, 24, 18);
    const dome = new THREE.Mesh(domeGeo, hoodMat);
    dome.position.set(0, 0.64, 0);
    dome.scale.set(1.0, 1.06, 0.98);
    dome.castShadow = true;
    dome.receiveShadow = true;
    this.tiltGroup.add(dome);

    // Lower rounded hood cloak skirt so the dome sits like a cozy poncho/hood
    const skirtGeo = new THREE.CylinderGeometry(0.435, 0.46, 0.44, 24);
    const skirt = new THREE.Mesh(skirtGeo, hoodMat);
    skirt.position.set(0, 0.38, 0);
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    this.tiltGroup.add(skirt);

    // Cute subtle bottom rim hem
    const hemGeo = new THREE.TorusGeometry(0.445, 0.045, 10, 24);
    const hem = new THREE.Mesh(hemGeo, hoodRimMat);
    hem.rotation.x = Math.PI / 2;
    hem.position.set(0, 0.17, 0);
    hem.castShadow = true;
    this.tiltGroup.add(hem);

    // Subtle hood opening collar framing the white round face (+Z is forward)
    const hoodCollarGeo = new THREE.TorusGeometry(0.285, 0.052, 12, 24);
    const hoodCollar = new THREE.Mesh(hoodCollarGeo, hoodRimMat);
    hoodCollar.position.set(0, 0.61, 0.375);
    hoodCollar.scale.set(1.04, 1.0, 0.72);
    this.tiltGroup.add(hoodCollar);

    // White Round Face (proudly nestled in the front opening of the blue dome)
    const faceGeo = new THREE.SphereGeometry(0.285, 22, 18);
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, 0.61, 0.315);
    face.scale.set(1.0, 0.96, 0.62);
    face.receiveShadow = true;
    this.tiltGroup.add(face);

    // Two Black Oval Eyes (symmetric vertical ovals on the white round face)
    const eyeGeo = new THREE.SphereGeometry(1, 14, 12);
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
    const footGeo = new THREE.SphereGeometry(0.115, 12, 10);
    this.leftFoot = new THREE.Mesh(footGeo, hoodRimMat);
    this.leftFoot.scale.set(0.9, 0.65, 1.25);
    this.leftFoot.position.set(-0.17, 0.075, 0.04);
    this.leftFoot.castShadow = true;

    this.rightFoot = new THREE.Mesh(footGeo, hoodRimMat);
    this.rightFoot.scale.set(0.9, 0.65, 1.25);
    this.rightFoot.position.set(0.17, 0.075, 0.04);
    this.rightFoot.castShadow = true;

    this.tiltGroup.add(this.leftFoot, this.rightFoot);

    // Subtle back hood tail/fold so character has charming silhouette from behind
    const hoodTipGeo = new THREE.ConeGeometry(0.14, 0.24, 12);
    const hoodTip = new THREE.Mesh(hoodTipGeo, hoodRimMat);
    hoodTip.position.set(0, 0.72, -0.43);
    hoodTip.rotation.x = -1.25;
    this.tiltGroup.add(hoodTip);

    // Drop shadow blob (added directly to scene so it tracks surface below player)
    const shadowGeo = new THREE.CircleGeometry(0.48, 20);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createDropShadowTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.dropShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.dropShadow.position.y = 0.02;

    // Animation state
    this.facingYaw = Math.PI; // Faces -Z (North) at spawn
    this.scaleY = 1.0;
    this.scaleVel = 0.0;
    this.walkPhase = 0.0;
    this.blinkTimer = 2.8;
    this.blinkDuration = 0;
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

  update(dt, state, shadowY) {
    // 1. Facing direction (smoothly turn toward horizontal velocity)
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

    // 2. Target squash & stretch based on motion
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

        // Cute waddling feet
        const footSwing = Math.sin(this.walkPhase);
        this.leftFoot.position.z = 0.04 + footSwing * 0.12;
        this.leftFoot.position.y = 0.075 + Math.max(0, footSwing) * 0.07;
        this.rightFoot.position.z = 0.04 - footSwing * 0.12;
        this.rightFoot.position.y = 0.075 + Math.max(0, -footSwing) * 0.07;
      } else {
        // Gentle idle breathing
        this.walkPhase += dt * 2.4;
        targetScaleY = 1.0 + Math.sin(this.walkPhase) * 0.025;
        this.leftFoot.position.set(-0.17, 0.075, 0.04);
        this.rightFoot.position.set(0.17, 0.075, 0.04);
      }
    } else {
      // Airborne
      if (state.vy > 1.5) {
        // Rising: stretch upward
        targetScaleY = 1.0 + Math.min(0.24, state.vy * 0.018);
        targetPitch = -0.08;
      } else if (state.vy < -6.0) {
        // Fast falling: slightly tuck / shrink ("落下が速いと少し縮む")
        const fallRatio = Math.min(1, (-state.vy - 6.0) / 18.0);
        targetScaleY = 1.0 - fallRatio * 0.16;
        targetPitch = 0.06 + fallRatio * 0.08;
      } else {
        targetScaleY = 1.02;
      }
      // Cute dangling feet in midair
      this.leftFoot.position.set(-0.17, 0.05, -0.02);
      this.rightFoot.position.set(0.17, 0.05, 0.06);
    }

    // Damped spring integration for squishy bounce-back
    const stiffness = 195.0;
    const damping = 14.5;
    const force = (targetScaleY - this.scaleY) * stiffness - this.scaleVel * damping;
    this.scaleVel += force * dt;
    this.scaleY += this.scaleVel * dt;
    this.scaleY = Math.max(0.52, Math.min(1.55, this.scaleY));

    // Volume-preserving horizontal stretch
    const scaleXZ = 1.0 / Math.sqrt(this.scaleY);
    this.squashPivot.scale.set(scaleXZ, this.scaleY, scaleXZ);

    // Smooth tilt
    const tiltLerp = Math.min(1, dt * 14);
    this.tiltGroup.rotation.z += (targetRoll - this.tiltGroup.rotation.z) * tiltLerp;
    this.tiltGroup.rotation.x += (targetPitch - this.tiltGroup.rotation.x) * tiltLerp;

    // 3. Cute blinking eyes
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkDuration = 0.11;
      this.blinkTimer = 2.4 + Math.random() * 2.8;
    }
    if (this.blinkDuration > 0) {
      this.blinkDuration -= dt;
      const eyeScaleY = 0.12;
      this.leftEye.scale.y = eyeScaleY;
      this.rightEye.scale.y = eyeScaleY;
    } else {
      this.leftEye.scale.y = 1.0;
      this.rightEye.scale.y = 1.0;
    }

    // 4. Drop shadow positioning on highest surface below player
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
