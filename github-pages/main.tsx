import { createRoot } from 'react-dom/client';
import App from '../app/page';
import '../app/globals.css';
import "../styles/tokens.css";
import "../styles/workspace.css";
import "../styles/insights.css";
import { applyColorMode } from '../lib/color-mode';
applyColorMode();
createRoot(document.getElementById('root')!).render(<App />);
