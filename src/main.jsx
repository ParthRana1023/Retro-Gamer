import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: '32px',
            background: '#0c1730',
            color: '#f7f7fb',
            fontFamily: 'Segoe UI, sans-serif',
          }}
        >
          <h1 style={{ marginBottom: '16px' }}>RetroGamer failed to start</h1>
          <p style={{ marginBottom: '12px' }}>
            The app hit a runtime error before rendering.
          </p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: 'rgba(255,255,255,0.08)',
              padding: '16px',
              borderRadius: '12px',
            }}
          >
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
);
