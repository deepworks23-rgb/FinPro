import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const markIconsLoaded = () => document.documentElement.classList.add('icons-loaded');
if (typeof document !== 'undefined' && 'fonts' in document) {
  if (document.fonts.check('24px "Material Symbols Outlined"')) {
    markIconsLoaded();
  } else {
    void document.fonts
      .load('24px "Material Symbols Outlined"')
      .then(markIconsLoaded)
      .catch(() => {});
  }
} else if (typeof document !== 'undefined') {
  markIconsLoaded();
}

createRoot(document.getElementById('root')!).render(<App />);
