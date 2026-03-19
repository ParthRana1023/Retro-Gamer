import { Nostalgist } from 'nostalgist';

const EXTENSION_MAP = {
  '.nes': { core: 'fceumm', consoleName: 'NES' },
  '.sfc': { core: 'snes9x', consoleName: 'SNES' },
  '.smc': { core: 'snes9x', consoleName: 'SNES' },
  '.gb': { core: 'mgba', consoleName: 'GB', sramType: 'sav' },
  '.gbc': { core: 'mgba', consoleName: 'GBC', sramType: 'sav' },
  '.gba': { core: 'mgba', consoleName: 'GBA', sramType: 'sav' },
  '.md': { core: 'genesis_plus_gx', consoleName: 'Genesis', sramType: 'srm' },
  '.gen': { core: 'genesis_plus_gx', consoleName: 'Genesis', sramType: 'srm' },
  '.bin': { core: 'genesis_plus_gx', consoleName: 'Genesis', sramType: 'srm' },
  '.nds': { core: null, consoleName: 'NDS', experimental: true },
};

const BUTTON_NAMES = ['up', 'down', 'left', 'right', 'start', 'select', 'a', 'b', 'x', 'y', 'l', 'r'];

const getExtension = (name = '') => {
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index).toLowerCase() : '';
};

const volumeToDb = (volume) => {
  if (volume <= 0) {
    return -80;
  }

  return Math.round((volume / 100) * 24 - 24);
};

const clampVolume = (volume) => Math.max(0, Math.min(100, Number(volume) || 0));
const volumeToStep = (volume) => Math.round(clampVolume(volume) / 5);

export const detectConsoleProfile = (name = '') => {
  return EXTENSION_MAP[getExtension(name)] ?? { core: null, consoleName: 'Unknown' };
};

export class EmulatorCore {
  constructor() {
    this.canvas = null;
    this.instance = null;
    this.session = null;
    this.inputSnapshot = {};
  }

  mountCanvas(canvas) {
    this.canvas = canvas;
  }

  async loadRom(file, options = {}) {
    if (!this.canvas) {
      throw new Error('Emulator canvas is not ready yet.');
    }

    const profile = detectConsoleProfile(file?.name);

    if (profile.experimental) {
      throw new Error('Nintendo DS is still marked experimental in this build.');
    }

    if (!profile.core) {
      throw new Error(`Unsupported ROM format for "${file?.name ?? 'unknown file'}".`);
    }

    this.exit();

    const instance = await Nostalgist.launch({
      core: profile.core,
      rom: file,
      element: this.canvas,
      state: options.state ?? undefined,
      sram: options.sram ?? undefined,
      sramType: profile.sramType,
      cache: {
        rom: false,
      },
      respondToGlobalEvents: false,
      retroarchConfig: {
        audio_enable: true,
        audio_mute_enable: options.volume === 0,
        audio_volume: volumeToDb(options.volume ?? 75),
        menu_mouse_enable: false,
        savestate_thumbnail_enable: true,
      },
    });

    this.instance = instance;
    this.session = {
      file,
      name: file.name,
      size: file.size,
      consoleName: profile.consoleName,
      core: profile.core,
      sramType: profile.sramType,
      loadedAt: Date.now(),
      isExperimental: false,
      isPaused: false,
      isFastForwarding: false,
      lastInputSnapshot: {},
      volume: clampVolume(options.volume ?? 75),
    };

    return this.session;
  }

  async reloadWithSettings(options = {}) {
    if (!this.session) {
      return null;
    }

    const currentFile = this.session.file;
    return this.loadRom(currentFile, {
      state: options.state,
      sram: options.sram,
      volume: options.volume ?? this.session.volume,
    });
  }

  setInputState(snapshot = {}) {
    this.inputSnapshot = snapshot;

    if (!this.instance) {
      return;
    }

    BUTTON_NAMES.forEach((button) => {
      const isPressed = Boolean(snapshot[button]);
      const wasPressed = Boolean(this.session?.lastInputSnapshot?.[button]);

      if (isPressed && !wasPressed) {
        this.instance.pressDown(button);
      } else if (!isPressed && wasPressed) {
        this.instance.pressUp(button);
      }
    });

    if (this.session) {
      this.session.lastInputSnapshot = snapshot;
    }
  }

  async captureState() {
    if (!this.instance || !this.session) {
      return null;
    }

    const { state, thumbnail } = await this.instance.saveState();

    return {
      romName: this.session.name,
      consoleName: this.session.consoleName,
      timestamp: Date.now(),
      state,
      thumbnail,
    };
  }

  async captureSRAM() {
    if (!this.instance) {
      return null;
    }

    return this.instance.saveSRAM();
  }

  async restoreState(savedState) {
    if (!this.instance || !savedState?.state) {
      return false;
    }

    await this.instance.loadState(savedState.state);
    return true;
  }

  togglePause() {
    if (!this.instance || !this.session) {
      return false;
    }

    if (this.session.isPaused) {
      this.instance.resume();
      this.session.isPaused = false;
    } else {
      this.instance.pause();
      this.session.isPaused = true;
    }

    return this.session.isPaused;
  }

  toggleFastForward() {
    if (!this.instance || !this.session) {
      return false;
    }

    this.instance.sendCommand('FAST_FORWARD');
    this.session.isFastForwarding = !this.session.isFastForwarding;
    return this.session.isFastForwarding;
  }

  setVolume(nextVolume) {
    const targetVolume = clampVolume(nextVolume);

    if (!this.session) {
      return false;
    }

    const currentVolume = clampVolume(this.session.volume ?? 75);

    if (!this.instance || currentVolume === targetVolume) {
      this.session.volume = targetVolume;
      return Boolean(this.instance);
    }

    const currentStep = volumeToStep(currentVolume);
    const targetStep = volumeToStep(targetVolume);
    const command = targetStep > currentStep ? 'VOLUME_UP' : 'VOLUME_DOWN';

    for (let index = 0; index < Math.abs(targetStep - currentStep); index += 1) {
      this.instance.sendCommand(command);
    }

    this.session.volume = targetVolume;
    return true;
  }

  getSession() {
    return this.session;
  }

  getStatus() {
    return this.instance?.getStatus?.() ?? 'idle';
  }

  exit() {
    if (this.instance) {
      this.instance.exit({ removeCanvas: false });
    }

    this.instance = null;
    this.session = null;
    this.inputSnapshot = {};
  }
}
