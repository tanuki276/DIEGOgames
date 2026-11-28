import * as THREE from 'three';
import { GOAL_HEIGHT, PHYSICS, STAGES, getStageForY } from './constants.js';
import { loadBestTime, loadSkin, saveBestTime } from '../shared/storage.js';
import { sound } from '../shared/audio.js';
import { OtaCharacter } from '../shared/character.js';
import { GameMultiplayer } from '../shared/multiplayer.js';
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

// Dynamic Shader Sky Dome so stage sky colors blend smoothly with zero CPU vertex loops!
function createDynamicSkyDome() {
  const geo = new THREE.SphereGeometry(210, 20, 14);
  const uniforms = {
    uTop: { value: new THREE.Color(STAGES[0].skyTop) },
    uMid: { value: new THREE.Color(STAGES[0].skyMid) },
    uBot: { value: new THREE.Color(STAGES[0].skyBot) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uBot;
      varying vec3 vLocalPos;
      void main() {
        float h = clamp(vLocalPos.y, 0.0, 1.0);
        vec3 col = mix(uBot, uMid, smoothstep(0.0, 0.35, h));
        col = mix(col, uTop, smoothstep(0.25, 0.9, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return { mesh: new THREE.Mesh(geo, mat), uniforms };
}

class ConfettiSystem {
  constructor(scene) {
    this.count = 160;
    const geo = new THREE.PlaneGeometry(0.26, 0.15);
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
      this.particles.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, vrx: 0, vry: 0, vrz: 0 });
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
    for (let i = 0; i < this.count; i++) this._spawn(this.particles[i], true);
  }

  _spawn(p, isBurst) {
    const a = Math.random() * Math.PI * 2;
    const spd = isBurst ? 2.4 + Math.random() * 6.8 : 0.7 + Math.random() * 2.5;
    p.x = this.origin.x + (Math.random() - 0.5) * (isBurst ? 0.9 : 6.0);
    p.y = this.origin.y + (isBurst ? Math.random() * 0.6 : 3.0 + Math.random() * 2.5);
    p.z = this.origin.z + (Math.random() - 0.5) * (isBurst ? 0.9 : 6.0);
    p.vx = Math.cos(a) * spd;
    p.vy = isBurst ? 4.4 + Math.random() * 6.5 : -1.2 - Math.random() * 1.4;
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
      p.vy = Math.max(-2.6, p.vy - 5.8 * dt);
      p.vx *= Math.max(0, 1 - 1.2 * dt);
      p.vz *= Math.max(0, 1 - 1.2 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rx += p.vrx * dt;
      p.ry += p.vry * dt;
      p.rz += p.vrz * dt;
      if (p.y < this.origin.y - 3.8) this._spawn(p, false);
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(p.rx, p.ry, p.rz);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function initGame() {
  const params = new URLSearchParams(window.location.search);
  const isMultiplayer = params.get('mode') === 'mp' && params.get('room');
  const mpRole = params.get('role') === 'host' ? 'host' : 'guest';
  const mpRoom = params.get('room') || '';

  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(STAGES[0].fog);
  scene.fog = new THREE.Fog(STAGES[0].fog, 55, 165);
  const sky = createDynamicSkyDome();
  scene.add(sky.mesh);

  const hemiLight = new THREE.HemisphereLight(0xd9f3ff, 0xffe4cc, 0.92);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(STAGES[0].sun, 1.32);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 80;
  const shadowExtent = 25;
  sunLight.shadow.camera.left = -shadowExtent;
  sunLight.shadow.camera.right = shadowExtent;
  sunLight.shadow.camera.top = shadowExtent;
  sunLight.shadow.camera.bottom = -shadowExtent;
  sunLight.shadow.bias = -0.0008;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.15, 280);

  // Build 10-Stage World & Skinned Player Character
  const course = new Course(scene);
  let mySkin = loadSkin();
  const character = new OtaCharacter(mySkin, { castShadow: true });
  scene.add(character.root);
  scene.add(character.dropShadow);
  const confetti = new ConfettiSystem(scene);

  // Sync skin if changed in another tab
  window.addEventListener('storage', (e) => {
    if (e.key === 'diegogames_skin_v1') {
      mySkin = loadSkin();
      character.applySkin(mySkin);
      if (mpManager) mpManager.mySkin = mySkin;
    }
  });

  // UI refs
  const ui = {
    timerText: document.getElementById('hud-timer'),
    stageBadge: document.getElementById('hud-stage-num'),
    stageName: document.getElementById('hud-stage-name'),
    altText: document.getElementById('hud-alt'),
    pctText: document.getElementById('hud-pct'),
    pctBar: document.getElementById('hud-pct-bar'),
    toast: document.getElementById('flag-toast'),
    toastPct: document.getElementById('toast-pct'),
    toastLabel: document.getElementById('toast-label'),
    clearModal: document.getElementById('clear-modal'),
    clearTime: document.getElementById('clear-time'),
    clearBest: document.getElementById('clear-best'),
    mpRankingsBox: document.getElementById('mp-rankings-box'),
    mpRankingsList: document.getElementById('mp-rankings-list'),
    spectateBtn: document.getElementById('spectate-btn'),
    spectateBanner: document.getElementById('spectate-banner'),
    spectateTargetName: document.getElementById('spectate-target-name'),
    spectateNextBtn: document.getElementById('spectate-next-btn'),
    spectateResultsBtn: document.getElementById('spectate-results-btn'),
    replayBtn: document.getElementById('replay-btn'),
    homeBtn: document.getElementById('home-btn'),
    muteBtn: document.getElementById('mute-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    settingsClose: document.getElementById('settings-close'),
    setBgm: document.getElementById('set-bgm'),
    setBgmVal: document.getElementById('set-bgm-val'),
    setSe: document.getElementById('set-se'),
    setSeVal: document.getElementById('set-se-val'),
    setMute: document.getElementById('set-mute'),
    mpPill: document.getElementById('mp-pill'),
    mpPillText: document.getElementById('mp-pill-text'),
    hostLeftModal: document.getElementById('host-left-modal'),
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
  let bestTime = loadBestTime();
  let spectating = false;
  let spectateIndex = 0;

  function showToast(title, subtitle) {
    ui.toastPct.textContent = title;
    ui.toastLabel.textContent = subtitle;
    ui.toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => ui.toast.classList.remove('show'), 2500);
  }

  // Sync Settings UI <-> SoundEngine (diegogames_settings_v1)
  function syncSettingsUI(s) {
    ui.muteBtn.textContent = s.muted ? '🔇' : '🔊';
    ui.setBgm.value = String(Math.round(s.bgm * 100));
    ui.setBgmVal.textContent = `${Math.round(s.bgm * 100)}%`;
    ui.setSe.value = String(Math.round(s.se * 100));
    ui.setSeVal.textContent = `${Math.round(s.se * 100)}%`;
    ui.setMute.checked = s.muted;
  }
  syncSettingsUI(sound.getSettings());
  sound.onChange(syncSettingsUI);

  ui.muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sound.unlock(true);
    sound.toggleMute();
  });

  ui.settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sound.unlock(true);
    if (document.pointerLockElement && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch {}
    }
    ui.settingsModal.classList.add('show');
  });

  ui.settingsClose.addEventListener('click', (e) => {
    e.stopPropagation();
    ui.settingsModal.classList.remove('show');
  });

  ui.settingsModal.addEventListener('click', (e) => {
    if (e.target === ui.settingsModal) ui.settingsModal.classList.remove('show');
  });

  ui.setBgm.addEventListener('input', () => {
    sound.unlock(true);
    sound.updateSettings({ bgm: Number(ui.setBgm.value) / 100 });
  });

  ui.setSe.addEventListener('input', () => {
    sound.unlock(true);
    sound.updateSettings({ se: Number(ui.setSe.value) / 100 });
    sound.click();
  });

  ui.setMute.addEventListener('change', () => {
    sound.unlock(true);
    sound.updateSettings({ muted: ui.setMute.checked });
  });

  // ===========================================================================
  // MULTIPLAYER REMOTE PLAYERS (Only active when ?mode=mp&room=XXXX)
  // ===========================================================================
  let mpManager = null;
  const remotePlayers = new Map(); // id -> { char, targetX, targetY, targetZ, targetYaw, state, skin }

  function renderRankings(rankings) {
    if (!isMultiplayer) return;
    ui.mpRankingsBox.style.display = 'block';
    ui.mpRankingsList.innerHTML = '';
    for (const r of rankings) {
      const li = document.createElement('li');
      li.className = 'mp-rank-row';
      const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `${r.rank}位`;
      const dotColor = (r.skin && r.skin.hood) || '#2b6fe3';
      li.innerHTML = `
        <span class="mp-rank-pos">${medal}</span>
        <span class="mp-rank-dot" style="background:${dotColor}"></span>
        <span class="mp-rank-name"></span>
        <span class="mp-rank-time">${formatTime(r.time)}</span>
      `;
      li.querySelector('.mp-rank-name').textContent = r.name || 'プレイヤー';
      ui.mpRankingsList.appendChild(li);
    }
    if (rankings.length > 0 && !spectating) {
      ui.clearModal.classList.add('show');
    }
  }

  function updateRemotePeersFromMap(stateMap) {
    for (const [id, data] of stateMap.entries()) {
      let entry = remotePlayers.get(id);
      if (!entry) {
        const ch = new OtaCharacter(data.skin, { castShadow: false, showNameTag: true });
        ch.root.position.set(data.x || 0, data.y || 0, data.z || 6);
        scene.add(ch.root);
        scene.add(ch.dropShadow);
        entry = {
          id,
          char: ch,
          x: data.x || 0, y: data.y || 0, z: data.z || 6,
          tx: data.x || 0, ty: data.y || 0, tz: data.z || 6,
          yaw: data.yaw || Math.PI, tyaw: data.yaw || Math.PI,
          vy: 0, grounded: true, isDashing: false,
          skinJson: JSON.stringify(data.skin || {}),
          skin: data.skin,
        };
        remotePlayers.set(id, entry);
      } else {
        entry.tx = data.x;
        entry.ty = data.y;
        entry.tz = data.z;
        entry.tyaw = data.yaw || entry.tyaw;
        entry.vy = data.vy || 0;
        entry.grounded = Boolean(data.grounded);
        entry.isDashing = Boolean(data.isDashing);
        const sJson = JSON.stringify(data.skin || {});
        if (sJson !== entry.skinJson) {
          entry.skinJson = sJson;
          entry.skin = data.skin;
          entry.char.applySkin(data.skin);
        }
      }
    }
  }

  function removeRemotePeer(id) {
    const entry = remotePlayers.get(id);
    if (!entry) return;
    scene.remove(entry.char.root);
    scene.remove(entry.char.dropShadow);
    remotePlayers.delete(id);
  }

  if (isMultiplayer) {
    ui.mpPill.style.display = 'flex';
    ui.mpPillText.textContent = `ROOM ${mpRoom} ・ 接続中...`;
    ui.spectateBtn.style.display = 'block';
    mpManager = new GameMultiplayer(mpRole, mpRoom, mySkin, {
      onStatus: (_status, count) => {
        ui.mpPillText.textContent = `ROOM ${mpRoom} ・ ${count}人`;
      },
      onRemoteUpdate: (map) => updateRemotePeersFromMap(map),
      onRemoteLeave: (id) => removeRemotePeer(id),
      onRankings: (rankings) => renderRankings(rankings),
      onHostLeft: () => {
        ui.hostLeftModal.classList.add('show');
      },
    });
    mpManager.connect().catch((err) => {
      ui.mpPillText.textContent = `ROOM ${mpRoom} ・ 接続待機`;
      console.warn('Multiplayer connect warning:', err);
    });
  }

  // Spectate controls (for finished players in MP)
  ui.spectateBtn.addEventListener('click', () => {
    spectating = true;
    ui.clearModal.classList.remove('show');
    ui.spectateBanner.classList.add('show');
  });
  ui.spectateNextBtn.addEventListener('click', () => {
    spectateIndex++;
  });
  ui.spectateResultsBtn.addEventListener('click', () => {
    spectating = false;
    ui.spectateBanner.classList.remove('show');
    ui.clearModal.classList.add('show');
  });

  // Physics engine & callbacks
  const physics = new PhysicsEngine(course, {
    onJump: () => {
      character.triggerJump(false);
      sound.jump();
    },
    onBounce: () => {
      character.triggerJump(true);
      sound.bounce();
    },
    onGeyser: () => {
      character.triggerJump(true);
      sound.geyser();
    },
    onLand: (impactVy) => {
      character.triggerLand(impactVy);
      sound.land(Math.min(1, impactVy / 18));
    },
    onBonk: () => {
      character.triggerBonk();
      sound.bonk();
    },
    onStageChange: (stObj) => {
      updateStageHUD(stObj);
      if (physics.state.hasMoved) {
        showToast(`STAGE ${stObj.id}`, stObj.name);
      }
    },
    onFlagReached: (flag) => {
      sound.flag();
      showToast(`${flag.pct}% 到達！`, flag.label);
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
        saveBestTime(bestTime);
      }
      ui.clearTime.textContent = formatTime(elapsedTime);
      ui.clearBest.textContent = isNewRecord
        ? `NEW RECORD! (${formatTime(bestTime)})`
        : `BEST ${formatTime(bestTime)}`;
      if (mpManager) {
        mpManager.reportLocalFinish(elapsedTime);
      }
      ui.clearModal.classList.add('show');
    },
  });

  const controls = new InputController(canvas, ui, {
    onAnyInput: () => sound.unlock(true),
    onJumpPress: () => physics.queueJump(),
  });

  function updateStageHUD(stObj) {
    ui.stageBadge.textContent = `ST ${stObj.id}`;
    ui.stageBadge.style.background = stObj.accent;
    ui.stageName.textContent = stObj.name;
  }

  function resetRun() {
    elapsedTime = 0;
    spectating = false;
    course.resetDynamic();
    physics.reset();
    character.reset();
    controls.resetCamera();
    confetti.stop();
    ui.clearModal.classList.remove('show');
    ui.spectateBanner.classList.remove('show');
    ui.toast.classList.remove('show');
    updateStageHUD(STAGES[0]);
    updateHUD();
  }

  ui.replayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sound.unlock(true);
    resetRun();
  });

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Dynamic Stage Atmosphere Blending
  const targetSkyTop = new THREE.Color(STAGES[0].skyTop);
  const targetSkyMid = new THREE.Color(STAGES[0].skyMid);
  const targetSkyBot = new THREE.Color(STAGES[0].skyBot);
  const targetFog = new THREE.Color(STAGES[0].fog);
  const targetSun = new THREE.Color(STAGES[0].sun);

  function updateAtmosphere(dt, altitude, instant = false) {
    const st = getStageForY(altitude);
    targetSkyTop.setHex(st.skyTop);
    targetSkyMid.setHex(st.skyMid);
    targetSkyBot.setHex(st.skyBot);
    targetFog.setHex(st.fog);
    targetSun.setHex(st.sun);

    const k = instant ? 1 : Math.min(1, dt * 2.5);
    sky.uniforms.uTop.value.lerp(targetSkyTop, k);
    sky.uniforms.uMid.value.lerp(targetSkyMid, k);
    sky.uniforms.uBot.value.lerp(targetSkyBot, k);
    scene.fog.color.lerp(targetFog, k);
    scene.background.lerp(targetFog, k);
    sunLight.color.lerp(targetSun, k);
  }

  // Camera follow (supports spectating other MP players after finishing!)
  const camTarget = new THREE.Vector3(0, 1.3, 6.0);
  const camPos = new THREE.Vector3(0, 4.0, 13.4);

  function getFollowCoords() {
    if (spectating && remotePlayers.size > 0) {
      const list = Array.from(remotePlayers.values());
      const target = list[spectateIndex % list.length];
      if (ui.spectateTargetName) {
        ui.spectateTargetName.textContent = (target.skin && target.skin.name) || 'プレイヤー';
      }
      return { x: target.x, y: target.y, z: target.z };
    }
    return { x: physics.state.x, y: physics.state.y, z: physics.state.z };
  }

  function updateCamera(dt, instant = false) {
    const f = getFollowCoords();
    if (instant) {
      camTarget.set(f.x, f.y + 1.15, f.z);
    } else {
      const tXZ = Math.min(1, dt * 16);
      const tY = Math.min(1, dt * 10);
      camTarget.x += (f.x - camTarget.x) * tXZ;
      camTarget.y += (f.y + 1.15 - camTarget.y) * tY;
      camTarget.z += (f.z - camTarget.z) * tXZ;
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
    sky.mesh.position.set(f.x, f.y, f.z);

    sunLight.target.position.set(f.x, f.y, f.z);
    sunLight.position.set(f.x + 18, f.y + 30, f.z + 15);
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

  function updateRemoteCharacters(dt) {
    const lerpK = Math.min(1, dt * 12);
    for (const r of remotePlayers.values()) {
      const prevX = r.x;
      const prevZ = r.z;
      r.x += (r.tx - r.x) * lerpK;
      r.y += (r.ty - r.y) * lerpK;
      r.z += (r.tz - r.z) * lerpK;
      const vx = dt > 0.001 ? (r.x - prevX) / dt : 0;
      const vz = dt > 0.001 ? (r.z - prevZ) / dt : 0;
      const shadowY = physics.getShadowSurfaceY(r.x, r.y, r.z);
      r.char.update(dt, {
        x: r.x, y: r.y, z: r.z,
        vx, vy: r.vy, vz,
        grounded: r.grounded, isDashing: r.isDashing,
      }, shadowY);
    }
  }

  resetRun();
  updateAtmosphere(1, 0, true);
  updateCamera(0.016, true);

  let lastNow = performance.now();
  let accumulator = 0;
  let frameCount = 0;
  let fps = 60;
  let fpsTimer = 0;
  let scriptedInput = null;
  let paused = false;

  // Verification hook (v1 compatible + v2 stage metadata, skins, settings, multiplayer!)
  window.__GAME__ = {
    PHYSICS,
    GOAL_HEIGHT,
    setPaused: (v) => { paused = !!v; },
    getSkin: () => ({ ...character.skin }),
    getSettings: () => sound.getSettings(),
    updateSettings: (partial) => sound.updateSettings(partial),
    getMultiplayerInfo: () => ({
      isMultiplayer,
      role: mpRole,
      room: mpRoom,
      connected: mpManager ? mpManager.connected : false,
      remoteCount: remotePlayers.size,
      remotes: Array.from(remotePlayers.values()).map((r) => ({
        id: r.id, x: r.x, y: r.y, z: r.z, skin: r.skin,
      })),
      rankings: mpManager ? mpManager.rankings : [],
    }),
    getState: () => {
      const { groundPlat, ...rest } = physics.state;
      return {
        ...rest,
        groundPlatId: groundPlat ? groundPlat.id : null,
        stage: getStageForY(physics.state.y),
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
      stages: STAGES.map((s) => ({ id: s.id, name: s.name, minY: s.minY, maxY: s.maxY })),
      platforms: course.platforms.map((p) => ({
        id: p.id, stageId: p.stageId, shape: p.shape,
        x: p.x, topY: p.topY, z: p.z,
        w: p.w, h: p.h, d: p.d, r: p.r,
        isBouncePad: !!p.isBouncePad,
        isFireGeyser: !!p.isFireGeyser,
        erupting: !!p.erupting,
        isVineSwing: !!p.isVineSwing,
        slippery: !!p.slippery,
        moveAxis: p.moveAxis || null,
        angle: p.angle || 0,
      })),
      crownPos: { x: course.crownPos.x, y: course.crownPos.y, z: course.crownPos.z },
      bars: course.rotatingBars.map((b) => ({ id: b.id, stageId: b.stageId, x: b.x, y: b.y, z: b.z, angle: b.angle, halfLength: b.halfLength })),
      pendulums: course.pendulums.map((h) => ({ stageId: h.stageId, headX: h.headX, headY: h.headY, headZ: h.headZ, angle: h.angle })),
      fireJets: course.fireJets.map((j) => ({ stageId: j.stageId, x: j.x, y: j.y, z: j.z, active: j.active })),
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
      if (mpManager) {
        const s = physics.state;
        mpManager.updateLocalState({
          x: s.x, y: s.y, z: s.z, yaw: character.facingYaw,
          vy: s.vy, grounded: s.grounded, isDashing: s.isDashing,
          finished: s.finished, finishTime: s.finished ? elapsedTime : null,
        });
      }
      if (shouldRender) {
        const shadowY = physics.getShadowSurfaceY(physics.state.x, physics.state.y, physics.state.z);
        character.update(steps * PHYSICS.FIXED_DT, physics.state, shadowY);
        course.updateVisuals(steps * PHYSICS.FIXED_DT);
        updateAtmosphere(1, physics.state.y, true);
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
      updateRemoteCharacters(0.016);
      updateAtmosphere(1, physics.state.y, true);
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
      const stObj = getStageForY(y);
      physics.state.currentStageId = stObj.id;
      updateStageHUD(stObj);
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

      if (mpManager) {
        const s = physics.state;
        mpManager.updateLocalState({
          x: s.x, y: s.y, z: s.z, yaw: character.facingYaw,
          vy: s.vy, grounded: s.grounded, isDashing: s.isDashing,
          finished: s.finished, finishTime: s.finished ? elapsedTime : null,
        });
      }

      const shadowY = physics.getShadowSurfaceY(physics.state.x, physics.state.y, physics.state.z);
      character.update(frameDt, physics.state, shadowY);
      course.updateVisuals(frameDt);
      confetti.update(frameDt);
      updateRemoteCharacters(frameDt);
      updateAtmosphere(frameDt, getFollowCoords().y, false);
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
