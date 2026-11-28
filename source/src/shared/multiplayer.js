// PeerJS dynamic loader (CDN exception solely for Multiplayer as specified)
const PEERJS_CDN = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';

let peerLoadPromise = null;
export function loadPeerJS() {
  if (typeof window !== 'undefined' && window.Peer) {
    return Promise.resolve(window.Peer);
  }
  if (!peerLoadPromise) {
    peerLoadPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PEERJS_CDN;
      s.async = true;
      s.onload = () => {
        if (window.Peer) resolve(window.Peer);
        else reject(new Error('PeerJS loaded but window.Peer is missing'));
      };
      s.onerror = () => reject(new Error('PeerJS の読み込みに失敗しました'));
      document.head.appendChild(s);
    });
  }
  return peerLoadPromise;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export function normalizeRoomCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

const LOBBY_PREFIX = 'dg-sca2-lobby-';
const GAME_PREFIX = 'dg-sca2-game-';

// =============================================================================
// HOME LOBBY MANAGER (Create / Join Room, max 4 players -> launch game)
// =============================================================================
export class LobbyMultiplayer {
  constructor(callbacks = {}) {
    this.cb = callbacks;
    this.peer = null;
    this.role = null; // 'host' | 'guest'
    this.roomCode = '';
    this.myId = '';
    this.mySkin = null;
    this.conns = new Map(); // host: peerId -> DataConnection
    this.hostConn = null;   // guest: DataConnection
    this.players = new Map(); // id -> { id, skin, isHost }
    this.destroyed = false;
  }

  async createRoom(skin) {
    this.destroy();
    this.destroyed = false;
    const Peer = await loadPeerJS();
    this.role = 'host';
    this.mySkin = skin;
    this.roomCode = generateRoomCode();
    const peerId = LOBBY_PREFIX + this.roomCode;

    return new Promise((resolve, reject) => {
      const peer = new Peer(peerId, { debug: 0 });
      this.peer = peer;
      const timer = setTimeout(() => reject(new Error('ブローカー接続がタイムアウトしました')), 12000);

      peer.on('open', (id) => {
        clearTimeout(timer);
        this.myId = id;
        this.players.set(id, { id, skin: this.mySkin, isHost: true });
        this._emitPlayers();
        resolve(this.roomCode);
      });

      peer.on('connection', (conn) => {
        if (this.players.size >= 4) {
          conn.on('open', () => {
            conn.send({ type: 'full' });
            setTimeout(() => conn.close(), 150);
          });
          return;
        }
        conn.on('open', () => {
          this.conns.set(conn.peer, conn);
        });
        conn.on('data', (msg) => {
          if (!msg || typeof msg !== 'object') return;
          if (msg.type === 'hello') {
            this.players.set(conn.peer, { id: conn.peer, skin: msg.skin, isHost: false });
            this._broadcastLobby();
            this._emitPlayers();
          }
        });
        const onDrop = () => {
          this.conns.delete(conn.peer);
          this.players.delete(conn.peer);
          this._broadcastLobby();
          this._emitPlayers();
        };
        conn.on('close', onDrop);
        conn.on('error', onDrop);
      });

      peer.on('error', (err) => {
        clearTimeout(timer);
        if (this.cb.onError) this.cb.onError(err.message || '接続エラー');
        reject(err);
      });
    });
  }

