import { useEffect, useRef } from 'react';

export function EmulatorDisplay({
  session,
  status,
  message,
  onCanvasReady,
  onSaveState,
  onLoadState,
  onTogglePause,
  onToggleFastForward,
  lastSaveTimestamp,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current) {
      onCanvasReady(canvasRef.current);
    }
  }, [onCanvasReady]);

  const isDualScreen = session?.consoleName === 'NDS';

  return (
    <section className="display-stage">
      <div className="stage-header">
        <div className="stage-title-block">
          <p className="eyebrow">Emulator</p>
          <h2 title={session?.name ?? 'Ready to launch'}>{session?.name ?? 'Ready to launch'}</h2>
        </div>
        {session?.consoleName ? (
          <div className="stage-badges">
            <span className="status-pill">{session.consoleName}</span>
          </div>
        ) : null}
      </div>

      <div className={`screen-shell stage-screen ${isDualScreen ? 'dual-screen' : ''}`}>
        <canvas
          ref={canvasRef}
          aria-label="Retro console display"
          className={session ? 'emulator-canvas active' : 'emulator-canvas'}
        />
        {!session && (
          <div className="screen-overlay">
            <div className="screen-placeholder">
              <strong>RetroGamer is ready</strong>
              <p>Choose a ROM from the left rail to launch a local session.</p>
              <span>{message}</span>
            </div>
          </div>
        )}
      </div>

      <div className="stage-toolbar">
        <div className="toolbar-actions">
          <button type="button" onClick={onSaveState} disabled={!session}>
            Save state
          </button>
          <button type="button" onClick={onLoadState} disabled={!session}>
            Load state
          </button>
          <button type="button" onClick={onTogglePause} disabled={!session}>
            {session?.isPaused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" onClick={onToggleFastForward} disabled={!session}>
            {session?.isFastForwarding ? '1x speed' : '2x speed'}
          </button>
        </div>
        <span className="toolbar-note toolbar-status">
          {session?.isFastForwarding ? 'fast-forward' : status}
        </span>
        <span className="toolbar-note">
          {lastSaveTimestamp ? `Last save ${new Date(lastSaveTimestamp).toLocaleString()}` : 'No save captured yet'}
        </span>
      </div>
    </section>
  );
}
