import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './ClientIP.css';
import bg from '../assets/bg/bg.png';

type ClientIPProps = {
  onBack: () => void;
  onConnect?: () => void;
};

type HostFound = { ip: string; port: number };
type Status = 'idle' | 'searching' | 'connecting' | 'error' | 'ok';

export default function ClientIP({ onBack, onConnect }: ClientIPProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorText, setErrorText] = useState('');

  // чтобы не переподписываться на события при каждом рендере App
  const onConnectRef = useRef(onConnect);
  useEffect(() => { onConnectRef.current = onConnect; }, [onConnect]);

  useEffect(() => {
    const unlisteners = [
      listen<HostFound>('host_found', async (e) => {
        const { ip, port } = e.payload;
        setStatus('connecting');
        try {
          await invoke('connect_to_host', { ip, port });
          setStatus('ok');
          onConnectRef.current?.();
        } catch (err) {
          setErrorText(String(err));
          setStatus('error');
        }
      }),
      listen('host_search_timeout', () => {
        setErrorText('хост не найден');
        setStatus('error');
      }),
    ];
    return () => { unlisteners.forEach((p) => p.then((un) => un())); };
  }, []);

  const handleSearch = async () => {
    setErrorText('');
    setStatus('searching');
    try {
      await invoke('discover_host');
    } catch (err) {
      setErrorText(String(err));
      setStatus('error');
    }
  };

  const statusText = {
    idle:       '// нажмите, чтобы найти хоста в сети',
    searching:  '// поиск хоста...',
    connecting: '// подключение...',
    error:      `// ${errorText || 'не удалось подключиться'}`,
    ok:         '// подключено!',
  }[status];

  // для CSS: поиск выглядит как подключение (классы status-* уже есть)
  const cssStatus = status === 'searching' ? 'connecting' : status;
  const busy = status === 'searching' || status === 'connecting' || status === 'ok';

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

        <p className={`client-status status-${cssStatus}`}>
          {statusText}
        </p>

        <button
          className="connect-button"
          onClick={handleSearch}
          disabled={busy}
        >
          <span className="btn-icon">▸</span>
          <span className="btn-text">
            {status === 'searching' ? 'Поиск...' :
             status === 'connecting' ? 'Соединение...' : 'Найти хоста'}
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