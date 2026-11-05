import { useState } from 'react';
import Menu from './screens/Menu';
import HostIP from './screens/HostIP';
import ClientIP from './screens/ClientIP';
import Game from './screens/Game'; // <-- 1. Импортируем игру

type Screen = 'menu' | 'hostIP' | 'clientIP' | 'game'; // <-- 2. Добавляем 'game'

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');

  const goMenu = () => setScreen('menu');

  // Функция для перехода в игру (пока просто заглушка)
  const startGame = () => setScreen('game');

  // Функция для конца игры
  const gameOver = () => setScreen('menu');

  switch (screen) {
    case 'menu':
      return (
        <Menu
          onHost={() => setScreen('hostIP')}
          onClient={() => setScreen('clientIP')}
          onExit={() => window.close()}
        />
      );

    case 'hostIP':
      return <HostIP onBack={goMenu} onGameStart={startGame} />;

    case 'clientIP':
      return (
        <ClientIP
          onBack={goMenu}
          onConnect={startGame} // <-- 3. Передаем коллбэк в клиент
        />
      );

    case 'game': // <-- 4. Новый экран
      return <Game onGameOver={goMenu} />;

    default:
      return <Menu onHost={() => setScreen('hostIP')} onClient={() => setScreen('clientIP')} onExit={() => window.close()} />;
  }
}
