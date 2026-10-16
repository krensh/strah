import { useEffect, useState } from 'react';
import './HostIP.css';
import SkyBackground from '../components/SkyBackground';

type HostIPProps = {
  onBack: () => void;
};

export default function HostIP({ onBack }: HostIPProps) {
  const [ip, setIp] = useState('192.168.0.1');

  // Позже заменим на invoke('get_local_ip') из Rust
  useEffect(() => {
    setIp('192.168.0.1');
  }, []);

  return (
    <div className="screen">

      <SkyBackground />

      <div className="host-panel">
        <h1 className="host-title">Ваш сервер</h1>

        <div className="ip-display">
          <span className="ip-bracket">[</span>
          <span className="ip-value">{ip}</span>
          <span className="ip-bracket">]</span>
        </div>

        <p className="host-hint">
          Передайте сервер напарнику
        </p>

        <div className="host-status">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>

        <button className="host-back" onClick={onBack}>
          ← Назад
        </button>
      </div>

    </div>
  );
}
