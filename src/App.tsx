import { useState } from 'react';
import Menu from './screens/Menu';
import HostIP from './screens/HostIP';
import ClientIP from './screens/ClientIP';

type Screen = 'menu' | 'hostIP' | 'clientIP';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');

  const goMenu = () => setScreen('menu');

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
      return <HostIP onBack={goMenu} />;

    case 'clientIP':
      return <ClientIP onBack={goMenu} />;

    default:
      return (
        <Menu
          onHost={() => setScreen('hostIP')}
          onClient={() => setScreen('clientIP')}
          onExit={() => window.close()}
        />
      );
  }
}
