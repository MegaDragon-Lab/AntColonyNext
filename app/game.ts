/* ── Game engine (canvas-based, no React deps) ── */

export interface Mission {
  id: string;
  label: string;
  desc: string;
  emoji: string;
  goal: number;
  current: number;
  done: boolean;
}

export interface GameState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  W: number; H: number;
  food: number;
  day: number;
  dayTimer: number;
  mode: 'worker' | 'queen';
  queenHp: number;
  ants: Ant[];
  foods: Food[];
  enemies: Enemy[];
  particles: Particle[];
  nest: { x: number; y: number; r: number };
  touchTarget: { x: number; y: number } | null;
  onEnd: (win: boolean, score: number) => void;
  onHud: (h: HudData) => void;
  ended: boolean;
  msgEl: HTMLDivElement | null;
  msgTimeout: ReturnType<typeof setTimeout> | null;
  // jubilee
  jubilee: boolean;
  missions: Mission[];
  totalFoodCollected: number;
  totalEnemiesKilled: number;
  onMission: (missions: Mission[]) => void;
}

export interface HudData { food: number; workers: number; soldiers: number; queenHp: number; day: number; score: number; }

export function makeMissions(): Mission[] {
  return [
    { id: 'food',    emoji: '🍃', label: 'El Gran Banquete',      desc: 'Recolecta 500 unidades de comida para el festín',  goal: 500,  current: 0, done: false },
    { id: 'survive', emoji: '🌅', label: 'Cincuenta Amaneceres',   desc: 'Sobrevive 10 días en honor a los 50 ciclos',       goal: 10,   current: 0, done: false },
    { id: 'colony',  emoji: '🐜', label: 'La Gran Familia',        desc: 'Reúne una colonia de 20 hormigas',                 goal: 20,   current: 0, done: false },
    { id: 'defend',  emoji: '⚔️', label: 'Guardianas de la Reina', desc: 'Derrota 30 invasores que amenazan el hormiguero',  goal: 30,   current: 0, done: false },
    { id: 'queen',   emoji: '👑', label: 'La Reina Inmortal',      desc: 'Mantén a la Reina con más de 80 HP hasta el día 8',goal: 1,    current: 0, done: false },
  ];
}

interface Ant {
  type: 'worker' | 'soldier';
  x: number; y: number; vx: number; vy: number;
  speed: number; hp: number; maxHp: number;
  carrying: boolean; angle: number;
  wanderTimer: number; attackTimer: number;
}

interface Food { x: number; y: number; r: number; alive: boolean; }
interface Enemy { x: number; y: number; hp: number; maxHp: number; speed: number; r: number; alive: boolean; attackTimer: number; kind: 'normal' | 'fast' | 'tank' | 'swarm'; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }

const DAY_DURATION = 1800;

export function initGameState(
  canvas: HTMLCanvasElement,
  onEnd: (win: boolean, score: number) => void,
  onHud: (h: HudData) => void,
  jubilee = false,
  onMission: (m: Mission[]) => void = () => {},
): GameState {
  const ctx = canvas.getContext('2d')!;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const gs: GameState = {
    canvas, ctx,
    W: canvas.width, H: canvas.height,
    food: 40, day: 1, dayTimer: 0,
    mode: 'worker', queenHp: 100,
    ants: [], foods: [], enemies: [], particles: [],
    nest: { x: canvas.width / 2, y: canvas.height / 2, r: 36 },
    touchTarget: null,
    onEnd, onHud, ended: false,
    msgEl: null, msgTimeout: null,
    jubilee, missions: makeMissions(),
    totalFoodCollected: 0, totalEnemiesKilled: 0,
    onMission,
  };

  for (let i = 0; i < 5; i++) gs.ants.push(makeAnt(gs, 'worker'));
  gs.ants.push(makeAnt(gs, 'soldier'));
  for (let i = 0; i < 8; i++) gs.foods.push(makeFood(gs));

  // touch
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    gs.touchTarget = { x: t.clientX - r.left, y: t.clientY - r.top };
    for (let i = 0; i < 6; i++) gs.particles.push(makeParticle(gs.touchTarget.x, gs.touchTarget.y, '#fbbf24'));
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    gs.touchTarget = { x: t.clientX - r.left, y: t.clientY - r.top };
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    setTimeout(() => { gs.touchTarget = null; }, 2000);
  }, { passive: false });

  return gs;
}

