export const SKIN_KEY = 'diegogames_skin_v1';
export const SETTINGS_KEY = 'diegogames_settings_v1';
export const BEST_TIME_KEY = 'diegogames_sca_v2_best_time';

export const DEFAULT_SKIN = {
  hood: '#2b6fe3',
  face: '#ffffff',
  deco: 'none',
  name: 'プレイヤー',
};

export const DEFAULT_SETTINGS = {
  bgm: 0.7,
  se: 0.8,
  muted: false,
};

export const PRESET_COLORS = [
  { name: 'ロイヤルブルー', hex: '#2b6fe3' },
  { name: 'ベリーピンク', hex: '#ff5e8a' },
  { name: 'サンセット', hex: '#ff8c42' },
  { name: 'ハニーゴールド', hex: '#ffd13b' },
  { name: 'ミントグリーン', hex: '#38c98a' },
  { name: 'アクアシアン', hex: '#2ec4d6' },
  { name: 'ラベンダー', hex: '#9b6bff' },
  { name: 'チェリーレッド', hex: '#ff4d5a' },
  { name: 'スノーホワイト', hex: '#ffffff' },
  { name: 'ナイトネイビー', hex: '#26324d' },
  { name: 'サクラパステル', hex: '#ffc2dc' },
  { name: 'ピーチクリーム', hex: '#ffe5c4' },
];

export const DECO_OPTIONS = [
  { id: 'none', label: 'なし', icon: '○' },
  { id: 'crown', label: '王冠', icon: '👑' },
  { id: 'wings', label: '白い羽', icon: '🪽' },
  { id: 'halo', label: '天使の輪', icon: '⭕' },
  { id: 'star', label: '星かざり', icon: '⭐' },
];

const VALID_DECOS = new Set(DECO_OPTIONS.map((d) => d.id));

function isHexColor(v) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

export function normalizeSkin(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const name = typeof s.name === 'string' && s.name.trim().length > 0
    ? s.name.trim().slice(0, 16)
    : DEFAULT_SKIN.name;
  return {
    hood: isHexColor(s.hood) ? s.hood.toLowerCase() : DEFAULT_SKIN.hood,
    face: isHexColor(s.face) ? s.face.toLowerCase() : DEFAULT_SKIN.face,
    deco: VALID_DECOS.has(s.deco) ? s.deco : DEFAULT_SKIN.deco,
    name,
  };
}

export function loadSkin() {
  try {
    const raw = localStorage.getItem(SKIN_KEY);
    if (!raw) return { ...DEFAULT_SKIN };
    return normalizeSkin(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SKIN };
  }
}

export function saveSkin(skin) {
  const clean = normalizeSkin(skin);
  try {
    localStorage.setItem(SKIN_KEY, JSON.stringify(clean));
  } catch {
    // Ignore restricted storage environments
  }
  return clean;
}

export function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const clamp01 = (v, fb) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fb;
    return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
  };
  return {
    bgm: clamp01(s.bgm, DEFAULT_SETTINGS.bgm),
    se: clamp01(s.se, DEFAULT_SETTINGS.se),
    muted: Boolean(s.muted),
  };
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  const clean = normalizeSettings(settings);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(clean));
  } catch {
    // Ignore restricted storage environments
  }
  return clean;
}

export function loadBestTime() {
  try {
    const v = localStorage.getItem(BEST_TIME_KEY);
    if (!v) return null;
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveBestTime(sec) {
  try {
    localStorage.setItem(BEST_TIME_KEY, String(sec));
  } catch {
    // Ignore
  }
}
