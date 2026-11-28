import * as THREE from 'three';
import {
  DECO_OPTIONS,
  PRESET_COLORS,
  loadBestTime,
  loadSkin,
  saveSkin,
} from '../shared/storage.js';
import { sound } from '../shared/audio.js';
import { OtaCharacter } from '../shared/character.js';
import { LobbyMultiplayer, normalizeRoomCode } from '../shared/multiplayer.js';

function formatTime(sec) {
  if (sec == null) return '--:--.--';
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  const cs = Math.floor((sec * 100) % 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function initSkinPreview3D(canvas, initialSkin) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
  camera.position.set(0, 0.95, 3.35);
  camera.lookAt(0, 0.68, 0);

  const hemi = new THREE.HemisphereLight(0xdff5ff, 0xffe4cc, 1.05);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfffaf0, 1.35);
  dir.position.set(2.5, 4.2, 3.2);
  scene.add(dir);

  // Cute pastel turntable pedestal under the character
  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.84, 0.18, 28),
    new THREE.MeshStandardMaterial({ color: 0xe6f4ff, roughness: 0.4 })
  );
  ped.position.y = -0.09;
  scene.add(ped);
  const pedRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.77, 0.045, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0x7bc2ff, roughness: 0.35 })
  );
  pedRim.rotation.x = Math.PI / 2;
  pedRim.position.y = -0.02;
  scene.add(pedRim);

  const character = new OtaCharacter(initialSkin, { castShadow: false });
  character.root.position.set(0, 0, 0);
  character.facingYaw = 0.25; // Facing camera (+Z) slightly turned
  character.root.rotation.y = character.facingYaw;
  scene.add(character.root);

  // Drag to rotate 360° (mouse + touch)
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let rotY = 0.25;
  let rotX = 0.08;

  const onDown = (x, y) => {
    dragging = true;
    lastX = x;
    lastY = y;
  };
  const onMove = (x, y) => {
    if (!dragging) return;
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x;
    lastY = y;
    rotY += dx * 0.014;
    rotX = Math.max(-0.35, Math.min(0.45, rotX + dy * 0.008));
  };
  const onUp = () => { dragging = false; };

  canvas.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onUp);

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      e.preventDefault();
      onDown(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (dragging && e.touches.length > 0) {
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  canvas.addEventListener('touchend', onUp);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
  }

  let lastT = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (!dragging) rotY += dt * 0.35;
    character.root.rotation.y = rotY;
    character.root.rotation.x = rotX;
    character.updateDecorations(dt, true, 1.2);
    // Gentle idle bounce
    const idleScale = 1 + Math.sin(now * 0.004) * 0.03;
    character.squashPivot.scale.set(1 / Math.sqrt(idleScale), idleScale, 1 / Math.sqrt(idleScale));

    resize();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);

  return {
    character,
    applySkin: (s) => character.applySkin(s),
    getRotation: () => ({ rotY, rotX }),
    renderOnce: () => { resize(); renderer.render(scene, camera); },
  };
}

