import { BUTTON_NAMES, DEFAULT_KEY_BINDINGS } from '../services/controllerManager';

const LABELS = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  start: 'Start',
  select: 'Select',
  a: 'A',
  b: 'B',
  x: 'X',
  y: 'Y',
  l: 'L',
  r: 'R',
};

const prettifyKeyCode = (code) =>
  code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace('Arrow', 'Arrow ')
    .replace('Backspace', 'Backspace')
    .replace('Enter', 'Enter')
    .replace('ShiftRight', 'Right Shift');

export function ControlsPanel({
  keyBindings,
  pendingBinding,
  onBeginRebind,
  onResetBindings,
}) {
  return (
    <div className="dock-content controls-content">
      <div className="dock-section-header">
        <strong>Keyboard map</strong>
        <button type="button" onClick={onResetBindings}>
          Reset
        </button>
      </div>

      <div className="key-grid compact-key-grid">
        {BUTTON_NAMES.map((button) => (
          <button
            key={button}
            type="button"
            className={`key-binding ${pendingBinding === button ? 'listening' : ''}`}
            onClick={() => onBeginRebind(button)}
          >
            <span>{LABELS[button]}</span>
            <strong>{prettifyKeyCode(keyBindings[button] ?? DEFAULT_KEY_BINDINGS[button])}</strong>
          </button>
        ))}
      </div>

      <div className="dock-tip">
        {pendingBinding
          ? `Press a new key for ${LABELS[pendingBinding]}.`
          : 'Click any action to remap it.'}
      </div>
    </div>
  );
}
