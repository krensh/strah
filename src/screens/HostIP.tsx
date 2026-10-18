import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './HostIP.css';
import bg from '../assets/bg/bg.png';

type HostIPProps = {
  onBack: () => void;
  onGameStart?: () => void;
};

export default function HostIP({ onBack, onGameStart }: HostIPProps) {
  const [info, setInfo] = useState('запуск...');

  const onGameStartRef = useRef(onGameStart);
  useEffect(() => { onGameStartRef.current = onGameStart; }, [onGameStart]);

  useEffect(() => {
    // port = 0 -> ОС сама выберет свободный порт, клиент узнает его через mDNS
    invoke<number>('start_host', { port: 0 })
      .then((port) => setInfo(`ожидание игрока (порт ${port})`))
      .catch((err) => setInfo(`ошибка: ${err}`));

    const unlisten = listen('client_connected', () => {
      onGameStartRef.current?.();
    });

    return () => {
      unlisten.then((un) => un());
      invoke('stop_host').catch(console.error);
    };
  }, []);

  return (
    <div
      className="screen"
      style={{
        backgroundImage: `url(${bg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="host-panel">
        <h1 className="host-title">Ваш сервер</h1>

        <div className="ip-display">
          <span className="ip-bracket">[</span>
          <span className="ip-value">{info}</span>
          <span className="ip-bracket">]</span>
        </div>

        <p className="host-hint">// напарник найдёт вас сам</p>

        <div className="host-status">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>

        <button className="back-button" onClick={onBack}>
          <span className="btn-icon">←</span>
          <span className="btn-text">Назад</span>
        </button>
      </div>
    </div>
  );
}