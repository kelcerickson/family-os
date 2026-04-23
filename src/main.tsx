import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

// Force full bleed before anything renders
document.documentElement.style.cssText = 'margin:0;padding:0;width:100%;overflow-x:hidden;';
document.body.style.cssText = 'margin:0;padding:0;width:100%;overflow-x:hidden;min-height:100vh;';
const root = document.getElementById('root');
root.style.cssText = 'margin:0;padding:0;width:100%;min-height:100vh;display:block;';

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
