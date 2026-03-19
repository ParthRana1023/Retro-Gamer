import { useRef, useState } from 'react';

const formatFileSize = (size) => {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

export function Library({
  roms,
  activeRomId,
  onSelectRom,
  onLoadFiles,
}) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = (files) => {
    if (!files?.length) {
      return;
    }

    onLoadFiles(Array.from(files));
  };

  return (
    <section className="dock-panel library-panel">
      <div className="dock-header">
        <div>
          <p className="eyebrow">Library</p>
          <h2>ROM Vault</h2>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()}>
          Add ROM
        </button>
      </div>

      <label
        className={`dropzone compact-dropzone ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => handleFiles(event.target.files)}
        />
        <strong>Drop ROMs</strong>
        <span>Files stay local to this browser.</span>
      </label>

      <div className="library-scroll">
        <div className="library-list">
          {roms.length === 0 ? (
            <div className="empty-state compact-empty">
              <p>No ROMs loaded yet.</p>
              <span>Pick files or drag them into the import zone.</span>
            </div>
          ) : (
            roms.map((rom) => (
              <button
                type="button"
                key={rom.id}
                className={`library-item ${rom.id === activeRomId ? 'active' : ''}`}
                onClick={() => onSelectRom(rom.id)}
              >
                <span>{rom.name}</span>
                <small>{rom.consoleName} • {formatFileSize(rom.size)}</small>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
