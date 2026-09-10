import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const err = this.state.error;
      return (
        <div className="screen">
          <h1>Something broke</h1>
          <div className="statusline bad">{err && err.message ? err.message : String(err)}</div>
          {err && err.stack && (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: 'var(--muted)', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 4, padding: 10, marginTop: 10 }}>
              {err.stack}
            </pre>
          )}
          <button className="secondary" style={{ width: '100%', marginTop: 14 }} onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
