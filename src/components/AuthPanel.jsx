import { useState } from 'react';

export function AuthPanel({
  user,
  authPending,
  authError,
  isExpanded,
  onToggleExpanded,
  onSignIn,
  onSignUp,
  onSignOut,
}) {
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });

  if (user) {
    return (
      <div className="dock-content auth-content">
        <div className="account-card">
          <strong>{user.email}</strong>
          <span>Cloud sync active for save states and SRAM.</span>
        </div>
        <button type="button" onClick={onSignOut} disabled={authPending}>
          Sign out
        </button>
        <div className="dock-tip">ROM files remain local and are never uploaded.</div>
        {authError ? <p className="error-text">{authError}</p> : null}
      </div>
    );
  }

  return (
    <div className="dock-content auth-content">
      <div className="account-card">
        <strong>Guest mode</strong>
        <span>Expand to connect Supabase cloud saves.</span>
      </div>

      <button type="button" onClick={onToggleExpanded}>
        {isExpanded ? 'Hide sign-in' : 'Open sign-in'}
      </button>

      {isExpanded ? (
        <form
          className="auth-form compact-auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSignIn(credentials);
          }}
        >
          <label>
            <span>Email</span>
            <input
              type="email"
              value={credentials.email}
              onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
              required
            />
          </label>
          <div className="auth-actions compact-auth-actions">
            <button type="submit" disabled={authPending}>
              Sign in
            </button>
            <button
              type="button"
              disabled={authPending}
              onClick={() => onSignUp(credentials)}
            >
              Sign up
            </button>
          </div>
        </form>
      ) : null}

      <div className="dock-tip">Only save data and preferences are eligible for sync.</div>
      {authError ? <p className="error-text">{authError}</p> : null}
    </div>
  );
}
