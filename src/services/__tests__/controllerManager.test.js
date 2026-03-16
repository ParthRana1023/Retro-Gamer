import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ControllerManager, DEFAULT_KEY_BINDINGS } from '../controllerManager';

describe('ControllerManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ControllerManager();
    vi.stubGlobal('navigator', {
      getGamepads: () => [],
    });
  });

  it('maps the default keyboard binding for up', () => {
    const mapped = manager.mapKeyboardToController({ code: DEFAULT_KEY_BINDINGS.up, type: 'keydown' });
    expect(mapped).toEqual({
      button: 'up',
      code: DEFAULT_KEY_BINDINGS.up,
      pressed: true,
      source: 'keyboard',
    });
  });

  it('maps the default keyboard binding for a', () => {
    const mapped = manager.mapKeyboardToController({ code: DEFAULT_KEY_BINDINGS.a, type: 'keydown' });
    expect(mapped).toEqual({
      button: 'a',
      code: DEFAULT_KEY_BINDINGS.a,
      pressed: true,
      source: 'keyboard',
    });
  });

  it('supports custom keyboard bindings', () => {
    manager.setKeyboardBindings({ up: 'ArrowUp' });
    const mapped = manager.mapKeyboardToController({ code: 'ArrowUp', type: 'keydown' });

    expect(mapped?.button).toBe('up');
  });

  it('returns null for unmapped keys', () => {
    const mapped = manager.mapKeyboardToController({ code: 'KeyP', type: 'keydown' });
    expect(mapped).toBeNull();
  });

  it('tracks keyboard state on keydown and keyup', () => {
    manager.handleKeyboard({ code: DEFAULT_KEY_BINDINGS.up, type: 'keydown', preventDefault: vi.fn() });
    expect(manager.keyboardState.up).toBe(true);

    manager.handleKeyboard({ code: DEFAULT_KEY_BINDINGS.up, type: 'keyup', preventDefault: vi.fn() });
    expect(manager.keyboardState.up).toBe(false);
  });

  it('adds and removes listeners', () => {
    const callback = vi.fn();
    manager.addListener(callback);
    expect(manager.listeners.has(callback)).toBe(true);

    manager.removeListener(callback);
    expect(manager.listeners.has(callback)).toBe(false);
  });

  it('maps gamepad buttons and stick axes', () => {
    const state = manager.mapGamepadToController({
      id: 'pad',
      index: 0,
      axes: [-1, 1],
      buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: index === 0 })),
    });

    expect(state.buttons.a).toBe(true);
    expect(state.buttons.left).toBe(true);
    expect(state.buttons.down).toBe(true);
  });

  it('combines keyboard and gamepad snapshots', () => {
    manager.keyboardState.a = true;
    manager.activeGamepads = [
      {
        buttons: {
          up: true,
          down: false,
          left: false,
          right: false,
          start: false,
          select: false,
          a: false,
          b: false,
          x: false,
          y: false,
          l: false,
          r: false,
        },
      },
    ];

    expect(manager.getSnapshot()).toMatchObject({ a: true, up: true });
  });
});
