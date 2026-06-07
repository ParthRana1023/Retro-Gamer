import { supabase } from './supabase';

/**
 * Multiplayer architecture types used to determine connection behaviour.
 *
 *  STANDARD_NETPLAY  – NES / SNES / Genesis / Arcade (shared‑state rollback)
 *  DUAL_EMULATION    – GB / GBC link‑cable via tgbdual (host runs both slots)
 *  WIRELESS_ADAPTER  – GBA via gpSP emulated Wireless Adapter
 */
export const MULTIPLAYER_MODES = {
  STANDARD_NETPLAY: 'standard_netplay',
  DUAL_EMULATION: 'dual_emulation',
  WIRELESS_ADAPTER: 'wireless_adapter',
};

/** Map a console name to the multiplayer architecture it should use. */
export const getMultiplayerMode = (consoleName) => {
  switch (consoleName) {
    case 'GB':
    case 'GBC':
      return MULTIPLAYER_MODES.DUAL_EMULATION;
    case 'GBA':
      return MULTIPLAYER_MODES.WIRELESS_ADAPTER;
    case 'NES':
    case 'SNES':
    case 'Genesis':
      return MULTIPLAYER_MODES.STANDARD_NETPLAY;
    default:
      return null;
  }
};

// ── Room code helpers ─────────────────────────────────────────────────────────

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generateRoomCode = (length = 6) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map((byte) => ROOM_CODE_CHARS[byte % ROOM_CODE_CHARS.length])
    .join('');
};

// ── ICE / STUN / TURN config (public STUN only for now) ──────────────────────

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// ── Connection states ────────────────────────────────────────────────────────

export const CONNECTION_STATES = {
  IDLE: 'idle',
  CREATING_ROOM: 'creating_room',
  WAITING_FOR_PEER: 'waiting_for_peer',
  JOINING_ROOM: 'joining_room',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  STREAMING: 'streaming',
  TRANSFERRING_SAVE: 'transferring_save',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
};

// ── WebRTC Manager ───────────────────────────────────────────────────────────

export class WebRTCManager {
  constructor() {
    this.peer = null;
    this.dataChannel = null;
    this.videoSender = null;
    this.roomCode = null;
    this.isHost = false;
    this.multiplayerMode = null;
    this.state = CONNECTION_STATES.IDLE;
    this.supabaseChannel = null;

    /** @type {((state: string, detail?: any) => void) | null} */
    this.onStateChange = null;
    /** @type {((data: any) => void) | null} */
    this.onDataMessage = null;
    /** @type {((stream: MediaStream) => void) | null} */
    this.onRemoteStream = null;
    /** @type {((saveData: ArrayBuffer) => void) | null} */
    this.onSaveReceived = null;

    this._pendingIceCandidates = [];
    this._saveChunks = [];
    this._expectedSaveSize = 0;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Host a new room. Returns the room code. */
  async hostRoom(multiplayerMode) {
    this._cleanup();
    this.isHost = true;
    this.multiplayerMode = multiplayerMode;
    this._setState(CONNECTION_STATES.CREATING_ROOM);

    this.roomCode = generateRoomCode();
    this._createPeer();
    this._createDataChannel();

    // Subscribe to Supabase Realtime for signaling on this room.
    this.supabaseChannel = supabase.channel(`room:${this.roomCode}`, {
      config: { broadcast: { self: false } },
    });

    this.supabaseChannel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        this._handleSignal(payload);
      })
      .subscribe();

