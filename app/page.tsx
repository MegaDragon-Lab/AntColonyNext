'use client';
import { useEffect, useRef, useState } from 'react';
import { initGameState, tick, spawnAnt, type GameState, type HudData } from './game';

/* ── Animated ants for start screen ── */
function AntParade() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;

    type MiniAnt = { x: number; y: number; angle: number; speed: number; wander: number; color: string };
    const ants: MiniAnt[] = Array.from({ length: 18 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      angle: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 0.8,
      wander: 0,
      color: Math.random() > 0.4 ? '#f97316' : '#ef4444',
    }));

    let raf: number;
    function loop() {
      ctx.clearRect(0, 0, W, H);
      for (const a of ants) {
        a.wander--;
        if (a.wander <= 0) { a.angle += (Math.random() - 0.5) * 1.4; a.wander = 20 + Math.random() * 40; }
        a.x += Math.cos(a.angle) * a.speed;
        a.y += Math.sin(a.angle) * a.speed;
        if (a.x < 0) a.x = W; if (a.x > W) a.x = 0;
        if (a.y < 0) a.y = H; if (a.y > H) a.y = 0;

        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.angle);
        ctx.fillStyle = a.color;
        // body
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        // head
        ctx.beginPath(); ctx.arc(8, 0, 3, 0, Math.PI * 2); ctx.fill();
        // legs
        ctx.strokeStyle = a.color; ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.moveTo(i * 3, 0); ctx.lineTo(i * 3 - 4, 5); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(i * 3, 0); ctx.lineTo(i * 3 + 4, -5); ctx.stroke();
        }
        // antennae
        ctx.beginPath(); ctx.moveTo(9, -1); ctx.lineTo(14, -5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(9, 1); ctx.lineTo(14, 5); ctx.stroke();
        ctx.restore();
      }
      raf = requestAnimationFrame(loop);
    }
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 1,
    }} />
  );
}

/* ── types ── */
type ScoreEntry = { name: string; score: number };

/* ── Leaderboard component ── */
function Leaderboard({ scores }: { scores: ScoreEntry[] }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.5)', border: '1px solid #8b6914',
      borderRadius: 14, padding: '14px 24px', color: '#f5deb3',
      width: 260, boxSizing: 'border-box',
    }}>
      <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: 10, fontSize: 14, textAlign: 'center', letterSpacing: 1 }}>
        🏆 Top 10
      </div>
      {scores.length === 0
        ? <div style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>Sin scores aún</div>
        : scores.map((s, i) => (
          <div key={i} style={{
            fontSize: 13, display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '4px 0',
            borderBottom: i < scores.length - 1 ? '1px solid #2a1800' : 'none',
          }}>
            <span style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#d1d5db' : i === 2 ? '#cd7c2f' : '#a07840' }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {s.name}
            </span>
            <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{s.score}</span>
          </div>
        ))
      }
    </div>
  );
}

/* ── Score submit form ── */
function ScoreForm({ score, onDone }: { score: number; onDone: () => void }) {
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), score }),
    });
    setSent(true);
    setTimeout(onDone, 1200);
  }

  return sent ? (
    <p style={{ color: '#4ade80' }}>✅ Score guardado</p>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <p style={{ color: '#fbbf24', fontSize: 16 }}>Tu score: {score} pts</p>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Tu nombre"
        maxLength={20}
        style={{
          padding: '10px 16px', borderRadius: 12, border: '1px solid #8b6914',
          background: 'rgba(0,0,0,0.6)', color: '#f5deb3', fontSize: 16,
          textAlign: 'center', outline: 'none', width: 220,
        }}
      />
      <button onClick={submit} style={{
        padding: '10px 28px', borderRadius: 20, border: '2px solid #fbbf24',
        background: 'transparent', color: '#fbbf24', fontSize: 15, cursor: 'pointer',
      }}>Guardar</button>
    </div>
  );
}