function makeAnt(gs: GameState, type: 'worker' | 'soldier'): Ant {
  const angle = Math.random() * Math.PI * 2;
  const dist = gs.nest.r + 10 + Math.random() * 40;
  return {
    type,
    x: gs.nest.x + Math.cos(angle) * dist,
    y: gs.nest.y + Math.sin(angle) * dist,
    vx: 0, vy: 0, speed: type === 'soldier' ? 1.4 : 1.1,
    hp: type === 'soldier' ? 60 : 30, maxHp: type === 'soldier' ? 60 : 30,
    carrying: false, angle: Math.random() * Math.PI * 2,
    wanderTimer: Math.floor(Math.random() * 40), attackTimer: 0,
  };
}

function makeFood(gs: GameState): Food {
  const a = Math.random() * Math.PI * 2;
  const d = 120 + Math.random() * (Math.min(gs.W, gs.H) * 0.35);
  return { x: gs.nest.x + Math.cos(a) * d, y: gs.nest.y + Math.sin(a) * d, r: 5, alive: true };
}

function makeEnemy(gs: GameState): Enemy {
  const side = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  if (side === 0) { x = Math.random() * gs.W; y = -20; }
  else if (side === 1) { x = gs.W + 20; y = Math.random() * gs.H; }
  else if (side === 2) { x = Math.random() * gs.W; y = gs.H + 20; }
  else { x = -20; y = Math.random() * gs.H; }

  // tipos de enemigos a partir del día 5
  let kind: Enemy['kind'] = 'normal';
  if (gs.day >= 5) {
    const roll = Math.random();
    const extra = Math.min(gs.day - 5, 10) / 10; // 0..1 según avance
    if (roll < 0.15 + extra * 0.1) kind = 'tank';
    else if (roll < 0.35 + extra * 0.15) kind = 'fast';
    else if (roll < 0.55 + extra * 0.2) kind = 'swarm';
  }

  const base = { normal: { hp: 40, speed: 0.55, r: 9 }, fast: { hp: 20, speed: 1.2, r: 6 }, tank: { hp: 120, speed: 0.3, r: 14 }, swarm: { hp: 12, speed: 0.9, r: 5 } }[kind];
  const hp = Math.round(base.hp + gs.day * 4);
  return { x, y, hp, maxHp: hp, speed: base.speed + gs.day * 0.03, r: base.r, alive: true, attackTimer: 0, kind };
}

function makeParticle(x: number, y: number, color: string): Particle {
  return { x, y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 30, color };
}

export function spawnAnt(gs: GameState, type: 'worker' | 'soldier') {
  const cost = type === 'worker' ? 15 : 25;
  if (gs.food < cost) return;
  gs.food -= cost;
  gs.ants.push(makeAnt(gs, type));
}

function updateMissions(gs: GameState) {
  if (!gs.jubilee) return;
  let changed = false;
  for (const m of gs.missions) {
    if (m.done) continue;
    let prev = m.current;
    if (m.id === 'food')    m.current = gs.totalFoodCollected;
    if (m.id === 'survive') m.current = gs.day - 1;
    if (m.id === 'colony')  m.current = gs.ants.length;
    if (m.id === 'defend')  m.current = gs.totalEnemiesKilled;
    if (m.id === 'queen')   m.current = (gs.day >= 8 && gs.queenHp > 80) ? 1 : 0;
    if (m.current >= m.goal && !m.done) { m.done = true; changed = true; }
    if (m.current !== prev) changed = true;
  }
  if (changed) gs.onMission([...gs.missions]);
}

