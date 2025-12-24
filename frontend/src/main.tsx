import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WalletProvider } from './providers/WalletProvider'
import { ErrorBoundary } from './ErrorBoundary'

console.log('Starting app initialization...');
console.log('Root element:', document.getElementById('root'));

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  console.log('Creating React root...');
  const root = createRoot(rootElement);
  
  console.log('Rendering app...');
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <WalletProvider>
          <App />
        </WalletProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
  
  console.log('App rendered successfully');
} catch (error) {
  console.error('Failed to initialize app:', error);
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #900;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
        flex-direction: column;
      ">
        <h1>Error Initializing App</h1>
        <p>${(error as Error).message}</p>
        <pre style="text-align: left; max-width: 500px; overflow: auto;">
${(error as Error).stack}
        </pre>
      </div>
    `;
  }
}


