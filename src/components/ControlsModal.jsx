import { useEffect } from 'react';
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

export function ControlsModal({
  isOpen,
  keyBindings,
  pendingBinding,
  onClose,
  onBeginRebind,
  onResetBindings,
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="controls-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="controls-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Controls</p>
            <h2 id="controls-modal-title">Keyboard mapping</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-copy">
          <strong>
            {pendingBinding
              ? `Press a new key for ${LABELS[pendingBinding]}.`
              : 'Click any control tile to rebind it.'}
          </strong>
          <span>Changes apply immediately and are saved in your browser.</span>
        </div>

        <div className="modal-key-grid">
          {BUTTON_NAMES.map((button) => (
            <button
              key={button}
              type="button"
              className={`key-binding modal-key-binding ${pendingBinding === button ? 'listening' : ''}`}
              onClick={() => onBeginRebind(button)}
            >
              <span>{LABELS[button]}</span>
              <strong>{prettifyKeyCode(keyBindings[button] ?? DEFAULT_KEY_BINDINGS[button])}</strong>
            </button>
          ))}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onResetBindings}>
            Reset defaults
          </button>
          <button type="button" className="ghost-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