export function tick(gs: GameState) {
  if (gs.ended) return;

  // day cycle
  gs.dayTimer++;
  if (gs.dayTimer >= DAY_DURATION) {
    gs.dayTimer = 0;
    gs.day++;
    gs.food = Math.max(0, gs.food - Math.floor(gs.ants.length * 0.5));
    // más enemigos cada día, y más tipos a partir del día 5
    const enemyCount = 1 + Math.floor(gs.day / 2) + (gs.day >= 5 ? Math.floor((gs.day - 5) / 3) : 0);
    for (let i = 0; i < enemyCount; i++) gs.enemies.push(makeEnemy(gs));
    // más comida escalando con el día
    const foodCount = 6 + gs.day * 2;
    for (let i = 0; i < foodCount; i++) gs.foods.push(makeFood(gs));
    // spawn automático de obreras cada 2 días si hay comida suficiente
    if (gs.day % 2 === 0 && gs.food >= 15) {
      gs.food -= 15;
      gs.ants.push(makeAnt(gs, 'worker'));
    }
  }

  if (gs.foods.filter(f => f.alive).length < 8)
    for (let i = 0; i < 4; i++) gs.foods.push(makeFood(gs));

  gs.ants.forEach(a => a.type === 'worker' ? updateWorker(gs, a) : updateSoldier(gs, a));
  gs.enemies.forEach(e => { if (e.alive) updateEnemy(gs, e); });
  gs.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });

  gs.ants    = gs.ants.filter(a => a.hp > 0);
  gs.foods   = gs.foods.filter(f => f.alive);
  gs.enemies = gs.enemies.filter(e => e.alive);
  gs.particles = gs.particles.filter(p => p.life > 0);

  const score = gs.day * 100 + gs.ants.length * 10 + gs.food;
  gs.onHud({ food: gs.food, workers: gs.ants.filter(a => a.type === 'worker').length, soldiers: gs.ants.filter(a => a.type === 'soldier').length, queenHp: gs.queenHp, day: gs.day, score });

  updateMissions(gs);

  if (gs.queenHp <= 0 || (gs.food <= 0 && gs.ants.length === 0)) { gs.ended = true; gs.onEnd(false, score); }
  // victoria normal
  if (!gs.jubilee && gs.day >= 20 && gs.ants.length >= 30) { gs.ended = true; gs.onEnd(true, score); }
  // victoria jubileo: todas las misiones completadas
  if (gs.jubilee && gs.missions.every(m => m.done)) { gs.ended = true; gs.onEnd(true, score); }

  draw(gs);
}

function updateWorker(gs: GameState, ant: Ant) {
  if (ant.carrying) {
    const dx = gs.nest.x - ant.x, dy = gs.nest.y - ant.y;
    const dist = Math.hypot(dx, dy);
    if (dist < gs.nest.r) {
      gs.food += 5; ant.carrying = false;
      gs.totalFoodCollected += 5;
      for (let i = 0; i < 4; i++) gs.particles.push(makeParticle(ant.x, ant.y, '#4ade80'));
    } else { ant.vx = (dx / dist) * ant.speed; ant.vy = (dy / dist) * ant.speed; }
  } else {
    if (gs.touchTarget && gs.mode === 'worker') {
      const dx = gs.touchTarget.x - ant.x, dy = gs.touchTarget.y - ant.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 10) { ant.vx = (dx / dist) * ant.speed * 1.3; ant.vy = (dy / dist) * ant.speed * 1.3; ant.x += ant.vx; ant.y += ant.vy; clamp(gs, ant); return; }
    }
    let nearest: Food | null = null, nearDist = Infinity;
    for (const f of gs.foods) { if (!f.alive) continue; const d = Math.hypot(f.x - ant.x, f.y - ant.y); if (d < nearDist) { nearDist = d; nearest = f; } }
    if (nearest) {
      const dx = nearest.x - ant.x, dy = nearest.y - ant.y, dist = Math.hypot(dx, dy);
      if (dist < nearest.r + 4) { nearest.alive = false; ant.carrying = true; }
      else { ant.vx = (dx / dist) * ant.speed; ant.vy = (dy / dist) * ant.speed; }
    } else { wander(ant); }
  }
  ant.x += ant.vx; ant.y += ant.vy; clamp(gs, ant);
}

