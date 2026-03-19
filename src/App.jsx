import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthPanel } from './components/AuthPanel';
import { ControlsModal } from './components/ControlsModal';
import { EmulatorDisplay } from './components/EmulatorDisplay';
import { Library } from './components/Library';
import './App.css';
import {
  ControllerManager,
  createBindingProfiles,
  getBindingLabel,
  getBindingsForConsole,
  getButtonsForConsole,
} from './services/controllerManager';
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
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const readStoredBindingProfiles = () => createBindingProfiles(readStoredJson(KEY_BINDINGS_STORAGE_KEY, {}));

const readStoredVolume = () => {
  if (typeof window === 'undefined') {
    return 75;
  }

  const raw = Number(window.localStorage.getItem(VOLUME_STORAGE_KEY));
  return Number.isFinite(raw) && raw >= 0 && raw <= 100 ? raw : 75;
};

const formatBindingSummary = (consoleName, buttons, keyBindings) => {
  const summaryButtons = buttons.filter((button) => ['up', 'left', 'down', 'right', 'a', 'b', 'x', 'y', 'l', 'r', 'start', 'select'].includes(button));
  return summaryButtons
    .slice(0, 6)
    .map((button) => `${getBindingLabel(consoleName, button)} ${keyBindings[button]}`)
    .join(' • ');
};

