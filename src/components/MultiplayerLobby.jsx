import { useEffect, useRef, useState } from 'react';
import {
  CONNECTION_STATES,
  getMultiplayerMode,
  MULTIPLAYER_MODES,
} from '../services/webrtcManager';

const MODE_LABELS = {
  [MULTIPLAYER_MODES.STANDARD_NETPLAY]: 'Standard Netplay',
  [MULTIPLAYER_MODES.DUAL_EMULATION]: 'Link Cable (Trade / Battle)',
  [MULTIPLAYER_MODES.WIRELESS_ADAPTER]: 'Wireless Adapter',
};

const STATE_LABELS = {
  [CONNECTION_STATES.IDLE]: 'Ready',
  [CONNECTION_STATES.CREATING_ROOM]: 'Creating room…',
  [CONNECTION_STATES.WAITING_FOR_PEER]: 'Waiting for Player 2…',
  [CONNECTION_STATES.JOINING_ROOM]: 'Joining room…',
  [CONNECTION_STATES.CONNECTING]: 'Connecting…',
  [CONNECTION_STATES.CONNECTED]: 'Connected!',
  [CONNECTION_STATES.STREAMING]: 'Streaming',
  [CONNECTION_STATES.TRANSFERRING_SAVE]: 'Transferring save…',
  [CONNECTION_STATES.DISCONNECTED]: 'Disconnected',
  [CONNECTION_STATES.ERROR]: 'Error',
};

export function MultiplayerLobby({
  consoleName,
  connectionState,
  roomCode,
  isHost,
  onHostRoom,
  onJoinRoom,
  onDisconnect,
  onSendSave,
  activeRom,
}) {
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const multiplayerMode = getMultiplayerMode(consoleName);
  const isConnected =
    connectionState === CONNECTION_STATES.CONNECTED ||
    connectionState === CONNECTION_STATES.STREAMING;
  const isActive =
    connectionState !== CONNECTION_STATES.IDLE &&
    connectionState !== CONNECTION_STATES.DISCONNECTED &&
    connectionState !== CONNECTION_STATES.ERROR;

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  const handleCopyCode = async () => {
    if (roomCode) {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
    }
  };

  const handleSaveFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onSendSave?.(reader.result);
    };
    reader.readAsArrayBuffer(file);

    event.target.value = '';
  };

  if (!multiplayerMode) {
    return (
      <div className="dock-content multiplayer-content">
        <div className="utility-card">
          <span className="utility-label">Multiplayer</span>
          <strong>
            {consoleName
              ? `Multiplayer is not yet supported for ${consoleName}.`
              : 'Load a ROM to see multiplayer options.'}
          </strong>
        </div>
      </div>
    );
  }

  return (
    <div className="dock-content multiplayer-content">
      {/* ── Mode info ────────────────────────────────────────────── */}
      <div className="utility-card">
        <span className="utility-label">Mode</span>
        <strong>{MODE_LABELS[multiplayerMode]}</strong>
      </div>

      {/* ── Connection status ────────────────────────────────────── */}
      <div className="multiplayer-status-card">
        <span
          className={`multiplayer-status-dot ${isConnected ? 'connected' : isActive ? 'active' : ''}`}
        />
        <span>{STATE_LABELS[connectionState] ?? connectionState}</span>
      </div>

      {/* ── Host / Join buttons (shown when idle) ────────────────── */}
      {connectionState === CONNECTION_STATES.IDLE ||
      connectionState === CONNECTION_STATES.DISCONNECTED ||
      connectionState === CONNECTION_STATES.ERROR ? (
        <div className="multiplayer-actions">
          <button
            type="button"
            className="multiplayer-btn host-btn"
            onClick={() => onHostRoom(multiplayerMode)}
            disabled={!activeRom}
          >
            🎮 Host Room
          </button>

          <div className="multiplayer-join-row">
            <input
              type="text"
              className="join-code-input"
              placeholder="Enter room code"
              maxLength={6}
              value={joinCode}
              onChange={(event) =>
                setJoinCode(event.target.value.toUpperCase())
              }
            />
            <button
              type="button"
              className="multiplayer-btn join-btn"
              onClick={() => onJoinRoom(joinCode, multiplayerMode)}
              disabled={!joinCode.trim() || !activeRom}
            >
              Join
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Room code display (shown when hosting) ───────────────── */}
      {isHost && roomCode && isActive ? (
        <div className="room-code-card" onClick={handleCopyCode}>
          <span className="utility-label">Room Code</span>
          <strong className="room-code-value">{roomCode}</strong>
          <span className="room-code-hint">
            {copied ? '✓ Copied!' : 'Click to copy'}
          </span>
        </div>
      ) : null}

      {/* ── Send save file (GB/GBC dual emulation — client side) ── */}
      {multiplayerMode === MULTIPLAYER_MODES.DUAL_EMULATION &&
      !isHost &&
      isConnected ? (
        <div className="multiplayer-save-section">
          <div className="utility-card">
            <span className="utility-label">Your Save File</span>
            <strong>
              Send your .sav file to the host so they can load both games
              side‑by‑side.
            </strong>
          </div>
          <button
            type="button"
            className="multiplayer-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            📁 Send Save File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".sav,.srm"
            style={{ display: 'none' }}
            onChange={handleSaveFileSelect}
          />
        </div>
      ) : null}

      {/* ── Disconnect ───────────────────────────────────────────── */}
      {isActive ? (
        <button
          type="button"
          className="multiplayer-btn disconnect-btn"
          onClick={onDisconnect}
        >
          ✕ Disconnect
        </button>
      ) : null}

      {/* ── Tips ─────────────────────────────────────────────────── */}
      {connectionState === CONNECTION_STATES.IDLE ? (
        <div className="dock-tip">
          {multiplayerMode === MULTIPLAYER_MODES.DUAL_EMULATION
            ? 'Host runs both Game Boys locally. Client streams video + sends inputs. Perfect for Pokémon trading & battling!'
            : multiplayerMode === MULTIPLAYER_MODES.WIRELESS_ADAPTER
              ? 'Both players run their own emulator. Uses the GBA Wireless Adapter to connect via the Union Room.'
              : 'Both players share the same game state. Player 2 controls the second controller.'}
        </div>
      ) : null}
    </div>
  );
}
