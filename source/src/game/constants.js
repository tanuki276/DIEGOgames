export const PHYSICS = {
  WALK_SPEED: 6.0,         // m/s
  DASH_SPEED: 9.5,         // m/s
  GRAVITY: 26.0,           // m/s^2
  JUMP_VY: 10.5,           // m/s (apex ~2.12m)
  COYOTE_TIME: 0.12,       // seconds
  JUMP_BUFFER: 0.12,       // seconds
  BOUNCE_VY: 16.5,         // m/s (apex ~5.24m)
  PLAYER_RADIUS: 0.36,     // horizontal collision radius (m)
  PLAYER_HEIGHT: 1.15,     // character height (m)
  MAX_FALL_SPEED: 38.0,    // terminal velocity (m/s)
  GROUND_ACCEL: 54.0,      // normal ground acceleration
  GROUND_FRICTION: 16.0,   // normal ground braking
  ICE_ACCEL: 11.5,         // low acceleration on slippery ice
  ICE_FRICTION: 2.1,       // low friction sliding on ice
  AIR_ACCEL: 30.0,         // responsive mid-air steering
  AIR_DRAG: 1.6,
  FIXED_DT: 1 / 120,       // 120Hz physics substeps
};

export const GOAL_HEIGHT = 100.0;
export const SPAWN_POS = { x: 0, y: 0.0, z: 6.0 };

export const STAGES = [
  {
    id: 1,
    name: '青空草原',
    minY: 0,
    maxY: 10,
    skyTop: 0x35b3ff,
    skyMid: 0x82d6ff,
    skyBot: 0xdaf4ff,
    fog: 0xcbeeff,
    sun: 0xfff9ea,
    accent: '#4ec97b',
  },
  {
    id: 2,
    name: 'お菓子工場',
    minY: 10,
    maxY: 20,
    skyTop: 0xff8ec6,
    skyMid: 0xffc0de,
    skyBot: 0xffeef6,
    fog: 0xffe0ee,
    sun: 0xfff3f8,
    accent: '#ff6ba6',
  },
  {
    id: 3,
    name: '浮遊諸島',
    minY: 20,
    maxY: 30,
    skyTop: 0x2f9dff,
    skyMid: 0x8dd5ff,
    skyBot: 0xf0f9ff,
    fog: 0xe2f5ff,
    sun: 0xfffdf5,
    accent: '#48b8ff',
  },
  {
    id: 4,
    name: '水上の港',
    minY: 30,
    maxY: 40,
    skyTop: 0x2597e0,
    skyMid: 0x74d1f7,
    skyBot: 0xd6f6ff,
    fog: 0xc4effc,
    sun: 0xfff8e6,
    accent: '#2bb8d6',
  },
  {
    id: 5,
    name: 'ツタの密林',
    minY: 40,
    maxY: 50,
    skyTop: 0x3ba68a,
    skyMid: 0x84d9a6,
    skyBot: 0xe3f7cc,
    fog: 0xd0efc0,
    sun: 0xfffbe0,
    accent: '#41b86d',
  },
  {
    id: 6,
    name: '氷の山',
    minY: 50,
    maxY: 60,
    skyTop: 0x243e78,
    skyMid: 0x5d8fd6,
    skyBot: 0xc7e8ff,
    fog: 0xb6dfff,
    sun: 0xe8f6ff,
    accent: '#6bc4ff',
  },
  {
    id: 7,
    name: '炎の火山',
    minY: 60,
    maxY: 70,
    skyTop: 0x4b1d36,
    skyMid: 0xc44b3b,
    skyBot: 0xffa65c,
    fog: 0xe87b54,
    sun: 0xffd2a6,
    accent: '#ff6633',
  },
  {
    id: 8,
    name: 'おもちゃ箱',
    minY: 70,
    maxY: 80,
    skyTop: 0x49b2ff,
    skyMid: 0x9ce0ff,
    skyBot: 0xfff5c9,
    fog: 0xeef6d8,
    sun: 0xfffce8,
    accent: '#ffae2b',
  },
  {
    id: 9,
    name: '機械工場',
    minY: 80,
    maxY: 90,
    skyTop: 0x2f3b5e,
    skyMid: 0x7b6587,
    skyBot: 0xf2b580,
    fog: 0xdba584,
    sun: 0xffe0b8,
    accent: '#e08e45',
  },
  {
    id: 10,
    name: '天空の王宮・最終決戦',
    minY: 90,
    maxY: 100,
    skyTop: 0x3b4fc4,
    skyMid: 0x8b83e8,
    skyBot: 0xffe9a6,
    fog: 0xf3dca8,
    sun: 0xfff4c7,
    accent: '#ffcf33',
  },
];

export function getStageForY(y) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (y >= STAGES[i].minY - 0.15) return STAGES[i];
  }
  return STAGES[0];
}