function App() {
  const [bindingProfiles, setBindingProfiles] = useState(() => readStoredBindingProfiles());
  const [volume, setVolume] = useState(() => readStoredVolume());
  const storageRef = useRef(new StorageManager());
  const controllerRef = useRef(new ControllerManager(getBindingsForConsole(readStoredBindingProfiles(), 'default')));
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
  const [activeDockTab, setActiveDockTab] = useState('session');
  const [authExpanded, setAuthExpanded] = useState(false);
  const [volumeReloadPending, setVolumeReloadPending] = useState(false);
  const [controlsModalOpen, setControlsModalOpen] = useState(false);

  const activeRom = useMemo(
    () => roms.find((rom) => rom.id === activeRomId) ?? null,
    [roms, activeRomId],
  );

  const activeSession = emulatorRef.current.getSession();
  const activeConsoleName = activeSession?.consoleName ?? activeRom?.consoleName ?? 'default';
  const activeButtons = getButtonsForConsole(activeConsoleName);
  const activeBindings = getBindingsForConsole(bindingProfiles, activeConsoleName);
  const syncMode = user ? 'cloud' : 'guest';
  const bindingsSummary = formatBindingSummary(activeConsoleName, activeButtons, activeBindings);
  const sessionMeta = activeSession
    ? `${activeSession.consoleName} via ${activeSession.core}`
    : 'Import a ROM to start a local session.';

  const refreshSaveSlots = async (romId) => {
    const records = await storageRef.current.listStates(romId);
    setSaveSlots(records.filter((record) => record.type === SAVE_TYPES.STATE));
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

      if (event.code === 'Escape') {
        setPendingBinding(null);
        return;
      }

      event.preventDefault();
      setBindingProfiles((current) => ({
        ...current,
        [activeConsoleName]: {
          ...getBindingsForConsole(current, activeConsoleName),
          [pendingBinding]: event.code,
        },
      }));
      setPendingBinding(null);
      setMessage(`Updated ${getBindingLabel(activeConsoleName, pendingBinding)} to ${event.code}.`);
    };

    window.addEventListener('keydown', handleRebind);
    return () => window.removeEventListener('keydown', handleRebind);
  }, [activeConsoleName, pendingBinding]);

  useEffect(() => {
    controllerRef.current.setKeyboardBindings(activeBindings);
    window.localStorage.setItem(KEY_BINDINGS_STORAGE_KEY, JSON.stringify(bindingProfiles));
  }, [activeBindings, bindingProfiles]);

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

  const handleTogglePause = () => {
    const paused = emulatorRef.current.togglePause();
    const nextStatus = emulatorRef.current.getStatus();
    setStatus(nextStatus);

    if (!activeRom) {
      return;
    }

    setMessage(paused ? `${activeRom.name} paused.` : `${activeRom.name} resumed.`);
  };

  const handleToggleFastForward = () => {
    const fastForwardEnabled = emulatorRef.current.toggleFastForward();

    if (!activeRom) {
      return;
    }

    setMessage(
      fastForwardEnabled
        ? `Fast-forward enabled for ${activeRom.name}.`
        : `Fast-forward disabled for ${activeRom.name}.`,
    );
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
      const nextUser = currentUser.data?.user ?? null;
      setUser(nextUser);
      storageRef.current.setAuthSession(nextUser);
      setAuthExpanded(false);
      setMessage(nextUser ? 'Cloud sync connected.' : 'Check your email to finish sign-up.');
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
      storageRef.current.setAuthSession(null);
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
        <div className="topbar-brand">
          <div>
            <p className="eyebrow">RetroGamer</p>
            <h1>Control Deck</h1>
          </div>
          <div className="topbar-copy">
            <strong>{activeSession?.name ?? 'No ROM loaded'}</strong>
            <span>{message}</span>
          </div>
        </div>

        <div className="topbar-meta">
          <span className="status-chip">{syncMode === 'cloud' ? 'Cloud mode' : 'Guest mode'}</span>
          <span className={`status-chip status-${status}`}>{status}</span>
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
          onTogglePause={handleTogglePause}
          onToggleFastForward={handleToggleFastForward}
          lastSaveTimestamp={saveSlots[0]?.updatedAt}
        />

        <aside className="dock-panel utility-dock">
          <div className="dock-header">
            <div>
              <p className="eyebrow">Control room</p>
              <h2>{activeRom?.consoleName ?? 'Session tools'}</h2>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setControlsModalOpen(true)}
            >
              Edit controls
            </button>
          </div>

          <div className="session-summary">
            <strong>{activeSession?.name ?? 'Idle session'}</strong>
            <span>{sessionMeta}</span>
          </div>

          <div className="dock-tabs" role="tablist" aria-label="Utility dock tabs">
            <button
              type="button"
              className={activeDockTab === 'session' ? 'dock-tab active' : 'dock-tab'}
              onClick={() => setActiveDockTab('session')}
            >
              Session
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
            {activeDockTab === 'session' ? (
              <div className="dock-content session-content">
                <div className="utility-card">
                  <span className="utility-label">Current bindings</span>
                  <strong>{bindingsSummary}</strong>
                </div>
                <div className="utility-card">
                  <span className="utility-label">Primary cores</span>
                  <strong>NES, SNES, Genesis, GB, GBC, and GBA are all mapped to their production cores in the launcher.</strong>
                </div>
                <div className="utility-card">
                  <span className="utility-label">Console-aware layout</span>
                  <strong>The controls popup now switches labels and available buttons based on the active console.</strong>
                </div>
              </div>
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
                  <span className="settings-help">
                    Release the slider to relaunch the current session with the new volume.
                  </span>
                </div>
                <div className="utility-card">
                  <span className="utility-label">Audio note</span>
                  <strong>Volume is applied on reload because the active emulator core does not expose a dependable live volume API.</strong>
                </div>
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
        </aside>
      </main>

      <ControlsModal
        isOpen={controlsModalOpen}
        consoleName={activeConsoleName}
        buttons={activeButtons}
        keyBindings={activeBindings}
        pendingBinding={pendingBinding}
        onClose={() => {
          setControlsModalOpen(false);
          setPendingBinding(null);
        }}
        onBeginRebind={setPendingBinding}
        onResetBindings={() => {
          setBindingProfiles((current) => ({
            ...current,
            [activeConsoleName]: getBindingsForConsole(createBindingProfiles({}), activeConsoleName),
          }));
          setPendingBinding(null);
          setMessage(`${activeConsoleName} controls reset to defaults.`);
        }}
      />
    </div>
  );
}

export default App;