  async joinRoom(rawCode, skin) {
    this.destroy();
    this.destroyed = false;
    const code = normalizeRoomCode(rawCode);
    if (code.length !== 4) {
      throw new Error('4文字のルームコードを入力してください');
    }
    const Peer = await loadPeerJS();
    this.role = 'guest';
    this.mySkin = skin;
    this.roomCode = code;

    return new Promise((resolve, reject) => {
      const peer = new Peer({ debug: 0 });
      this.peer = peer;
      const timer = setTimeout(() => reject(new Error('ルームが見つかりません（タイムアウト）')), 12000);

      peer.on('open', (id) => {
        this.myId = id;
        const conn = peer.connect(LOBBY_PREFIX + code, { reliable: true });
        this.hostConn = conn;

        conn.on('open', () => {
          clearTimeout(timer);
          conn.send({ type: 'hello', skin: this.mySkin });
          resolve(code);
        });

        conn.on('data', (msg) => {
          if (!msg || typeof msg !== 'object') return;
          if (msg.type === 'full') {
            if (this.cb.onError) this.cb.onError('ルームが満員（最大4人）です');
            this.destroy();
          } else if (msg.type === 'lobby') {
            this.players.clear();
            for (const p of msg.players || []) {
              this.players.set(p.id, p);
            }
            this._emitPlayers();
          } else if (msg.type === 'start') {
            if (this.cb.onStartGame) this.cb.onStartGame('guest', msg.room);
          }
        });

        conn.on('close', () => {
          if (!this.destroyed && this.cb.onHostLeft) this.cb.onHostLeft();
        });

        conn.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      peer.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(err.type === 'peer-unavailable' ? 'そのルームコードは見つかりませんでした' : (err.message || '接続エラー')));
      });
    });
  }

  _broadcastLobby() {
    const list = Array.from(this.players.values());
    for (const conn of this.conns.values()) {
      if (conn.open) conn.send({ type: 'lobby', players: list });
    }
  }

  _emitPlayers() {
    if (this.cb.onPlayersChange) {
      this.cb.onPlayersChange(Array.from(this.players.values()));
    }
  }

  startRace() {
    if (this.role !== 'host') return;
    for (const conn of this.conns.values()) {
      if (conn.open) conn.send({ type: 'start', room: this.roomCode });
    }
    const code = this.roomCode;
    this.destroyed = true;
    setTimeout(() => {
      this.destroy();
      if (this.cb.onStartGame) this.cb.onStartGame('host', code);
    }, 180);
  }

  destroy() {
    this.destroyed = true;
    for (const c of this.conns.values()) {
      try { c.close(); } catch {}
    }
    this.conns.clear();
    if (this.hostConn) {
      try { this.hostConn.close(); } catch {}
      this.hostConn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }
    this.players.clear();
  }
}

// =============================================================================
// IN-GAME RACE SYNC MANAGER (10Hz state sync, skins, names, finish rankings)
// =============================================================================
export class GameMultiplayer {
  constructor(role, roomCode, mySkin, callbacks = {}) {
    this.role = role; // 'host' | 'guest'
    this.roomCode = normalizeRoomCode(roomCode);
    this.mySkin = mySkin;
    this.cb = callbacks;

    this.peer = null;
    this.myId = '';
    this.conns = new Map();       // host -> guest connections
    this.guestLastSeen = new Map(); // host -> peerId -> timestamp
    this.hostConn = null;         // guest -> host connection
    this.lastHostSeen = 0;        // guest -> timestamp of last host message
    this.remoteStates = new Map(); // peerId -> { id, skin, x, y, z, yaw, vy, grounded, isDashing, finished, finishTime }
    this.rankings = [];           // [{ id, name, skin, time, rank }]
    this.syncInterval = null;
    this.retryTimer = null;
    this.connected = false;
    this.destroyed = false;
    this.lastLocalState = { x: 0, y: 0, z: 6, yaw: Math.PI, vy: 0, grounded: true, isDashing: false, finished: false, finishTime: null };

    // Cleanly notify peers on page unload
    this._onUnload = () => this.destroy();
    window.addEventListener('beforeunload', this._onUnload);
  }

  async connect() {
    const Peer = await loadPeerJS();
    if (this.role === 'host') {
      return this._startHost(Peer);
    }
    return this._startGuest(Peer);
  }

