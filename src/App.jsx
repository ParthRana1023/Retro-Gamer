import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthPanel } from './components/AuthPanel';
import { ControlsPanel } from './components/ControlsPanel';
import { EmulatorDisplay } from './components/EmulatorDisplay';
import { Library } from './components/Library';
import './App.css';
import { ControllerManager, DEFAULT_KEY_BINDINGS } from './services/controllerManager';
import { detectConsoleProfile, EmulatorCore } from './services/emulatorCore';
import { getCurrentUser, onAuthStateChange, signIn, signOut, signUp } from './services/supabase';
import { SAVE_TYPES, StorageManager } from './services/storageManager';

const KEY_BINDINGS_STORAGE_KEY = 'retrogamer.keyBindings';
const VOLUME_STORAGE_KEY = 'retrogamer.volume';

const describeRom = (file) => detectConsoleProfile(file.name).consoleName;

const readStoredJson = (key, fallback) => {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};

const readStoredVolume = () => {
  if (typeof window === 'undefined') {
    return 75;
  }

  const raw = Number(window.localStorage.getItem(VOLUME_STORAGE_KEY));
  return Number.isFinite(raw) && raw >= 0 && raw <= 100 ? raw : 75;
};

function App() {
  const [keyBindings, setKeyBindings] = useState(() => readStoredJson(KEY_BINDINGS_STORAGE_KEY, DEFAULT_KEY_BINDINGS));
  const [volume, setVolume] = useState(() => readStoredVolume());
  const storageRef = useRef(new StorageManager());
  const controllerRef = useRef(new ControllerManager(keyBindings));
  const emulatorRef = useRef(new EmulatorCore());
  const volumeReloadInFlightRef = useRef(false);

  const [roms, setRoms] = useState([]);
  const [activeRomId, setActiveRomId] = useState(null);
  const [status, setStatus] = useState('booting');
  const [saveSlots, setSaveSlots] = useState([]);
  const [message, setMessage] = useState('Initializing services...');
  const [user, setUser] = useState(null);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState('');
  const [pendingBinding, setPendingBinding] = useState(null);
  const [activeDockTab, setActiveDockTab] = useState('controls');
  const [authExpanded, setAuthExpanded] = useState(false);
  const [volumeReloadPending, setVolumeReloadPending] = useState(false);

  const activeRom = useMemo(
    () => roms.find((rom) => rom.id === activeRomId) ?? null,
    [roms, activeRomId],
  );

  const activeSession = emulatorRef.current.getSession();
  const syncMode = user ? 'cloud' : 'guest';

  const refreshSaveSlots = async (romId) => {
    const records = await storageRef.current.listStates(romId);
    setSaveSlots(records.filter((record) => record.type === SAVE_TYPES.STATE));
  };

  const persistSramForSession = async (rom = activeRom) => {
    if (!rom) {
      return null;
    }

    const sram = await emulatorRef.current.captureSRAM();
    if (!sram || sram.size === 0) {
      return null;
    }

    await storageRef.current.saveSRAM(rom.id, sram, {
      metadata: {
        romName: rom.name,
        consoleName: rom.consoleName,
      },
    });

    return sram;
  };

  const persistSramForSessionSafe = async (rom = activeRom) => {
    try {
      return await persistSramForSession(rom);
    } catch (error) {
      if (String(error?.message ?? error).toLowerCase().includes('fs timeout')) {
        return null;
      }
      setMessage(`Continuing without SRAM sync: ${error.message}`);
      return null;
    }
  };

  const captureCurrentState = async () => {
    if (!activeRom) {
      return null;
    }

    return emulatorRef.current.captureState();
  };

  useEffect(() => {
    let cancelled = false;

    const handleInput = (input) => {
      emulatorRef.current.setInputState(input.snapshot);
    };

    const boot = async () => {
      try {
        await storageRef.current.init();
        const userResult = await getCurrentUser();
        if (!cancelled) {
          const nextUser = userResult.data?.user ?? null;
          setUser(nextUser);
          storageRef.current.setAuthSession(nextUser);
        }

        controllerRef.current.addListener(handleInput);
        controllerRef.current.startListening();

        if (!cancelled) {
          setStatus('ready');
          setMessage('Ready for local ROM loading.');
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setMessage(error.message);
        }
      }
    };

    const authSubscription = onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      storageRef.current.setAuthSession(nextUser);
    });

    boot();

    return () => {
      cancelled = true;
      controllerRef.current.removeListener(handleInput);
      controllerRef.current.stopListening();
      emulatorRef.current.exit();
      authSubscription?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const handleRebind = (event) => {
      if (!pendingBinding || event.type !== 'keydown') {
        return;
      }

      event.preventDefault();
      const nextBindings = { ...keyBindings, [pendingBinding]: event.code };
      setKeyBindings(nextBindings);
      setPendingBinding(null);
      setMessage(`Updated ${pendingBinding.toUpperCase()} to ${event.code}.`);
    };

    window.addEventListener('keydown', handleRebind);
    return () => window.removeEventListener('keydown', handleRebind);
  }, [keyBindings, pendingBinding]);

  useEffect(() => {
    controllerRef.current.setKeyboardBindings(keyBindings);
    window.localStorage.setItem(KEY_BINDINGS_STORAGE_KEY, JSON.stringify(keyBindings));
  }, [keyBindings]);

  useEffect(() => {
    storageRef.current.setAuthSession(user);
  }, [user]);

  useEffect(() => {
    if (!activeRom) {
      setSaveSlots([]);
      return;
    }

    refreshSaveSlots(activeRom.id);
  }, [activeRom]);

  useEffect(() => {
    window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
  }, [volume]);

  const loadRom = async (rom, options = {}) => {
    try {
      setStatus('loading');

      const sram = options.sram ?? await storageRef.current.loadSRAM(rom.id);
      const session = await emulatorRef.current.loadRom(rom.file, {
        sram,
        state: options.state,
        volume: options.volume ?? volume,
      });

      setStatus(emulatorRef.current.getStatus());
      setMessage(`${session.consoleName} session ready. ROM bytes remain local.`);
      await refreshSaveSlots(rom.id);
      return session;
    } catch (error) {
      setStatus('error');
      setMessage(error.message);
      return null;
    }
  };

  const confirmGameSwitch = (nextRom) => {
    if (!activeRom || activeRom.id === nextRom.id || !emulatorRef.current.getSession()) {
      return true;
    }

    return window.confirm(
      `Switch from "${activeRom.name}" to "${nextRom.name}"?\n\nUnsaved save-state progress may be lost unless you save first.`,
    );
  };

  const applyVolumePreference = async (nextVolume) => {
    setVolume(nextVolume);

    if (!activeRom || !emulatorRef.current.getSession()) {
      setMessage(`Volume saved at ${nextVolume}%. It will apply when you launch a game.`);
      return;
    }

    if (volumeReloadInFlightRef.current) {
      setMessage('Volume change already in progress. Please wait for the current reload to finish.');
      return;
    }

    const currentSession = emulatorRef.current.getSession();
    if (currentSession?.volume === nextVolume) {
      return;
    }

    volumeReloadInFlightRef.current = true;
    setVolumeReloadPending(true);

    try {
      const state = await captureCurrentState();
      const session = await loadRom(activeRom, {
        volume: nextVolume,
      });

      if (session) {
        if (state) {
          await new Promise((resolve) => window.setTimeout(resolve, 120));
          await emulatorRef.current.restoreState(state);
        }

        setStatus(emulatorRef.current.getStatus());
        setMessage(`Volume updated to ${nextVolume}% for ${activeRom.name}.`);
      } else {
        setMessage(`Couldn't apply ${nextVolume}% right now. It will be used the next time you launch ${activeRom.name}.`);
      }
    } finally {
      volumeReloadInFlightRef.current = false;
      setVolumeReloadPending(false);
    }
  };

  const handleVolumeInputChange = (nextVolume) => {
    setVolume(nextVolume);
  };

  const handleVolumeCommit = async (nextVolume) => {
    await applyVolumePreference(nextVolume);
  };

  const selectRom = async (romId) => {
    const rom = roms.find((entry) => entry.id === romId);
    if (!rom) {
      return;
    }

    if (!confirmGameSwitch(rom)) {
      setMessage(`Stayed on ${activeRom?.name ?? 'the current game'}.`);
      return;
    }

    setActiveRomId(romId);
    await loadRom(rom);
  };

  const loadFiles = async (files) => {
    const mapped = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${file.size}`,
      file,
      name: file.name,
      size: file.size,
      consoleName: describeRom(file),
    }));

    setRoms((current) => {
      const next = [...current];
      mapped.forEach((candidate) => {
        if (!next.some((existing) => existing.id === candidate.id)) {
          next.push(candidate);
        }
      });
      return next;
    });

    if (mapped[0]) {
      if (!confirmGameSwitch(mapped[0])) {
        setMessage(`${mapped.length} ROM${mapped.length > 1 ? 's' : ''} added locally.`);
        return;
      }

      setActiveRomId(mapped[0].id);
      await loadRom(mapped[0]);
    }

    setMessage(`${mapped.length} ROM${mapped.length > 1 ? 's' : ''} added locally.`);
  };

  const handleCanvasReady = (canvas) => {
    emulatorRef.current.mountCanvas(canvas);
  };

  const handleSaveState = async () => {
    if (!activeRom) {
      return;
    }

    const snapshot = await emulatorRef.current.captureState();
    if (!snapshot) {
      return;
    }

    await storageRef.current.saveState(activeRom.id, snapshot, {
      slot: 'autosave',
      metadata: {
        romName: activeRom.name,
        consoleName: activeRom.consoleName,
      },
    });

    await refreshSaveSlots(activeRom.id);
    setMessage(`Saved ${activeRom.name} ${syncMode === 'cloud' ? 'to cloud + local cache' : 'locally'}.`);
  };

  const handleLoadState = async () => {
    if (!activeRom) {
      return;
    }

    const state = await storageRef.current.loadState(activeRom.id);
    if (!state) {
      setMessage('No save state found for this ROM yet.');
      return;
    }

    await emulatorRef.current.restoreState(state);
    setStatus(emulatorRef.current.getStatus());
    setMessage(`Loaded latest state for ${activeRom.name}.`);
  };

  const handleAuthAction = async (action, credentials) => {
    setAuthPending(true);
    setAuthError('');

    try {
      const result = await action(credentials.email, credentials.password);
      if (result.error) {
        throw result.error;
      }

      const currentUser = await getCurrentUser();
      setUser(currentUser.data?.user ?? null);
      setAuthExpanded(false);
      setMessage(currentUser.data?.user ? 'Cloud sync connected.' : 'Check your email to finish sign-up.');
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthPending(false);
    }
  };

  const handleSignOut = async () => {
    setAuthPending(true);
    setAuthError('');

    try {
      const result = await signOut();
      if (result.error) {
        throw result.error;
      }

      setUser(null);
      setMessage('Returned to guest mode.');
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthPending(false);
    }
  };

  return (
    <div className="dashboard-shell">
      <header className="topbar">
        <div className="topbar-primary">
          <div>
            <p className="eyebrow">RetroGamer</p>
            <h1>Control Deck</h1>
          </div>
          <div className="topbar-context">
            <strong>{activeSession?.name ?? 'No ROM loaded'}</strong>
            <span>{message}</span>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="status-chip">{syncMode === 'cloud' ? 'Cloud mode' : 'Guest mode'}</span>
          <span className="status-chip">{status}</span>
          <span className="status-chip">Vol {volume}%</span>
          <button type="button" onClick={handleSaveState} disabled={!activeSession}>
            Save
          </button>
          <button type="button" onClick={handleLoadState} disabled={!activeSession}>
            Load
          </button>
        </div>
      </header>

      <main className="workspace-grid">
        <Library
          roms={roms}
          activeRomId={activeRomId}
          activeRom={activeRom}
          onSelectRom={selectRom}
          onLoadFiles={loadFiles}
        />

        <EmulatorDisplay
          session={activeSession}
          status={status}
          message={message}
          onCanvasReady={handleCanvasReady}
          onSaveState={handleSaveState}
          onLoadState={handleLoadState}
          lastSaveTimestamp={saveSlots[0]?.updatedAt}
          volume={volume}
        />

        <aside className="dock-panel utility-dock">
          <div className="dock-header">
            <div>
              <p className="eyebrow">Utility Dock</p>
              <h2>{activeRom?.consoleName ?? 'Session tools'}</h2>
            </div>
          </div>

          <div className="session-summary">
            <strong>{activeSession?.name ?? 'Idle session'}</strong>
            <span>{activeSession ? `${activeSession.consoleName} via ${activeSession.core}` : 'Load a ROM to activate save, audio, and mapping tools.'}</span>
          </div>

          <div className="dock-tabs" role="tablist" aria-label="Utility dock tabs">
            <button
              type="button"
              className={activeDockTab === 'controls' ? 'dock-tab active' : 'dock-tab'}
              onClick={() => setActiveDockTab('controls')}
            >
              Controls
            </button>
            <button
              type="button"
              className={activeDockTab === 'audio' ? 'dock-tab active' : 'dock-tab'}
              onClick={() => setActiveDockTab('audio')}
            >
              Audio
            </button>
            <button
              type="button"
              className={activeDockTab === 'cloud' ? 'dock-tab active' : 'dock-tab'}
              onClick={() => setActiveDockTab('cloud')}
            >
              Cloud
            </button>
          </div>

          <div className="dock-body">
            {activeDockTab === 'controls' ? (
              <ControlsPanel
                keyBindings={keyBindings}
                pendingBinding={pendingBinding}
                onBeginRebind={setPendingBinding}
                onResetBindings={() => {
                  setKeyBindings(DEFAULT_KEY_BINDINGS);
                  setPendingBinding(null);
                  setMessage('Controls reset to defaults.');
                }}
              />
            ) : null}

            {activeDockTab === 'audio' ? (
              <div className="dock-content audio-content">
                <div className="settings-block">
                  <div className="settings-row">
                    <strong>Master volume</strong>
                    <span>{volume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={volume}
                    disabled={volumeReloadPending || status === 'loading'}
                    onChange={(event) => handleVolumeInputChange(Number(event.target.value))}
                    onMouseUp={(event) => handleVolumeCommit(Number(event.currentTarget.value))}
                    onTouchEnd={(event) => handleVolumeCommit(Number(event.currentTarget.value))}
                    onKeyUp={(event) => handleVolumeCommit(Number(event.currentTarget.value))}
                  />
                  <span className="settings-help">Drag to choose a level, then release to reload the active session with that volume.</span>
                </div>
                <div className="dock-tip">When a game is running, volume changes reload the current ROM and restore the latest in-memory state.</div>
              </div>
            ) : null}

            {activeDockTab === 'cloud' ? (
              <AuthPanel
                user={user}
                authPending={authPending}
                authError={authError}
                isExpanded={authExpanded}
                onToggleExpanded={() => setAuthExpanded((current) => !current)}
                onSignIn={(credentials) => handleAuthAction(signIn, credentials)}
                onSignUp={(credentials) => handleAuthAction(signUp, credentials)}
                onSignOut={handleSignOut}
              />
            ) : null}
          </div>

          <div className="dock-footer">
            <strong>Current bindings</strong>
            <span>{`Move ${keyBindings.up}/${keyBindings.left}/${keyBindings.down}/${keyBindings.right} · A ${keyBindings.a} · B ${keyBindings.b}`}</span>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
