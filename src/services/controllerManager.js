export const DEFAULT_KEY_BINDINGS = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  start: 'Enter',
  select: 'Backspace',
  a: 'KeyK',
  b: 'KeyL',
  x: 'KeyJ',
  y: 'KeyI',
  l: 'KeyQ',
  r: 'KeyE',
};

const GAMEPAD_BUTTON_MAP = {
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
  9: 'start',
  8: 'select',
  0: 'a',
  1: 'b',
  2: 'x',
  3: 'y',
  4: 'l',
  5: 'r',
};

export const BUTTON_NAMES = ['up', 'down', 'left', 'right', 'start', 'select', 'a', 'b', 'x', 'y', 'l', 'r'];

const createButtonState = () =>
  BUTTON_NAMES.reduce((state, button) => {
    state[button] = false;
    return state;
  }, {});

const invertBindings = (bindings) =>
  Object.entries(bindings).reduce((map, [button, code]) => {
    map[code] = button;
    return map;
  }, {});

const FALLBACK_KEY_MAP = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

const normalizeEventKey = (event) => {
  if (event.code) {
    return event.code;
  }

  if (!event.key) {
    return '';
  }

  if (event.key.length === 1) {
    return `Key${event.key.toUpperCase()}`;
  }

  return event.key;
};

const isEditableElement = (target) => {
  if (!target || typeof target !== 'object') {
    return false;
  }

  if (target instanceof HTMLElement) {
    if (target.isContentEditable) {
      return true;
    }

    const tagName = target.tagName?.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  }

  return false;
};

export class ControllerManager {
  constructor(keyBindings = DEFAULT_KEY_BINDINGS) {
    this.activeGamepads = [];
    this.keyboardState = createButtonState();
    this.listeners = new Set();
    this.isListening = false;
    this.pollFrame = null;
    this.keyBindings = { ...DEFAULT_KEY_BINDINGS, ...keyBindings };
    this.keyMap = invertBindings(this.keyBindings);
    this.lastSnapshot = this.getSnapshot();
    this.boundKeyHandler = this.handleKeyboard.bind(this);
    this.boundGamepadLoop = this.gamepadLoop.bind(this);
    this.boundFocusHandler = this.handleFocusChange.bind(this);
  }

  setKeyboardBindings(bindings) {
    this.keyBindings = { ...DEFAULT_KEY_BINDINGS, ...bindings };
    this.keyMap = invertBindings(this.keyBindings);
  }

  getKeyboardBindings() {
    return { ...this.keyBindings };
  }

  resetKeyboardBindings() {
    this.setKeyboardBindings(DEFAULT_KEY_BINDINGS);
  }

  mapKeyboardToController(event) {
    const normalizedKey = normalizeEventKey(event);
    const button = this.keyMap[normalizedKey] ?? FALLBACK_KEY_MAP[normalizedKey];

    if (!button) {
      return null;
    }

    return {
      button,
      pressed: event.type === 'keydown',
      source: 'keyboard',
      code: normalizedKey,
    };
  }

  mapGamepadToController(gamepad) {
    const nextState = createButtonState();

    gamepad.buttons.forEach((button, index) => {
      const name = GAMEPAD_BUTTON_MAP[index];
      if (name) {
        nextState[name] = button.pressed;
      }
    });

    const [xAxis = 0, yAxis = 0] = gamepad.axes ?? [];
    const threshold = 0.5;
    nextState.left = nextState.left || xAxis <= -threshold;
    nextState.right = nextState.right || xAxis >= threshold;
    nextState.up = nextState.up || yAxis <= -threshold;
    nextState.down = nextState.down || yAxis >= threshold;

    return {
      id: gamepad.id,
      index: gamepad.index,
      buttons: nextState,
      axes: gamepad.axes ?? [],
      source: 'gamepad',
    };
  }

  pollGamepads() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const states = [];

    for (let i = 0; i < gamepads.length; i += 1) {
      const gamepad = gamepads[i];
      if (!gamepad) {
        continue;
      }

      states.push(this.mapGamepadToController(gamepad));
    }

    this.activeGamepads = states;
    return states;
  }

  addListener(callback) {
    this.listeners.add(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  notifyListeners(input) {
    this.listeners.forEach((callback) => callback(input));
  }

  getSnapshot() {
    const primaryGamepad = this.activeGamepads[0]?.buttons ?? createButtonState();
    const combined = createButtonState();

    BUTTON_NAMES.forEach((button) => {
      combined[button] = Boolean(this.keyboardState[button] || primaryGamepad[button]);
    });

    return combined;
  }

  clearKeyboardState() {
    this.keyboardState = createButtonState();
    const snapshot = this.getSnapshot();
    this.lastSnapshot = snapshot;
    this.notifyListeners({
      source: 'keyboard',
      cleared: true,
      snapshot,
    });
  }

  handleKeyboard(event) {
    if (isEditableElement(event.target)) {
      return;
    }

    const mapped = this.mapKeyboardToController(event);

    if (!mapped) {
      return;
    }

    event.preventDefault();
    if (typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    this.keyboardState[mapped.button] = mapped.pressed;
    const snapshot = this.getSnapshot();
    this.lastSnapshot = snapshot;

    this.notifyListeners({
      ...mapped,
      snapshot,
    });
  }

  handleFocusChange(event) {
    if (!isEditableElement(event.target)) {
      return;
    }

    this.clearKeyboardState();
  }

  gamepadLoop() {
    const previousSnapshot = JSON.stringify(this.lastSnapshot);
    this.pollGamepads();
    const snapshot = this.getSnapshot();

    if (JSON.stringify(snapshot) !== previousSnapshot) {
      this.lastSnapshot = snapshot;
      this.notifyListeners({
        source: 'gamepad',
        snapshot,
      });
    }

    if (this.isListening) {
      this.pollFrame = window.requestAnimationFrame(this.boundGamepadLoop);
    }
  }

  startListening() {
    if (this.isListening || typeof window === 'undefined') {
      return;
    }

    this.isListening = true;
    window.addEventListener('keydown', this.boundKeyHandler, true);
    window.addEventListener('keyup', this.boundKeyHandler, true);
    window.addEventListener('focusin', this.boundFocusHandler, true);
    this.gamepadLoop();
  }

  stopListening() {
    if (!this.isListening || typeof window === 'undefined') {
      return;
    }

    this.isListening = false;
    window.removeEventListener('keydown', this.boundKeyHandler, true);
    window.removeEventListener('keyup', this.boundKeyHandler, true);
    window.removeEventListener('focusin', this.boundFocusHandler, true);
    this.clearKeyboardState();

    if (this.pollFrame) {
      window.cancelAnimationFrame(this.pollFrame);
      this.pollFrame = null;
    }
  }
}