  _startHost(Peer) {
    return new Promise((resolve, reject) => {
      const peerId = GAME_PREFIX + this.roomCode;
      const peer = new Peer(peerId, { debug: 0 });
      this.peer = peer;

      peer.on('open', (id) => {
        this.myId = id;
        this.connected = true;
        this._startSyncLoop();
        if (this.cb.onStatus) this.cb.onStatus('connected', 1);
        resolve();
      });

      peer.on('connection', (conn) => {
        if (this.conns.size >= 3) {
          conn.on('open', () => conn.close());
          return;
        }
        conn.on('open', () => {
          this.conns.set(conn.peer, conn);
          this.guestLastSeen.set(conn.peer, performance.now());
          this._emitPeerCount();
        });
        conn.on('data', (msg) => {
          if (!msg || typeof msg !== 'object') return;
          this.guestLastSeen.set(conn.peer, performance.now());
          if (msg.type === 'state') {
            this.remoteStates.set(conn.peer, { id: conn.peer, ...msg.payload });
            if (msg.payload.finished && msg.payload.finishTime != null) {
              this._recordFinish(conn.peer, msg.payload.skin, msg.payload.finishTime);
            }
            if (this.cb.onRemoteUpdate) this.cb.onRemoteUpdate(this.remoteStates);
          } else if (msg.type === 'finish') {
            this._recordFinish(conn.peer, msg.skin, msg.time);
          }
        });
        const onDrop = () => {
          this.conns.delete(conn.peer);
          this.guestLastSeen.delete(conn.peer);
          this.remoteStates.delete(conn.peer);
          if (this.cb.onRemoteLeave) this.cb.onRemoteLeave(conn.peer);
          this._emitPeerCount();
        };
        conn.on('close', onDrop);
        conn.on('error', onDrop);
      });

      peer.on('error', (err) => {
        if (this.cb.onError) this.cb.onError(err.message || 'ホスト通信エラー');
        reject(err);
      });
    });
  }

  _startGuest(Peer) {
    return new Promise((resolve) => {
      const peer = new Peer({ debug: 0 });
      this.peer = peer;

      peer.on('open', (id) => {
        this.myId = id;
        let attempts = 0;

        const tryConnect = () => {
          if (this.destroyed || this.connected) return;
          attempts++;
          const conn = peer.connect(GAME_PREFIX + this.roomCode, { reliable: false });
          this.hostConn = conn;

          conn.on('open', () => {
            if (this.connected) return;
            this.connected = true;
            this.lastHostSeen = performance.now();
            if (this.retryTimer) clearTimeout(this.retryTimer);
            this._startSyncLoop();
            if (this.cb.onStatus) this.cb.onStatus('connected', 2);
            resolve();
          });

          conn.on('data', (msg) => {
            if (!msg || typeof msg !== 'object') return;
            this.lastHostSeen = performance.now();
            if (msg.type === 'snapshot') {
              const seen = new Set();
              for (const p of msg.players || []) {
                if (p.id === this.myId) continue;
                seen.add(p.id);
                this.remoteStates.set(p.id, p);
              }
              for (const oldId of Array.from(this.remoteStates.keys())) {
                if (!seen.has(oldId)) {
                  this.remoteStates.delete(oldId);
                  if (this.cb.onRemoteLeave) this.cb.onRemoteLeave(oldId);
                }
              }
              if (this.cb.onRemoteUpdate) this.cb.onRemoteUpdate(this.remoteStates);
              if (this.cb.onStatus) this.cb.onStatus('connected', this.remoteStates.size + 1);
            } else if (msg.type === 'rankings') {
              this.rankings = msg.rankings || [];
              if (this.cb.onRankings) this.cb.onRankings(this.rankings);
            } else if (msg.type === 'host_left') {
              this._triggerHostLeft();
            }
          });

          conn.on('close', () => {
            if (this.connected && !this.destroyed) {
              this._triggerHostLeft();
            }
          });

          // Retry if host game peer hasn't opened yet after lobby redirect
          if (!this.connected && attempts < 24) {
            this.retryTimer = setTimeout(() => {
              if (!this.connected && !this.destroyed) tryConnect();
            }, 420);
          }
        };

        tryConnect();
      });

      peer.on('error', () => {
        if (!this.connected && !this.destroyed) {
          this.retryTimer = setTimeout(() => {
            if (!this.connected && !this.destroyed && this.peer && !this.peer.destroyed) {
              const c = this.peer.connect(GAME_PREFIX + this.roomCode, { reliable: false });
              this.hostConn = c;
            }
          }, 500);
        }
      });
    });
  }

