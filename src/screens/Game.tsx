import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './Game.css';
import bg from '../assets/bg/bg.png';

import whoisitGif from '../assets/gameset/whoisit.gif';
import potatoImg from '../assets/gameset/potato.png';
import bombImg from '../assets/gameset/bomb.png';
import explosionGif from '../assets/gameset/explosion.gif';

type GameProps = { onGameOver: () => void };
type ItemType = 'potato' | 'bomb';
type GameItem = { id: string; type: ItemType; x_pos: number; timeLeft: number };

export default function Game({ onGameOver }: GameProps) {
  const [state, setState] = useState({
    myHp: 100,
    enemyHp: 100,
    myScore: 0,
    enemyScore: 0,
    myItems: [] as GameItem[],
    enemyItems: [] as GameItem[],
    marionette: 15,
    isBlocked: false,
    isHolding: false,
  });

  const [isShaking, setIsShaking] = useState(false);
  const [showExplosion, setShowExplosion] = useState(false);
  const [enemyExplosion, setEnemyExplosion] = useState(false);

  const holdInterval = useRef<number | null>(null);

  const onGameOverRef = useRef(onGameOver);
  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);

  // ЕДИНЫЙ ИГРОВОЙ ЦИКЛ (раз в секунду)
  useEffect(() => {
    const tick = setInterval(() => {
      setState(prev => {
        let newMyHp = prev.myHp;
        let newEnemyHp = prev.enemyHp;
        let newMyItems = [...prev.myItems];
        let newEnemyItems = [...prev.enemyItems];

        // 1. Разрядка марионетки (если не зажата)
        const newMarionette = prev.isHolding ? prev.marionette : Math.max(0, prev.marionette - 1);
        const newIsBlocked = newMarionette === 0;

        // 2. Мои предметы
        newMyItems = newMyItems.map(item => {
          let t = item.timeLeft - 1;

          if (item.type === 'bomb' && t <= 0) {
            newMyHp -= 30;
            setIsShaking(true);
            setShowExplosion(true);
            setTimeout(() => { setIsShaking(false); setShowExplosion(false); }, 800);
            return null;
          }

          if (item.type === 'potato' && t <= 0) {
            newMyHp -= 1;
            t = 2;
          }
          return { ...item, timeLeft: t };
        }).filter(Boolean) as GameItem[];

        // 3. Предметы врага (визуальная симуляция того, что у него происходит)
        newEnemyItems = newEnemyItems.map(item => {
          let t = item.timeLeft - 1;

          if (item.type === 'bomb' && t <= 0) {
            newEnemyHp -= 30;
            setEnemyExplosion(true);
            setTimeout(() => setEnemyExplosion(false), 800);
            return null;
          }
          if (item.type === 'potato' && t <= 0) {
            newEnemyHp -= 1;
            t = 2;
          }
          return { ...item, timeLeft: t };
        }).filter(Boolean) as GameItem[];

        // 4. Спавн новых предметов (шанс 30%)
        if (newMyItems.length < 7 && Math.random() < 0.3) {
          const type: ItemType = Math.random() > 0.4 ? 'potato' : 'bomb';
          newMyItems.push({
            id: Math.random().toString(),
            type,
            x_pos: Math.random() * 80 + 10,
            timeLeft: type === 'bomb' ? 10 : 2,
          });
        }

        // 5. Смерть и сброс раунда
        if (newMyHp <= 0) {
          return { ...prev, myHp: 100, enemyHp: 100, enemyScore: prev.enemyScore + 1, myItems: [], enemyItems: [], marionette: 15 };
        }
        if (newEnemyHp <= 0) {
          return { ...prev, myHp: 100, enemyHp: 100, myScore: prev.myScore + 1, myItems: [], enemyItems: [], marionette: 15 };
        }

        return {
          ...prev,
          myHp: newMyHp,
          enemyHp: newEnemyHp,
          myItems: newMyItems,
          enemyItems: newEnemyItems,
          marionette: newMarionette,
          isBlocked: newIsBlocked,
        };
      });
    }, 1000);

    return () => clearInterval(tick);
  }, []);

  // СЕТЬ: получение предметов и отключение соперника
  useEffect(() => {
    const unItem = listen<string>('item_received', (e) => {
      const type = e.payload as ItemType;
      if (type !== 'potato' && type !== 'bomb') return;
      setState(prev =>
        prev.myItems.length >= 7
          ? prev
          : {
              ...prev,
              myItems: [
                ...prev.myItems,
                {
                  id: Math.random().toString(),
                  type,
                  x_pos: Math.random() * 80 + 10,
                  timeLeft: type === 'bomb' ? 10 : 2,
                },
              ],
            }
      );
    });

    const unDisc = listen('peer_disconnected', () => {
      onGameOverRef.current();
    });

    return () => {
      unItem.then(f => f());
      unDisc.then(f => f());
    };
  }, []);

  // ДЕЙСТВИЯ
  const passItem = (id: string) => {
    if (state.isBlocked) return;
    const item = state.myItems.find(i => i.id === id);
    if (!item) return;

    invoke('send_item', { kind: item.type }).catch(console.error);

    setState(prev => ({
      ...prev,
      myItems: prev.myItems.filter(i => i.id !== id),
      enemyItems:
        prev.enemyItems.length < 7
          ? [...prev.enemyItems, { ...item, timeLeft: item.type === 'bomb' ? 10 : 2 }]
          : prev.enemyItems,
    }));
  };

  const startHold = () => {
    if (state.marionette >= 15) return;
    setState(prev => ({ ...prev, isHolding: true }));
    holdInterval.current = window.setInterval(() => {
      setState(prev => ({ ...prev, marionette: Math.min(15, prev.marionette + 1) }));
    }, 250);
  };

  const stopHold = () => {
    setState(prev => ({ ...prev, isHolding: false }));
    if (holdInterval.current) clearInterval(holdInterval.current);
  };

  return (
    <div className={`screen ${isShaking ? 'shake' : ''}`} style={{ backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="game-container">

        {/* ЛЕВАЯ ПАНЕЛЬ */}
        <div className="left-panel">
          <button className={`marionette-btn ${state.isBlocked ? 'blocked' : ''}`} onMouseDown={startHold} onMouseUp={stopHold} onMouseLeave={stopHold}>
            {state.isBlocked ? 'ЗАБЛОК' : 'ЗАРЯД'}
          </button>
          <div className="marionette-bar">
            <div className="marionette-fill" style={{ height: `${(state.marionette / 15) * 100}%` }} />
          </div>
        </div>

        {/* СЧЕТ */}
        <div className="score-board">
          <div className="score-enemy">КРАСНЫЕ: {state.enemyScore}</div>
          <div className="score-player">СИНИЕ: {state.myScore}</div>
        </div>

        {/* СОПЕРНИК */}
        <div className="enemy-zone">
          <div className="enemy-hp-bar"><div className="enemy-hp-fill" style={{ width: `${Math.max(0, state.enemyHp)}%` }} /></div>
          <div className="enemy-avatar-container">
            <img src={whoisitGif} className="enemy-avatar" alt="Enemy" />
            {enemyExplosion && <img src={explosionGif} className="small-explosion" alt="boom" />}
          </div>
        </div>

        {/* МОИ ПРЕДМЕТЫ */}
        <div className="my-items-area">
          {state.myItems.map(item => (
            <div key={item.id} className="falling-item" style={{ left: `${item.x_pos}%` }} onClick={() => passItem(item.id)}>
              <div className="item-timer">{item.timeLeft}</div>
              <img src={item.type === 'potato' ? potatoImg : bombImg} className="item-img" alt={item.type} />
            </div>
          ))}
        </div>

        {/* МОЙ HP */}
        <div className="my-hp-bar">
          <div className="my-hp-fill" style={{ width: `${Math.max(0, state.myHp)}%` }} />
          <span className="hp-text">HP: {Math.max(0, state.myHp)}/100</span>
        </div>

        {/* ВЗРЫВ */}
        {showExplosion && <div className="fullscreen-explosion"><img src={explosionGif} alt="boom" /></div>}
      </div>
    </div>
  );
}