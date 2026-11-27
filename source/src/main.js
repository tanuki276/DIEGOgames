import * as THREE from 'three';
import { GOAL_HEIGHT, PALETTE, PHYSICS } from './constants.js';
import { sound } from './audio.js';
import { OtaCharacter } from './character.js';
import { Course } from './course.js';
import { PhysicsEngine } from './physics.js';
import { InputController } from './controls.js';

function formatTime(sec) {
  const clamped = Math.max(0, sec);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const cs = Math.floor((clamped * 100) % 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function createSkyDome() {
  const geo = new THREE.SphereGeometry(145, 24, 16);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const topColor = new THREE.Color(0x3ab6ff);
  const midColor = new THREE.Color(0x7cd3ff);
  const botColor = new THREE.Color(0xd2f1ff);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 145; // -1..1
    if (y >= 0) {
      const t = Math.pow(y, 0.6);
      tmp.copy(botColor).lerp(midColor, Math.min(1, t * 1.4)).lerp(topColor, t);
    } else {
      tmp.copy(botColor);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  return new THREE.Mesh(geo, mat);
}

class ConfettiSystem {
  constructor(scene) {
    this.count = 160;
    const geo = new THREE.PlaneGeometry(0.24, 0.14);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;

    const palette = [0xff5e8a, 0xffd166, 0x4cc9f0, 0x72efdd, 0xb794ff, 0xff9f68, 0xffffff];
    const color = new THREE.Color();
    this.particles = [];
    for (let i = 0; i < this.count; i++) {
      color.setHex(palette[i % palette.length]);
      this.mesh.setColorAt(i, color);
      this.particles.push({
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        rx: 0, ry: 0, rz: 0,
        vrx: 0, vry: 0, vrz: 0,
      });
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.dummy = new THREE.Object3D();
    this.active = false;
    this.origin = new THREE.Vector3();
    scene.add(this.mesh);
  }

  burst(origin) {
    this.origin.copy(origin);
    this.active = true;
    this.mesh.visible = true;
    for (let i = 0; i < this.count; i++) {
      this._spawnParticle(this.particles[i], true);
    }
  }

  _spawnParticle(p, isBurst) {
    const a = Math.random() * Math.PI * 2;
    const spd = isBurst ? 2.2 + Math.random() * 6.5 : 0.6 + Math.random() * 2.5;
    p.x = this.origin.x + (Math.random() - 0.5) * (isBurst ? 0.8 : 5.5);
    p.y = this.origin.y + (isBurst ? Math.random() * 0.6 : 2.8 + Math.random() * 2.5);
    p.z = this.origin.z + (Math.random() - 0.5) * (isBurst ? 0.8 : 5.5);
    p.vx = Math.cos(a) * spd;
    p.vy = isBurst ? 4.2 + Math.random() * 6.2 : -1.2 - Math.random() * 1.4;
    p.vz = Math.sin(a) * spd;
    p.rx = Math.random() * Math.PI;
    p.ry = Math.random() * Math.PI;
    p.rz = Math.random() * Math.PI;
    p.vrx = (Math.random() - 0.5) * 9;
    p.vry = (Math.random() - 0.5) * 9;
    p.vrz = (Math.random() - 0.5) * 9;
  }

  stop() {
    this.active = false;
    this.mesh.visible = false;
  }

  update(dt) {
    if (!this.active) return;
    const d = this.dummy;
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      p.vy -= 5.8 * dt;
      p.vx *= Math.max(0, 1 - 1.2 * dt);
      p.vz *= Math.max(0, 1 - 1.2 * dt);
      if (p.vy < -2.6) p.vy = -2.6;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rx += p.vrx * dt;
      p.ry += p.vry * dt;
      p.rz += p.vrz * dt;

      if (p.y < this.origin.y - 3.6) {
        this._spawnParticle(p, false);
      }

      d.position.set(p.x, p.y, p.z);
      d.rotation.set(p.rx, p.ry, p.rz);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function initGame() {
  const canvas = document.getElementById('game-canvas');

  // Renderer (tuned for crisp 60fps on both desktop and mobile!)
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  // Scene & bright cheerful sky
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x93d9ff);
  scene.fog = new THREE.Fog(0xcbeeff, 48, 128);
  scene.add(createSkyDome());

  // Soft pastel lighting (1 Hemisphere + 1 Directional light with shadow)
  const hemiLight = new THREE.HemisphereLight(0xd9f3ff, 0xffe4cc, 0.92);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.32);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 75;
  const shadowExtent = 24;
  sunLight.shadow.camera.left = -shadowExtent;
  sunLight.shadow.camera.right = shadowExtent;
  sunLight.shadow.camera.top = shadowExtent;
  sunLight.shadow.camera.bottom = -shadowExtent;
  sunLight.shadow.bias = -0.0008;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Camera
  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.15, 220);

  // Game world
  const course = new Course(scene);
  const character = new OtaCharacter();
  scene.add(character.root);
  scene.add(character.dropShadow);
  const confetti = new ConfettiSystem(scene);

  // UI refs
  const ui = {
    timerText: document.getElementById('hud-timer'),
    altText: document.getElementById('hud-alt'),
    pctText: document.getElementById('hud-pct'),
    pctBar: document.getElementById('hud-pct-bar'),
    toast: document.getElementById('flag-toast'),
    toastPct: document.getElementById('toast-pct'),
    toastLabel: document.getElementById('toast-label'),
    clearModal: document.getElementById('clear-modal'),
    clearTime: document.getElementById('clear-time'),
    clearBest: document.getElementById('clear-best'),
    replayBtn: document.getElementById('replay-btn'),
    muteBtn: document.getElementById('mute-btn'),
    touchLayer: document.getElementById('touch-layer'),
    touchCatcher: document.getElementById('game-wrap'),
    joyBase: document.getElementById('joy-base'),
    joyKnob: document.getElementById('joy-knob'),
    joyDashBadge: document.getElementById('joy-dash-badge'),
    jumpBtn: document.getElementById('jump-btn'),
    pointerHint: document.getElementById('pointer-hint'),
  };

  let elapsedTime = 0;
  let toastTimeout = null;
  let bestTime = null;
  try {
    const saved = localStorage.getItem('sky_crown_best_time');
    if (saved) bestTime = parseFloat(saved);
  } catch {
    // Ignore storage errors in sandboxed iframes
  }

  function showToast(flag) {
    ui.toastPct.textContent = `${flag.pct}% 到達！`;
    ui.toastLabel.textContent = flag.label;
    ui.toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      ui.toast.classList.remove('show');
    }, 2400);
  }

  const physics = new PhysicsEngine(course, {
    onJump: () => {
      character.triggerJump(false);
      sound.jump();
    },
    onBounce: () => {
      character.triggerJump(true);
      sound.bounce();
    },
    onLand: (impactVy) => {
      character.triggerLand(impactVy);
      sound.land(Math.min(1, impactVy / 18));
    },
    onBonk: () => {
      character.triggerBonk();
      sound.bonk();
    },
    onFlagReached: (flag) => {
      sound.flag();
      showToast(flag);
    },
    onGoalReached: () => {
      sound.win();
      confetti.burst(course.crownPos);
      if (document.pointerLockElement && document.exitPointerLock) {
        try { document.exitPointerLock(); } catch {}
      }
      let isNewRecord = false;
      if (bestTime === null || elapsedTime < bestTime) {
        bestTime = elapsedTime;
        isNewRecord = true;
        try { localStorage.setItem('sky_crown_best_time', String(bestTime)); } catch {}
      }
      ui.clearTime.textContent = formatTime(elapsedTime);
      ui.clearBest.textContent = isNewRecord
        ? `NEW RECORD! (${formatTime(bestTime)})`
        : `BEST ${formatTime(bestTime)}`;
      ui.clearModal.classList.add('show');
    },
  });

  const controls = new InputController(canvas, ui, {
    onAnyInput: () => sound.unlock(),
    onJumpPress: () => physics.queueJump(),
  });

  // Reset / Replay flow
  function resetRun() {
    elapsedTime = 0;
    course.resetDynamic();
    physics.reset();
    character.reset();
    controls.resetCamera();
    confetti.stop();
    ui.clearModal.classList.remove('show');
    ui.toast.classList.remove('show');
    updateHUD();
  }

  ui.replayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sound.unlock();
    resetRun();
  });

  ui.muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const muted = sound.toggleMute();
    ui.muteBtn.textContent = muted ? '🔇' : '🔊';
    ui.muteBtn.setAttribute('aria-label', muted ? 'サウンドをオンにする' : 'サウンドをミュートする');
  });

  // Resize handler
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // Smooth third-person camera state
  const camTarget = new THREE.Vector3(0, 1.3, 2.2);
  const camPos = new THREE.Vector3(0, 4.0, 9.4);

  function updateCamera(dt, instant = false) {
    const s = physics.state;
    const desiredTargetX = s.x;
    const desiredTargetY = s.y + 1.15;
    const desiredTargetZ = s.z;

    if (instant) {
      camTarget.set(desiredTargetX, desiredTargetY, desiredTargetZ);
    } else {
      const tXZ = Math.min(1, dt * 16);
      const tY = Math.min(1, dt * 10);
      camTarget.x += (desiredTargetX - camTarget.x) * tXZ;
      camTarget.y += (desiredTargetY - camTarget.y) * tY;
      camTarget.z += (desiredTargetZ - camTarget.z) * tXZ;
    }

    const yaw = controls.cameraYaw;
    const pitch = controls.cameraPitch;
    const dist = 7.4;

    const desiredX = camTarget.x + Math.sin(yaw) * Math.cos(pitch) * dist;
    const desiredY = Math.max(0.65, camTarget.y + Math.sin(pitch) * dist);
    const desiredZ = camTarget.z + Math.cos(yaw) * Math.cos(pitch) * dist;

    if (instant) {
      camPos.set(desiredX, desiredY, desiredZ);
    } else {
      const cLerp = Math.min(1, dt * 14);
      camPos.x += (desiredX - camPos.x) * cLerp;
      camPos.y += (desiredY - camPos.y) * cLerp;
      camPos.z += (desiredZ - camPos.z) * cLerp;
    }

    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    // Keep shadow frustum centered around player so shadows stay crisp all the way to 34.6m!
    sunLight.target.position.set(s.x, s.y, s.z);
    sunLight.position.set(s.x + 16, s.y + 28, s.z + 14);
  }

  let lastHudAlt = '';
  let lastHudPct = -1;
  function updateHUD() {
    const s = physics.state;
    ui.timerText.textContent = formatTime(elapsedTime);
    const alt = Math.max(0, s.y);
    const altStr = `${alt.toFixed(1)}m`;
    if (altStr !== lastHudAlt) {
      lastHudAlt = altStr;
      ui.altText.textContent = altStr;
    }
    const pct = Math.min(100, Math.max(0, Math.round((alt / GOAL_HEIGHT) * 100)));
    if (pct !== lastHudPct) {
      lastHudPct = pct;
      ui.pctText.textContent = `${pct}%`;
      ui.pctBar.style.width = `${pct}%`;
    }
  }

  // Initialize state
  resetRun();
  updateCamera(0.016, true);

  // Main fixed-timestep loop
  let lastNow = performance.now();
  let accumulator = 0;
  let frameCount = 0;
  let fps = 60;
  let fpsTimer = 0;

  // Test/debug hook for deterministic verification (read-only + optional scripted input override)
  let scriptedInput = null;
  let paused = false;
  window.__GAME__ = {
    PHYSICS,
    GOAL_HEIGHT,
    setPaused: (v) => { paused = !!v; },
    getState: () => {
      const { groundPlat, ...rest } = physics.state;
      return {
        ...rest,
        groundPlatId: groundPlat ? groundPlat.id : null,
        elapsedTime,
        cameraYaw: controls.cameraYaw,
        cameraPitch: controls.cameraPitch,
        fps,
        drawCalls: renderer.info.render.calls,
        flagsReached: course.flags.filter((f) => f.reached).length,
        totalFlags: course.flags.length,
        courseTime: course.time,
      };
    },
    getCourseInfo: () => ({
      platforms: course.platforms.map((p) => ({
        id: p.id,
        shape: p.shape,
        x: p.x,
        topY: p.topY,
        z: p.z,
        w: p.w,
        h: p.h,
        d: p.d,
        r: p.r,
        isBouncePad: !!p.isBouncePad,
        moveAxis: p.moveAxis || null,
        angle: p.angle || 0,
      })),
      crownPos: { x: course.crownPos.x, y: course.crownPos.y, z: course.crownPos.z },
      bars: course.rotatingBars.map((b) => ({ x: b.x, y: b.y, z: b.z, angle: b.angle })),
      pendulums: course.pendulums.map((h) => ({ headX: h.headX, headY: h.headY, headZ: h.headZ, angle: h.angle })),
    }),
    setScriptedInput: (inp) => { scriptedInput = inp; },
    triggerJump: () => physics.queueJump(),
    setCamera: (yaw, pitch = 0.34) => {
      controls.cameraYaw = yaw;
      controls.cameraPitch = pitch;
    },
    stepFixed: (steps, inp, shouldRender = false) => {
      for (let i = 0; i < steps; i++) {
        physics.step(PHYSICS.FIXED_DT, inp || controls.getInput());
        if (physics.state.hasMoved && !physics.state.finished) {
          elapsedTime += PHYSICS.FIXED_DT;
        }
      }
      if (shouldRender) {
        const shadowY = physics.getShadowSurfaceY(physics.state.x, physics.state.y, physics.state.z);
        character.update(steps * PHYSICS.FIXED_DT, physics.state, shadowY);
        course.updateVisuals(steps * PHYSICS.FIXED_DT);
        updateCamera(steps * PHYSICS.FIXED_DT, true);
        updateHUD();
        renderer.render(scene, camera);
      }
    },
    renderNow: () => {
      const shadowY = physics.getShadowSurfaceY(physics.state.x, physics.state.y, physics.state.z);
      character.update(0.016, physics.state, shadowY);
      course.updateVisuals(0.016);
      confetti.update(0.016);
      updateCamera(0.016, true);
      updateHUD();
      renderer.render(scene, camera);
    },
    teleportForTest: (x, y, z, vy = 0) => {
      physics.state.x = x;
      physics.state.y = y;
      physics.state.z = z;
      physics.state.vx = 0;
      physics.state.vy = vy;
      physics.state.vz = 0;
      physics.state.grounded = false;
      physics.state.groundPlat = null;
    },
    resetRun,
  };

  function animate(now) {
    requestAnimationFrame(animate);
    const frameDt = Math.min(0.05, Math.max(0.0001, (now - lastNow) / 1000));
    lastNow = now;

    frameCount++;
    fpsTimer += frameDt;
    if (fpsTimer >= 0.5) {
      fps = Math.round(frameCount / fpsTimer);
      frameCount = 0;
      fpsTimer = 0;
    }

    if (!paused) {
      const input = scriptedInput || controls.getInput();
      accumulator += frameDt;
      while (accumulator >= PHYSICS.FIXED_DT) {
        physics.step(PHYSICS.FIXED_DT, input);
        if (physics.state.hasMoved && !physics.state.finished) {
          elapsedTime += PHYSICS.FIXED_DT;
        }
        accumulator -= PHYSICS.FIXED_DT;
      }

      const shadowY = physics.getShadowSurfaceY(physics.state.x, physics.state.y, physics.state.z);
      character.update(frameDt, physics.state, shadowY);
      course.updateVisuals(frameDt);
      confetti.update(frameDt);
      updateCamera(frameDt, false);
      updateHUD();

      renderer.render(scene, camera);
    }
  }

  requestAnimationFrame(animate);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