function initHome() {
  let skin = loadSkin();
  const best = loadBestTime();
  const bestBadge = document.getElementById('best-time-badge');
  if (bestBadge) bestBadge.textContent = `BEST ${formatTime(best)}`;

  // 3D Skin Preview (inside Skin Studio modal AND right in the Home hero!)
  const previewCanvas = document.getElementById('skin-preview-canvas');
  const preview3D = initSkinPreview3D(previewCanvas, skin);

  // Sync player summary pill in top bar
  const topPlayerDot = document.getElementById('top-player-dot');
  const topPlayerName = document.getElementById('top-player-name');
  function refreshTopPlayer() {
    if (topPlayerDot) topPlayerDot.style.background = skin.hood;
    if (topPlayerName) topPlayerName.textContent = skin.name;
  }
  refreshTopPlayer();

  // ===========================================================================
  // 1. SKIN CUSTOMIZATION UI (diegogames_skin_v1)
  // ===========================================================================
  const nameInput = document.getElementById('skin-name-input');
  const hoodPicker = document.getElementById('hood-color-picker');
  const facePicker = document.getElementById('face-color-picker');
  const hoodGrid = document.getElementById('hood-presets');
  const faceGrid = document.getElementById('face-presets');
  const decoGrid = document.getElementById('deco-options');

  function commitSkin(partial) {
    skin = saveSkin({ ...skin, ...partial });
    preview3D.applySkin(skin);
    refreshTopPlayer();
    syncSkinControls();
  }

  function buildColorSwatches(container, field) {
    container.innerHTML = '';
    for (const preset of PRESET_COLORS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-swatch';
      btn.style.background = preset.hex;
      btn.title = preset.name;
      btn.dataset.hex = preset.hex.toLowerCase();
      btn.setAttribute('aria-label', `${field} ${preset.name}`);
      btn.addEventListener('click', () => {
        sound.unlock(false);
        sound.click();
        commitSkin({ [field]: preset.hex });
      });
      container.appendChild(btn);
    }
  }

  function buildDecoButtons() {
    decoGrid.innerHTML = '';
    for (const d of DECO_OPTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'deco-btn';
      btn.dataset.deco = d.id;
      btn.innerHTML = `<span class="deco-ico">${d.icon}</span><span>${d.label}</span>`;
      btn.addEventListener('click', () => {
        sound.unlock(false);
        sound.click();
        commitSkin({ deco: d.id });
      });
      decoGrid.appendChild(btn);
    }
  }

  function syncSkinControls() {
    if (nameInput.value !== skin.name && document.activeElement !== nameInput) {
      nameInput.value = skin.name;
    }
    hoodPicker.value = skin.hood;
    facePicker.value = skin.face;
    for (const el of hoodGrid.querySelectorAll('.color-swatch')) {
      el.classList.toggle('selected', el.dataset.hex === skin.hood);
    }
    for (const el of faceGrid.querySelectorAll('.color-swatch')) {
      el.classList.toggle('selected', el.dataset.hex === skin.face);
    }
    for (const el of decoGrid.querySelectorAll('.deco-btn')) {
      el.classList.toggle('selected', el.dataset.deco === skin.deco);
    }
  }

  buildColorSwatches(hoodGrid, 'hood');
  buildColorSwatches(faceGrid, 'face');
  buildDecoButtons();
  nameInput.value = skin.name;
  syncSkinControls();

  nameInput.addEventListener('input', () => {
    commitSkin({ name: nameInput.value });
  });
  hoodPicker.addEventListener('input', () => commitSkin({ hood: hoodPicker.value }));
  facePicker.addEventListener('input', () => commitSkin({ face: facePicker.value }));

  // ===========================================================================
  // 2. SETTINGS MODAL (diegogames_settings_v1)
  // ===========================================================================
  const settingsModal = document.getElementById('settings-modal');
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const setBgm = document.getElementById('home-set-bgm');
  const setBgmVal = document.getElementById('home-set-bgm-val');
  const setSe = document.getElementById('home-set-se');
  const setSeVal = document.getElementById('home-set-se-val');
  const setMute = document.getElementById('home-set-mute');

  function syncSettingsUI(s) {
    setBgm.value = String(Math.round(s.bgm * 100));
    setBgmVal.textContent = `${Math.round(s.bgm * 100)}%`;
    setSe.value = String(Math.round(s.se * 100));
    setSeVal.textContent = `${Math.round(s.se * 100)}%`;
    setMute.checked = s.muted;
  }
  syncSettingsUI(sound.getSettings());
  sound.onChange(syncSettingsUI);

  openSettingsBtn.addEventListener('click', () => {
    sound.unlock(false);
    sound.click();
    settingsModal.classList.add('show');
  });
  closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('show'));
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('show');
  });

  setBgm.addEventListener('input', () => {
    sound.unlock(false);
    sound.updateSettings({ bgm: Number(setBgm.value) / 100 });
  });
  setSe.addEventListener('input', () => {
    sound.unlock(false);
    sound.updateSettings({ se: Number(setSe.value) / 100 });
    sound.click();
  });
  setMute.addEventListener('change', () => {
    sound.unlock(false);
    sound.updateSettings({ muted: setMute.checked });
  });

  // ===========================================================================
  // 3. MULTIPLAYER LOBBY MODAL (PeerJS Create / Join Room)
  // ===========================================================================
  const mpModal = document.getElementById('mp-modal');
  const openMpBtn = document.getElementById('open-mp-btn');
  const closeMpBtn = document.getElementById('close-mp-btn');
  const mpChoiceView = document.getElementById('mp-choice-view');
  const mpWaitView = document.getElementById('mp-wait-view');
  const createRoomBtn = document.getElementById('create-room-btn');
  const joinRoomBtn = document.getElementById('join-room-btn');
  const joinCodeInput = document.getElementById('join-code-input');
  const mpErrorMsg = document.getElementById('mp-error-msg');
  const lobbyRoomCode = document.getElementById('lobby-room-code');
  const lobbyStatus = document.getElementById('lobby-status');
  const lobbyPlayerList = document.getElementById('lobby-player-list');
  const startRaceBtn = document.getElementById('start-race-btn');
  const leaveRoomBtn = document.getElementById('leave-room-btn');

  let lobby = null;

  function showMpError(msg) {
    mpErrorMsg.textContent = msg || '';
    mpErrorMsg.style.display = msg ? 'block' : 'none';
  }

  function renderLobbyPlayers(players) {
    lobbyPlayerList.innerHTML = '';
    for (const p of players) {
      const li = document.createElement('li');
      li.className = 'lobby-player-item';
      const dot = (p.skin && p.skin.hood) || '#2b6fe3';
      const pname = (p.skin && p.skin.name) || 'プレイヤー';
      li.innerHTML = `
        <span class="lp-dot" style="background:${dot}"></span>
        <span class="lp-name"></span>
        <span class="lp-tag">${p.isHost ? 'HOST' : 'GUEST'}</span>
      `;
      li.querySelector('.lp-name').textContent = pname;
      lobbyPlayerList.appendChild(li);
    }
    lobbyStatus.textContent = `参加者 ${players.length} / 4 人`;
  }

  function resetMpModal() {
    if (lobby) {
      lobby.destroy();
      lobby = null;
    }
    showMpError('');
    mpChoiceView.style.display = 'block';
    mpWaitView.style.display = 'none';
    createRoomBtn.disabled = false;
    joinRoomBtn.disabled = false;
  }

  openMpBtn.addEventListener('click', () => {
    sound.unlock(false);
    sound.click();
    resetMpModal();
    mpModal.classList.add('show');
  });

  closeMpBtn.addEventListener('click', () => {
    resetMpModal();
    mpModal.classList.remove('show');
  });

  leaveRoomBtn.addEventListener('click', () => resetMpModal());

  function navigateToMultiGame(role, code) {
    window.location.href = `./sky-crown-athletic/index.html?mode=mp&role=${encodeURIComponent(role)}&room=${encodeURIComponent(code)}`;
  }

  createRoomBtn.addEventListener('click', async () => {
    showMpError('');
    createRoomBtn.disabled = true;
    try {
      lobby = new LobbyMultiplayer({
        onPlayersChange: renderLobbyPlayers,
        onStartGame: (role, code) => navigateToMultiGame(role, code),
        onError: (msg) => showMpError(msg),
      });
      const code = await lobby.createRoom(skin);
      lobbyRoomCode.textContent = code;
      mpChoiceView.style.display = 'none';
      mpWaitView.style.display = 'block';
      startRaceBtn.style.display = 'block';
    } catch (err) {
      showMpError(err.message || 'ルーム作成に失敗しました');
      createRoomBtn.disabled = false;
    }
  });

  joinRoomBtn.addEventListener('click', async () => {
    showMpError('');
    const code = normalizeRoomCode(joinCodeInput.value);
    joinCodeInput.value = code;
    if (code.length !== 4) {
      showMpError('4文字のルームコードを入力してください');
      return;
    }
    joinRoomBtn.disabled = true;
    try {
      lobby = new LobbyMultiplayer({
        onPlayersChange: renderLobbyPlayers,
        onStartGame: (role, rcode) => navigateToMultiGame(role, rcode),
        onError: (msg) => showMpError(msg),
        onHostLeft: () => {
          resetMpModal();
          showMpError('ホストがルームを閉じました');
        },
      });
      await lobby.joinRoom(code, skin);
      lobbyRoomCode.textContent = code;
      mpChoiceView.style.display = 'none';
      mpWaitView.style.display = 'block';
      startRaceBtn.style.display = 'none';
      lobbyStatus.textContent = 'ホストの開始を待っています...';
    } catch (err) {
      showMpError(err.message || 'ルーム参加に失敗しました');
      joinRoomBtn.disabled = false;
    }
  });

  startRaceBtn.addEventListener('click', () => {
    if (lobby) lobby.startRace();
  });

  // Expose test/debug helper
  window.__HOME__ = {
    getSkin: () => ({ ...skin }),
    setSkin: (partial) => commitSkin(partial),
    getSettings: () => sound.getSettings(),
    getPreviewRotation: () => preview3D.getRotation(),
    renderPreview: () => preview3D.renderOnce(),
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHome);
} else {
  initHome();
}