    this._setState(CONNECTION_STATES.WAITING_FOR_PEER);
    return this.roomCode;
  }

  /** Join an existing room using a code. */
  async joinRoom(roomCode, multiplayerMode) {
    this._cleanup();
    this.isHost = false;
    this.multiplayerMode = multiplayerMode;
    this.roomCode = roomCode.toUpperCase().trim();
    this._setState(CONNECTION_STATES.JOINING_ROOM);

    this._createPeer();

    // The client listens for datachannel creation from host.
    this.peer.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this._setupDataChannel();
    };

    // Subscribe to the same Supabase channel.
    this.supabaseChannel = supabase.channel(`room:${this.roomCode}`, {
      config: { broadcast: { self: false } },
    });

    this.supabaseChannel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        this._handleSignal(payload);
      })
      .subscribe(async () => {
        // Create an SDP offer and send it to the host.
        const offer = await this.peer.createOffer();
        await this.peer.setLocalDescription(offer);
        this._sendSignal({ type: 'offer', sdp: offer.sdp });
        this._setState(CONNECTION_STATES.CONNECTING);
      });
  }

  /** Send a save file (ArrayBuffer) to the peer over the data channel. */
  sendSaveFile(saveBuffer) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return false;
    }

    // Send header so the peer knows total size.
    const headerMsg = JSON.stringify({
      type: 'save_header',
      size: saveBuffer.byteLength,
    });
    this.dataChannel.send(headerMsg);

    // Send in 16 KiB chunks.
    const CHUNK_SIZE = 16384;
    for (let offset = 0; offset < saveBuffer.byteLength; offset += CHUNK_SIZE) {
      const chunk = saveBuffer.slice(offset, offset + CHUNK_SIZE);
      this.dataChannel.send(chunk);
    }

    // Send footer.
    this.dataChannel.send(JSON.stringify({ type: 'save_complete' }));
    return true;
  }

  /** Send an input snapshot to the peer (for Remote Control in dual‑emulation). */
  sendInput(inputSnapshot) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return;
    }

    this.dataChannel.send(
      JSON.stringify({ type: 'input', snapshot: inputSnapshot }),
    );
  }

  /** Attach a canvas stream to be sent to the peer (Host → Client video). */
  streamCanvas(canvas, fps = 30) {
    if (!this.peer || !this.isHost) {
      return;
    }

    const stream = canvas.captureStream(fps);
    stream.getTracks().forEach((track) => {
      this.videoSender = this.peer.addTrack(track, stream);
    });

    this._setState(CONNECTION_STATES.STREAMING);
  }

  /** Disconnect and clean up everything. */
  disconnect() {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'peer_disconnected' }));
      } catch {
        // best-effort
      }
    }

    this._cleanup();
    this._setState(CONNECTION_STATES.DISCONNECTED);
  }

  getState() {
    return this.state;
  }

  getRoomCode() {
    return this.roomCode;
  }

  getIsHost() {
    return this.isHost;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  _setState(nextState, detail) {
    this.state = nextState;
    this.onStateChange?.(nextState, detail);
  }

  _createPeer() {
    this.peer = new RTCPeerConnection(RTC_CONFIG);

    this.peer.onicecandidate = (event) => {
      if (event.candidate) {
        this._sendSignal({
          type: 'ice_candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    this.peer.onconnectionstatechange = () => {
      const peerState = this.peer?.connectionState;

      if (peerState === 'connected') {
        this._setState(CONNECTION_STATES.CONNECTED);
      } else if (peerState === 'failed' || peerState === 'closed') {
        this._setState(CONNECTION_STATES.DISCONNECTED);
      }
    };

    this.peer.ontrack = (event) => {
      if (event.streams?.[0]) {
        this.onRemoteStream?.(event.streams[0]);
      }
    };
  }

  _createDataChannel() {
    this.dataChannel = this.peer.createDataChannel('retrogamer', {
      ordered: true,
    });
    this.dataChannel.binaryType = 'arraybuffer';
    this._setupDataChannel();
  }

  _setupDataChannel() {
    if (!this.dataChannel) {
      return;
    }

    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = () => {
      this._setState(CONNECTION_STATES.CONNECTED);
    };

    this.dataChannel.onclose = () => {
      this._setState(CONNECTION_STATES.DISCONNECTED);
    };

    this.dataChannel.onmessage = (event) => {
      // Binary data → save file chunk.
      if (event.data instanceof ArrayBuffer) {
        this._saveChunks.push(event.data);

        const receivedSize = this._saveChunks.reduce(
          (sum, chunk) => sum + chunk.byteLength,
          0,
        );

        // Report progress.
        this._setState(CONNECTION_STATES.TRANSFERRING_SAVE, {
          received: receivedSize,
          total: this._expectedSaveSize,
        });
        return;
      }

      // String data → JSON control message.
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'save_header':
            this._saveChunks = [];
            this._expectedSaveSize = msg.size;
            this._setState(CONNECTION_STATES.TRANSFERRING_SAVE, {
              received: 0,
              total: msg.size,
            });
            break;

          case 'save_complete': {
            const totalSize = this._saveChunks.reduce(
              (sum, chunk) => sum + chunk.byteLength,
              0,
            );
            const merged = new Uint8Array(totalSize);
            let offset = 0;
            for (const chunk of this._saveChunks) {
              merged.set(new Uint8Array(chunk), offset);
              offset += chunk.byteLength;
            }

            this._saveChunks = [];
            this._expectedSaveSize = 0;
            this.onSaveReceived?.(merged.buffer);
            this._setState(CONNECTION_STATES.CONNECTED);
            break;
          }

          case 'input':
            this.onDataMessage?.(msg);
            break;

          case 'peer_disconnected':
            this._setState(CONNECTION_STATES.DISCONNECTED);
            break;

          default:
            this.onDataMessage?.(msg);
            break;
        }
      } catch {
        // Non-JSON text → ignore.
      }
    };
  }

  _sendSignal(payload) {
    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'signal',
      payload: { ...payload, from: this.isHost ? 'host' : 'client' },
    });
  }

  async _handleSignal(payload) {
    if (!this.peer) {
      return;
    }

    // Ignore messages from ourselves.
    if (
      (this.isHost && payload.from === 'host') ||
      (!this.isHost && payload.from === 'client')
    ) {
      return;
    }

    try {
      if (payload.type === 'offer' && this.isHost) {
        await this.peer.setRemoteDescription(
          new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }),
        );

        // Flush any queued ICE candidates.
        for (const candidate of this._pendingIceCandidates) {
          await this.peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
        this._pendingIceCandidates = [];

        const answer = await this.peer.createAnswer();
        await this.peer.setLocalDescription(answer);
        this._sendSignal({ type: 'answer', sdp: answer.sdp });
      }

      if (payload.type === 'answer' && !this.isHost) {
        await this.peer.setRemoteDescription(
          new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }),
        );

        for (const candidate of this._pendingIceCandidates) {
          await this.peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
        this._pendingIceCandidates = [];
      }

      if (payload.type === 'ice_candidate') {
        if (this.peer.remoteDescription) {
          await this.peer.addIceCandidate(
            new RTCIceCandidate(payload.candidate),
          );
        } else {
          this._pendingIceCandidates.push(payload.candidate);
        }
      }
    } catch (error) {
      this._setState(CONNECTION_STATES.ERROR, { error: error.message });
    }
  }

  _cleanup() {
    if (this.supabaseChannel) {
      supabase.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
    }

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {
        // already closed
      }
      this.dataChannel = null;
    }

    if (this.peer) {
      try {
        this.peer.close();
      } catch {
        // already closed
      }
      this.peer = null;
    }

    this.videoSender = null;
    this._pendingIceCandidates = [];
    this._saveChunks = [];
    this._expectedSaveSize = 0;
  }
}
