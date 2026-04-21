import { config, V2_READ_LAYER_STORAGE_KEY } from '@/shared/config/constants';

export function V2ReadLayerToggle() {
  const enabled = config.devnet.useV2ReadLayer;

  const handleClick = () => {
    try {
      window.localStorage.setItem(V2_READ_LAYER_STORAGE_KEY, enabled ? 'false' : 'true');
    } catch {
      // localStorage write failed — reload will fall back to env.
    }
    window.location.reload();
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      window.localStorage.removeItem(V2_READ_LAYER_STORAGE_KEY);
    } catch {
      // ignore
    }
    window.location.reload();
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 9999,
        background: 'rgba(17, 17, 17, 0.9)',
        border: '1px solid #333',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 11,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: '#eee',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span>v2 reads:</span>
      <button
        onClick={handleClick}
        style={{
          background: enabled ? '#2b8a3e' : '#555',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '2px 8px',
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: 'inherit',
        }}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>
      <button
        onClick={handleReset}
        title="Clear override, use VITE_USE_V2_READ_LAYER"
        style={{
          background: 'transparent',
          color: '#888',
          border: '1px solid #444',
          borderRadius: 4,
          padding: '2px 6px',
          cursor: 'pointer',
          fontSize: 10,
          fontFamily: 'inherit',
        }}
      >
        reset
      </button>
    </div>
  );
}
