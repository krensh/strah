import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './Game.css';
import bg from '../assets/bg/bg.png';

import whoisitGif from '../assets/gameset/whoisit.gif';
import potatoImg from '../assets/gameset/potato.png';
import bombImg from '../assets/gameset/bomb.png';
import explosionGif from '../assets/gameset/explosion.gif';

type ItemType = 'Potato' | 'Bomb';
type GameItem = { id: string; item_type: ItemType; x_pos: number; time_left: number };
type PlayerState = { hp: number; score: number; items: GameItem[]; marionette: number; is_blocked: boolean };
type GameState = { p1: PlayerState; p2: PlayerState };

export default function Game({ onGameOver, isHost }: { onGameOver: () => void, isHost: boolean }) {
  const [gameState, setGameState] = useState<GameState | null>(null);

  const [isShaking, setIsShaking] = useState(false);
  const [showExplosion, setShowExplosion] = useState(false);
  const [enemyExplosion, setEnemyExplosion] = useState(false);

  const prevHp = useRef({ p1: 100, p2: 100 });

  useEffect(() => {
    const unlisten = listen<string>('game_state', (event) => {
      const data: GameState = JSON.parse(event.payload);

      if (data.p1.hp < prevHp.current.p1 - 10) {
        if (isHost) { setIsShaking(true); setShowExplosion(true); setTimeout(() => { setIsShaking(false); setShowExplosion(false); }, 800); }
        else { setEnemyExplosion(true); setTimeout(() => setEnemyExplosion(false), 800); }
      }
      if (data.p2.hp < prevHp.current.p2 - 10) {
        if (!isHost) { setIsShaking(true); setShowExplosion(true); setTimeout(() => { setIsShaking(false); setShowExplosion(false); }, 800); }
        else { setEnemyExplosion(true); setTimeout(() => setEnemyExplosion(false), 800); }
      }
      prevHp.current = { p1: data.p1.hp, p2: data.p2.hp };

      setGameState(data);
    });

    return () => { unlisten.then(f => f()); };
  }, [isHost]);

  if (!gameState) {
    return <div className="screen" style={{ backgroundImage: `url(${bg})`, backgroundSize: 'cover', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'Press Start 2P' }}>ОЖИДАНИЕ СЕРВЕРА...</div>;
  }

  const me = isHost ? gameState.p1 : gameState.p2;
  const enemy = isHost ? gameState.p2 : gameState.p1;

  const passItem = (id: string) => {
    invoke('pass_item', { itemId: id, isHost });
  };

  return (
    <div className={`screen ${isShaking ? 'shake' : ''}`} style={{ backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="game-container">

        {/* СЧЕТ */}
        <div className="score-board">
          <div className="score-enemy">КРАСНЫЕ: {enemy.score}</div>
          <div className="score-player">СИНИЕ: {me.score}</div>
        </div>

        {/* СОПЕРНИК */}
        <div className="enemy-zone">
          <div className="enemy-hp-bar"><div className="enemy-hp-fill" style={{ width: `${Math.max(0, enemy.hp)}%` }} /></div>
          <div className="enemy-avatar-container">
            <img src={whoisitGif} className="enemy-avatar" alt="Enemy" />
            {enemyExplosion && <img src={explosionGif} className="small-explosion" alt="boom" />}
          </div>
        </div>

        {/* МОИ ПРЕДМЕТЫ */}
        <div className="my-items-area">
          {me.items.map(item => (
            <div key={item.id} className="falling-item" style={{ left: `${item.x_pos}%` }} onClick={() => passItem(item.id)}>
              <div className="item-timer">{item.time_left}</div>
              <img src={item.item_type === 'Potato' ? potatoImg : bombImg} className="item-img" alt={item.item_type} />
            </div>
          ))}
        </div>

        {/* МОЙ HP */}
        <div className="my-hp-bar">
          <div className="my-hp-fill" style={{ width: `${Math.max(0, me.hp)}%` }} />
          <span className="hp-text">HP: {Math.max(0, me.hp)}/100</span>
        </div>

        {/* ВЗРЫВ */}
        {showExplosion && <div className="fullscreen-explosion"><img src={explosionGif} alt="boom" /></div>}
      </div>
    </div>
  );
}
