import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './HostIP.css';
import bg from '../assets/bg/bg.png';

type HostIPProps = {
  onBack: () => void;
  onStartGame?: () => void; // Добавим на будущее
};

export default function HostIP({ onBack, onStartGame }: HostIPProps) {
  const [ip, setIp] = useState('0.0.0.0');
  const [isServerStarted, setIsServerStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {

    // 1. При входе на экран узнаем наш реальный IP
    invoke<string>('get_local_ip')
      .then(realIp => setIp(realIp))
      .catch(err => console.error("Не удалось получить IP:", err));

    // 2. Запускаем сервер на порту 8080
    invoke('start_host', { port: 8080 })
      .then(() => setIsServerStarted(true))
      .catch(err => console.error("Ошибка запуска сервера:", err));

    // 3. Слушаем событие "connected", когда клиент подключится
    // Внутри useEffect в HostIP.tsx
    const unlisten = import('@tauri-apps/api/event').then(({ listen }) => {
      return listen('connected', () => {
      setIsConnected(true);
      // Как только клиент подключился — переходим в игру
      setTimeout(() => {
        if (onStartGame) onStartGame();
        }, 1000); // Даем секунду, чтобы увидеть "Соперник подключен"
      });
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  return (
    <div className="screen" style={{ backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="host-panel">
        <h1 className="host-title">Ваш сервер</h1>

        <div className="ip-display">
          <span className="ip-bracket">[</span>
          <span className="ip-value">{ip}</span>
          <span className="ip-bracket">]</span>
        </div>

        <p className="host-hint">
          {isConnected ? '// соперник подключен! ждем старта' : '// передайте сервер напарнику'}
        </p>

        <div className="host-status">
          <span className={`dot ${isConnected ? 'green' : ''}`} />
          <span className={`dot ${isConnected ? 'green' : ''}`} />
          <span className={`dot ${isConnected ? 'green' : ''}`} />
        </div>

        <button className="back-button" onClick={onBack}>
          <span className="btn-icon">←</span>
          <span className="btn-text">Назад</span>
        </button>
      </div>
    </div>
  );
}
