import { useState } from 'react';
import Menu from './screens/Menu';
import HostIP from './screens/HostIP';
import ClientIP from './screens/ClientIP';
import Game from './screens/Game';

type Screen = 'menu' | 'hostIP' | 'clientIP' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');

  // 1. Добавили состояние: true = Хост, false = Клиент
  const [isHostPlayer, setIsHostPlayer] = useState(false);

  const goMenu = () => setScreen('menu');
  const startGame = () => setScreen('game');

  switch (screen) {
    case 'menu':
      return (
        <Menu
          // 2. При клике на "Создать игру" ставим true и идем на экран Хоста
          onHost={() => {
            setIsHostPlayer(true);
            setScreen('hostIP');
          }}
          // 3. При клике на "Подключиться" ставим false и идем на экран Клиента
          onClient={() => {
            setIsHostPlayer(false);
            setScreen('clientIP');
          }}
          onExit={() => window.close()}
        />
      );

    case 'hostIP':
      return <HostIP onBack={goMenu} onStartGame={startGame} />;

    case 'clientIP':
      return (
        <ClientIP
          onBack={goMenu}
          onConnect={startGame}
        />
      );

    case 'game':
      // Передаем isHostPlayer в игру, чтобы она знала, кто ты
      return <Game onGameOver={goMenu} isHost={isHostPlayer} />;

    default:
      return <Menu onHost={() => setScreen('hostIP')} onClient={() => setScreen('clientIP')} onExit={() => window.close()} />;
  }
}
