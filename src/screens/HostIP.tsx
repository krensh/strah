import { useEffect, useState } from 'react';
import './HostIP.css';
import bg from '../assets/bg/bg.png';

type HostIPProps = {
  onBack: () => void;
};

export default function HostIP({ onBack }: HostIPProps) {
  const [ip, setIp] = useState('192.168.0.1');

  useEffect(() => {
    setIp('192.168.0.1');
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
          <span className="ip-value">{ip}</span>
          <span className="ip-bracket">]</span>
        </div>

        <p className="host-hint">// передайте сервер напарнику</p>

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
