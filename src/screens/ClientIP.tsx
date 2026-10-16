import { useState } from 'react';
import './ClientIP.css';
import SkyBackground from '../components/SkyBackground';

type ClientIPProps = {
  onBack: () => void;
  onConnect?: () => void;
};

export default function ClientIP({ onBack, onConnect }: ClientIPProps) {
  const [ip, setIp] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'error' | 'ok'>('idle');

  const handleConnect = () => {
    if (!ip.trim()) return;

    setStatus('connecting');

    // Заглушка. Позже здесь будет реальное WebSocket-подключение.
    setTimeout(() => {
      if (ip === '192.168.0.1' || ip.startsWith('192.168.') || ip === '127.0.0.1') {
        setStatus('ok');
        onConnect?.();
      } else {
        setStatus('error');
      }
    }, 1200);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIp(e.target.value);
    if (status === 'error') setStatus('idle');
  };

  const statusText = {
    idle:       'Введите IP сервера',
    connecting: 'Подключение...',
    error:      'Не удалось подключиться',
    ok:         'Подключено!',
  }[status];

  return (
    <div className="screen">

      <SkyBackground />

      <div className="client-panel">
        <h1 className="client-title">Подключение</h1>

        <p className="client-label">Введите IP сервера напарника</p>

        <input
          className="ip-input"
          type="text"
          value={ip}
          onChange={handleChange}
          onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          placeholder="192.168.0.1"
          spellCheck={false}
          autoFocus
          disabled={status === 'connecting' || status === 'ok'}
        />

        <p className={`client-status status-${status}`}>
          {statusText}
        </p>

        <button
          className="client-button"
          onClick={handleConnect}
          disabled={status === 'connecting' || status === 'ok' || !ip.trim()}
        >
          {status === 'connecting' ? 'Соединение...' : 'Подключиться'}
        </button>

        <button className="client-back" onClick={onBack}>
          ← Назад
        </button>
      </div>

    </div>
  );
}
