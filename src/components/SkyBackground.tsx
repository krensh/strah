import './SkyBackground.css';

import sky1 from '../assets/bg/sky1.png';
import sky2 from '../assets/bg/sky2.png';
import sky3 from '../assets/bg/sky3.png';

export default function SkyBackground() {
  return (
    <>
      <div className="sky-layer"   style={{ backgroundImage: `url(${sky1})` }} />
      <div className="sky-layer-2" style={{ backgroundImage: `url(${sky2})` }} />
      <div className="sky-layer-3" style={{ backgroundImage: `url(${sky3})` }} />
    </>
  );
}
