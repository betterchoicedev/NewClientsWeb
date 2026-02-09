import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Register service worker for PWA functionality
// Only register in production to avoid development issues
if (process.env.NODE_ENV === 'production') {
  serviceWorkerRegistration.register({
    onSuccess: () => {
      console.log('Service Worker registered successfully');
    },
    onUpdate: (registration) => {
      console.log('New service worker available. Reload to update.');
      // Don't auto-reload - let user decide
      // Optionally show a notification to the user
      if (window.confirm('New version available! Reload to update?')) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    },
  });
} else {
  // In development, unregister any existing service workers
  serviceWorkerRegistration.unregister();
}