function updateSoldier(gs: GameState, ant: Ant) {
  let target: Enemy | null = null, nearDist = Infinity;
  for (const e of gs.enemies) { if (!e.alive) continue; const d = Math.hypot(e.x - ant.x, e.y - ant.y); if (d < nearDist) { nearDist = d; target = e; } }
  if (target) {
    const dx = target.x - ant.x, dy = target.y - ant.y, dist = Math.hypot(dx, dy);
    if (dist < 14) {
      ant.attackTimer++;
      if (ant.attackTimer >= 20) { target.hp -= 12; ant.attackTimer = 0; for (let i = 0; i < 3; i++) gs.particles.push(makeParticle(target.x, target.y, '#f87171')); if (target.hp <= 0) { target.alive = false; gs.totalEnemiesKilled++; } }
    } else { ant.vx = (dx / dist) * ant.speed; ant.vy = (dy / dist) * ant.speed; }
  } else {
    const dx = gs.nest.x - ant.x, dy = gs.nest.y - ant.y, dist = Math.hypot(dx, dy);
    if (dist > 80) { ant.vx = (dx / dist) * ant.speed * 0.6; ant.vy = (dy / dist) * ant.speed * 0.6; } else { wander(ant); }
  }
  ant.x += ant.vx; ant.y += ant.vy; clamp(gs, ant);
}

function updateEnemy(gs: GameState, e: Enemy) {
  const dx = gs.nest.x - e.x, dy = gs.nest.y - e.y, dist = Math.hypot(dx, dy);
  if (dist < gs.nest.r + e.r) {
    e.attackTimer++;
    if (e.attackTimer >= 40) { gs.queenHp = Math.max(0, gs.queenHp - 5); e.attackTimer = 0; for (let i = 0; i < 4; i++) gs.particles.push(makeParticle(gs.nest.x, gs.nest.y, '#f87171')); }
  } else { e.x += (dx / dist) * e.speed; e.y += (dy / dist) * e.speed; }
  for (const ant of gs.ants) { if (ant.type !== 'soldier') continue; if (Math.hypot(ant.x - e.x, ant.y - e.y) < 14) ant.hp -= 0.3; }
}

function wander(ant: Ant) {
  ant.wanderTimer--;
  if (ant.wanderTimer <= 0) { ant.angle += (Math.random() - 0.5) * 1.2; ant.wanderTimer = 20 + Math.random() * 30; }
  ant.vx = Math.cos(ant.angle) * ant.speed * 0.7; ant.vy = Math.sin(ant.angle) * ant.speed * 0.7;
}

function clamp(gs: GameState, ant: Ant) {
  ant.x = Math.max(5, Math.min(gs.W - 5, ant.x));
  ant.y = Math.max(5, Math.min(gs.H - 5, ant.y));
}

