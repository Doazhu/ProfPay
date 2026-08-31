import React from 'react';
import ReactDOM from 'react-dom/client';

// Порядок важен. Стили Radix Themes идут первыми, наши — следом, чтобы
// перекрывать их, а не наоборот.
import '@radix-ui/themes/styles.css';
import './index.css';

import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
