import './Menu.css';
import bg from '../assets/bg/bg.png';

type MenuProps = {
  onHost: () => void;
  onClient: () => void;
  onExit: () => void;
};

export default function Menu({ onHost, onClient, onExit }: MenuProps) {
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
      <div className="menu-poster">
        <h1 className="menu-title" data-text="PRO PROJECT">
          PRO PROJECT
        </h1>

        <p className="menu-subtitle">// передай и выживи</p>

        <div className="menu-buttons">
          <button className="menu-button" onClick={onHost}>
            <span className="btn-icon">▸</span>
            <span className="btn-text">Создать игру</span>
          </button>

          <button className="menu-button" onClick={onClient}>
            <span className="btn-icon">▸</span>
            <span className="btn-text">Подключиться</span>
          </button>

          <button className="menu-button menu-button-exit" onClick={onExit}>
            <span className="btn-icon">×</span>
            <span className="btn-text">Выход</span>
          </button>
        </div>

        <div className="menu-footer">
          <span className="footer-author">by Дёмина &amp; Заседателев</span>
          <span className="footer-online blink">● ONLINE</span>
        </div>
      </div>
    </div>
  );
}
