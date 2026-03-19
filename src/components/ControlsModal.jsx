import { useEffect } from 'react';
import {
  DEFAULT_KEY_BINDINGS,
  getBindingLabel,
} from '../services/controllerManager';

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
  consoleName,
  buttons,
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
            <h2 id="controls-modal-title">{consoleName} keyboard mapping</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-copy">
          <strong>
            {pendingBinding
              ? `Press a new key for ${getBindingLabel(consoleName, pendingBinding)}.`
              : 'Click any control tile to rebind it.'}
          </strong>
          <span>This editor only shows the controls used by the current console.</span>
        </div>

        <div className="modal-key-grid">
          {buttons.map((button) => (
            <button
              key={button}
              type="button"
              className={`key-binding modal-key-binding ${pendingBinding === button ? 'listening' : ''}`}
              onClick={() => onBeginRebind(button)}
            >
              <span>{getBindingLabel(consoleName, button)}</span>
              <strong>{prettifyKeyCode(keyBindings[button] ?? DEFAULT_KEY_BINDINGS[button])}</strong>
            </button>
          ))}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onResetBindings}>
            Reset this console
          </button>
          <button type="button" className="ghost-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