function draw(gs: GameState) {
  const { ctx, W, H, nest } = gs;
  ctx.fillStyle = '#1a0f00'; ctx.fillRect(0, 0, W, H);

  // ground dots
  ctx.fillStyle = '#2a1800';
  for (let i = 0; i < 200; i++) ctx.fillRect((i * 137 + 53) % W, (i * 97 + 31) % H, 2, 2);

  // nest glow
  const g = ctx.createRadialGradient(nest.x, nest.y, 0, nest.x, nest.y, nest.r * 2.5);
  g.addColorStop(0, 'rgba(139,105,20,0.4)'); g.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(nest.x, nest.y, nest.r * 2.5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.arc(nest.x, nest.y, nest.r, 0, Math.PI * 2); ctx.fillStyle = '#5c3d11'; ctx.fill();
  ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(nest.x, nest.y, 10, 0, Math.PI * 2); ctx.fillStyle = '#1a0a00'; ctx.fill();
  ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('👑', nest.x, nest.y - 2);

  // food
  for (const f of gs.foods) {
    if (!f.alive) continue;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fillStyle = '#4ade80'; ctx.fill();
    ctx.strokeStyle = '#166534'; ctx.lineWidth = 1; ctx.stroke();
  }

  // enemies
  for (const e of gs.enemies) {
    if (!e.alive) continue;
    const eColor = e.kind === 'fast' ? '#a855f7' : e.kind === 'tank' ? '#1d4ed8' : e.kind === 'swarm' ? '#f59e0b' : '#7c2d12';
    const eBorder = e.kind === 'fast' ? '#d946ef' : e.kind === 'tank' ? '#3b82f6' : e.kind === 'swarm' ? '#fbbf24' : '#dc2626';
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fillStyle = eColor; ctx.fill();
    ctx.strokeStyle = eBorder; ctx.lineWidth = 1.5; ctx.stroke();
    // legs
    ctx.strokeStyle = eColor; ctx.lineWidth = 1;
    const legCount = e.kind === 'swarm' ? 3 : 4;
    for (let i = 0; i < legCount; i++) {
      const a1 = (i / legCount) * Math.PI - Math.PI / 2, a2 = a1 + 0.4;
      ctx.beginPath(); ctx.moveTo(Math.cos(a1) * e.r, Math.sin(a1) * e.r); ctx.lineTo(Math.cos(a2) * (e.r + 8), Math.sin(a2) * (e.r + 8)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-Math.cos(a1) * e.r, Math.sin(a1) * e.r); ctx.lineTo(-Math.cos(a2) * (e.r + 8), Math.sin(a2) * (e.r + 8)); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#333'; ctx.fillRect(e.x - 12, e.y - e.r - 8, 24, 4);
    ctx.fillStyle = eBorder; ctx.fillRect(e.x - 12, e.y - e.r - 8, 24 * (e.hp / e.maxHp), 4);
  }

  // ants
  for (const ant of gs.ants) {
    const color = ant.type === 'soldier' ? '#ef4444' : '#f97316', size = ant.type === 'soldier' ? 5 : 4;
    ctx.save(); ctx.translate(ant.x, ant.y); ctx.rotate(Math.atan2(ant.vy, ant.vx));
    ctx.beginPath(); ctx.ellipse(0, 0, size * 1.6, size * 0.8, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.beginPath(); ctx.arc(size * 1.4, 0, size * 0.7, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    if (ant.carrying) { ctx.beginPath(); ctx.arc(size * 1.4, -size, 3, 0, Math.PI * 2); ctx.fillStyle = '#4ade80'; ctx.fill(); }
    ctx.restore();
    if (ant.hp < ant.maxHp) {
      ctx.fillStyle = '#333'; ctx.fillRect(ant.x - 8, ant.y - 10, 16, 3);
      ctx.fillStyle = '#4ade80'; ctx.fillRect(ant.x - 8, ant.y - 10, 16 * (ant.hp / ant.maxHp), 3);
    }
  }

  // particles
  for (const p of gs.particles) {
    ctx.globalAlpha = p.life / 30;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
  }
  ctx.globalAlpha = 1;

  // day bar
  const prog = gs.dayTimer / DAY_DURATION;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W - 160, 10, 150, 8);
  ctx.fillStyle = prog < 0.7 ? '#fbbf24' : '#f87171'; ctx.fillRect(W - 160, 10, 150 * prog, 8);

  // touch indicator
  if (gs.touchTarget) {
    ctx.save(); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(gs.touchTarget.x, gs.touchTarget.y, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(gs.touchTarget.x, gs.touchTarget.y, 4, 0, Math.PI * 2); ctx.fillStyle = '#fbbf24'; ctx.fill();
    ctx.restore();
  }
}
