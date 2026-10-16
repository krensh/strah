import './Menu.css';
import '../components/SkyBackground.css';
import SkyBackground from '../components/SkyBackground';

import cdGif from '../assets/gifs/CD.gif';
import catGif from '../assets/gifs/scubacat.gif';
import strokaGif from '../assets/gifs/text.gif';

type MenuProps = {
  onHost: () => void;
  onClient: () => void;
  onExit: () => void;
};

export default function Menu({ onHost, onClient, onExit }: MenuProps) {
  return (
    <div className="screen">

      <SkyBackground />

      <h1 className="menu-title">Cool Connection</h1>

      <div className="menu-buttons">
        <button className="menu-button" onClick={onHost}>Хост</button>
        <button className="menu-button" onClick={onClient}>Клиент</button>
        <button className="menu-button" onClick={onExit}>Выход</button>
      </div>

      <div className="cd-player">
        <img className="cd-disc" src={cdGif}  alt="" />
        <img className="cd-cat"  src={catGif} alt="" />
        <div className="credit">
          Проект Дёминой Арины<br />и Заседателева Егора
        </div>
      </div>

      <img className="marquee-gif" src={strokaGif} alt="" />

    </div>
  );
}