  _triggerHostLeft() {
    if (this.destroyed) return;
    this.connected = false;
    if (this.syncInterval) { clearInterval(this.syncInterval); this.syncInterval = null; }
    if (this.cb.onHostLeft) this.cb.onHostLeft();
  }

  _emitPeerCount() {
    if (this.cb.onStatus) this.cb.onStatus('connected', this.conns.size + 1);
  }

  updateLocalState(st) {
    this.lastLocalState = { ...st, skin: this.mySkin };
  }

  reportLocalFinish(timeSec) {
    this.lastLocalState.finished = true;
    this.lastLocalState.finishTime = timeSec;
    if (this.role === 'host') {
      this._recordFinish(this.myId, this.mySkin, timeSec);
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ type: 'finish', skin: this.mySkin, time: timeSec });
    }
  }

  _recordFinish(id, skin, time) {
    if (this.rankings.some((r) => r.id === id)) return;
    this.rankings.push({
      id,
      name: (skin && skin.name) || 'プレイヤー',
      skin: skin || this.mySkin,
      time,
    });
    this.rankings.sort((a, b) => a.time - b.time);
    this.rankings.forEach((r, idx) => { r.rank = idx + 1; });

    for (const conn of this.conns.values()) {
      if (conn.open) conn.send({ type: 'rankings', rankings: this.rankings });
    }
    if (this.cb.onRankings) this.cb.onRankings(this.rankings);
  }

  _startSyncLoop() {
    if (this.syncInterval) return;
    // 10Hz state synchronization + heartbeat disconnect watchdog
    this.syncInterval = window.setInterval(() => {
      if (this.destroyed || !this.connected) return;
      const now = performance.now();

      if (this.role === 'host') {
        // Drop silent/disconnected guests after 4.5s
        for (const [peerId, lastTs] of Array.from(this.guestLastSeen.entries())) {
          if (now - lastTs > 4500) {
            const c = this.conns.get(peerId);
            if (c) { try { c.close(); } catch {} }
            this.conns.delete(peerId);
            this.guestLastSeen.delete(peerId);
            this.remoteStates.delete(peerId);
            if (this.cb.onRemoteLeave) this.cb.onRemoteLeave(peerId);
            this._emitPeerCount();
          }
        }

        const snapshot = [
          { id: this.myId, ...this.lastLocalState, skin: this.mySkin },
          ...Array.from(this.remoteStates.values()),
        ];
        for (const conn of this.conns.values()) {
          if (conn.open) {
            conn.send({ type: 'snapshot', players: snapshot });
          }
        }
      } else {
        if (this.lastHostSeen > 0 && now - this.lastHostSeen > 3500) {
          this._triggerHostLeft();
          return;
        }
        if (this.hostConn && this.hostConn.open) {
          this.hostConn.send({
            type: 'state',
            payload: { ...this.lastLocalState, skin: this.mySkin },
          });
        }
      }
    }, 100);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('beforeunload', this._onUnload);
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.role === 'host') {
      for (const conn of this.conns.values()) {
        try {
          if (conn.open) conn.send({ type: 'host_left' });
          conn.close();
        } catch {}
      }
    }
    this.conns.clear();
    if (this.hostConn) {
      try { this.hostConn.close(); } catch {}
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
    }
  }
}
