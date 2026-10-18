import { useState } from 'react';
import './ClientIP.css';
import bg from '../assets/bg/bg.png';

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
    idle:       '// введите IP сервера',
    connecting: '// подключение...',
    error:      '// не удалось подключиться',
    ok:         '// подключено!',
  }[status];

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
      <div className="client-panel">
        <h1 className="client-title">Подключение</h1>

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
          className="connect-button"
          onClick={handleConnect}
          disabled={status === 'connecting' || status === 'ok' || !ip.trim()}
        >
          <span className="btn-icon">▸</span>
          <span className="btn-text">
            {status === 'connecting' ? 'Соединение...' : 'Подключиться'}
          </span>
        </button>

        <button className="back-button" onClick={onBack}>
          <span className="btn-icon">←</span>
          <span className="btn-text">Назад</span>
        </button>
      </div>
    </div>
  );
}