/* ── Main page ── */
export default function AntColony() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const stateRef   = useRef<GameState | null>(null);
  const rafRef     = useRef<number>(0);

  const [scores,    setScores]    = useState<ScoreEntry[]>([]);
  const [overlay,   setOverlay]   = useState<'start' | 'win' | 'lose' | null>('start');
  const [finalScore, setFinalScore] = useState(0);
  const [showForm,  setShowForm]  = useState(false);
  const [hud, setHud] = useState({ food: 0, workers: 0, soldiers: 0, queenHp: 100, day: 1 });
  const [mode, setModeState] = useState<'worker' | 'queen'>('worker');

  useEffect(() => {
    fetch('/api/scores').then(r => r.json()).then(setScores).catch(() => {});
  }, []);

  function refreshScores() {
    fetch('/api/scores').then(r => r.json()).then(setScores).catch(() => {});
  }

  function startGame() {
    const canvas = canvasRef.current!;
    const gs = initGameState(canvas, endGame, (h: HudData) => setHud(h));
    stateRef.current = gs;
    setOverlay(null);
    setShowForm(false);
    setModeState('worker');
    cancelAnimationFrame(rafRef.current);
    function loop() { tick(gs); rafRef.current = requestAnimationFrame(loop); }
    rafRef.current = requestAnimationFrame(loop);
  }

  function endGame(win: boolean, score: number) {
    cancelAnimationFrame(rafRef.current);
    setFinalScore(score);
    setOverlay(win ? 'win' : 'lose');
    setShowForm(true);
    refreshScores();
  }

  function handleSetMode(m: 'worker' | 'queen') {
    setModeState(m);
    if (stateRef.current) stateRef.current.mode = m;
  }

  function handleSpawn(type: 'worker' | 'soldier') {
    if (stateRef.current) spawnAnt(stateRef.current, type);
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', fontFamily: 'Segoe UI, system-ui, sans-serif', color: '#f5deb3' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />

      {/* HUD */}
      {!overlay && (
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }}>
          {[
            `🍃 Comida: ${hud.food}`,
            `🐜 Obreras: ${hud.workers}`,
            `⚔️ Soldados: ${hud.soldiers}`,
            `👑 Reina: ${hud.queenHp} HP`,
          ].map(t => (
            <div key={t} style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid #8b6914', borderRadius: 8, padding: '6px 12px', fontSize: 13, minWidth: 160 }}>
              {t}
            </div>
          ))}
        </div>
      )}

      {/* Day counter */}
      {!overlay && (
        <div style={{ position: 'absolute', top: 10, right: 14, zIndex: 20, background: 'rgba(0,0,0,0.6)', border: '1px solid #8b6914', borderRadius: 8, padding: '6px 14px', fontSize: 14 }}>
          Día <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{hud.day}</span>
        </div>
      )}

      {/* Mode buttons */}
      {!overlay && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', gap: 12 }}>
          {(['worker', 'queen'] as const).map(m => (
            <button key={m} onClick={() => handleSetMode(m)} style={{
              padding: '14px 28px', borderRadius: 24, border: '2px solid #8b6914',
              background: mode === m ? '#8b6914' : 'rgba(0,0,0,0.7)',
              color: mode === m ? '#fff' : '#f5deb3', fontSize: 16, cursor: 'pointer',
              boxShadow: mode === m ? '0 0 16px #fbbf2488' : 'none',
              touchAction: 'manipulation', minWidth: 120,
            }}>
              {m === 'worker' ? '🐜 Obrera' : '👑 Reina'}
            </button>
          ))}
        </div>
      )}

      {/* Queen spawn panel */}
      {!overlay && mode === 'queen' && (
        <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', gap: 10 }}>
          {[
            { type: 'worker' as const, label: '🐜 Obrera', cost: 15 },
            { type: 'soldier' as const, label: '⚔️ Soldado', cost: 25 },
          ].map(({ type, label, cost }) => (
            <button key={type} onClick={() => handleSpawn(type)} style={{
              padding: '12px 22px', borderRadius: 16, border: '1px solid #6b4f10',
              background: 'rgba(0,0,0,0.75)', color: '#f5deb3', fontSize: 14,
              cursor: 'pointer', touchAction: 'manipulation', minWidth: 110,
            }}>
              {label}<br /><span style={{ color: '#fbbf24', fontSize: 11 }}>Costo: {cost} 🍃</span>
            </button>
          ))}
        </div>
      )}

      {/* Overlay */}
      {overlay && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 50, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 18,
        }}>
          {overlay === 'start' && <>
            <AntParade />
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
              <h1 style={{ fontSize: 48, margin: 0 }}>🐜 Ant Colony</h1>
              <p style={{ color: '#fbbf24', fontSize: 18, margin: 0 }}>Gestiona tu colonia, recolecta comida y sobrevive.</p>
              <p style={{ fontSize: 14, color: '#aaa', textAlign: 'center', margin: 0 }}>
                Modo Obrera: las hormigas recolectan solas.<br />Modo Reina: crea nuevas hormigas.
              </p>
              <button onClick={startGame} style={{ padding: '14px 36px', borderRadius: 24, border: '2px solid #fbbf24', background: 'transparent', color: '#fbbf24', fontSize: 18, cursor: 'pointer' }}>
                ▶ Iniciar
              </button>
              {/* Credits */}
              <div style={{
                textAlign: 'center', fontSize: 12, color: '#a07840',
                borderTop: '1px solid #3a2800', paddingTop: 12, lineHeight: 1.8,
              }}>
                <div style={{ color: '#fbbf24', fontSize: 13, marginBottom: 2 }}>🎮 Director del Juego</div>
                <div style={{ color: '#f5deb3', fontSize: 14, fontWeight: 'bold' }}>Achi DragoMonty</div>
                <div style={{ marginTop: 6, color: '#a07840' }}>con la colaboración de</div>
                <div style={{ color: '#d4a85a' }}>Diegui DragoMonty &amp; Papi DragoTorni</div>
              </div>
              {/* Top 10 al final */}
              <Leaderboard scores={scores} />
            </div>
          </>}

          {(overlay === 'win' || overlay === 'lose') && <>
            <h1 style={{ fontSize: 48 }}>{overlay === 'win' ? '🏆 ¡Victoria!' : '💀 Derrota'}</h1>
            {showForm && <ScoreForm score={finalScore} onDone={() => { setShowForm(false); refreshScores(); }} />}
            <Leaderboard scores={scores} />
            <button onClick={startGame} style={{ padding: '14px 36px', borderRadius: 24, border: '2px solid #fbbf24', background: 'transparent', color: '#fbbf24', fontSize: 18, cursor: 'pointer' }}>
              ▶ Jugar de nuevo
            </button>
          </>}
        </div>
      )}
    </div>
  );
}
