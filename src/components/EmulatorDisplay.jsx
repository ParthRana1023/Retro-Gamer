import { useEffect, useRef } from 'react';

export function EmulatorDisplay({
  session,
  status,
  message,
  onCanvasReady,
  onSaveState,
  onLoadState,
  lastSaveTimestamp,
  volume,
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
        <div>
          <p className="eyebrow">Emulator</p>
          <h2>{session?.name ?? 'Ready to launch'}</h2>
        </div>
        <div className="stage-badges">
          {session?.consoleName ? <span className="status-pill">{session.consoleName}</span> : null}
          <span className="status-pill">{status}</span>
        </div>
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
        <button type="button" onClick={onSaveState} disabled={!session}>
          Save
        </button>
        <button type="button" onClick={onLoadState} disabled={!session}>
          Load
        </button>
        <span className="toolbar-metric">Vol {volume}%</span>
        <span className="toolbar-note">
          {lastSaveTimestamp ? `Last save ${new Date(lastSaveTimestamp).toLocaleString()}` : 'No save captured yet'}
        </span>
      </div>
    </section>
  );
}
