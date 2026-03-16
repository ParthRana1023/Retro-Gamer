import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVE_TYPES, StorageManager } from '../storageManager';

const upsert = vi.fn(() => Promise.resolve({ data: null, error: null }));
const maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
const eqLevel4 = vi.fn(() => ({ maybeSingle }));
const eqLevel3 = vi.fn(() => ({ eq: eqLevel4 }));
const eqLevel2 = vi.fn(() => ({ eq: eqLevel3 }));
const eqLevel1 = vi.fn(() => ({ eq: eqLevel2 }));
const deleteEqLevel4 = vi.fn(() => Promise.resolve({ error: null }));
const deleteEqLevel3 = vi.fn(() => ({ eq: deleteEqLevel4 }));
const deleteEqLevel2 = vi.fn(() => ({ eq: deleteEqLevel3 }));
const deleteEqLevel1 = vi.fn(() => ({ eq: deleteEqLevel2 }));

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert,
      delete: vi.fn(() => ({
        eq: deleteEqLevel1,
      })),
      select: vi.fn(() => ({
        eq: eqLevel1,
      })),
    })),
  },
}));

describe('StorageManager', () => {
  let storage;
  let records;

  beforeEach(() => {
    records = new Map();
    storage = new StorageManager();
    storage.db = {
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          put: vi.fn((record) => {
            records.set(record.id, record);
            return {
              set onerror(_) {},
              set onsuccess(handler) {
                handler();
              },
            };
          }),
          get: vi.fn((id) => ({
            set onerror(_) {},
            set onsuccess(handler) {
              this.result = records.get(id) ?? null;
              handler.call(this);
            },
          })),
          getAll: vi.fn(() => ({
            set onerror(_) {},
            set onsuccess(handler) {
              this.result = Array.from(records.values());
              handler.call(this);
            },
          })),
          delete: vi.fn((id) => {
            records.delete(id);
            return {
              set onerror(_) {},
              set onsuccess(handler) {
                handler();
              },
            };
          }),
        })),
      })),
    };
    storage.init = vi.fn(() => Promise.resolve(storage.db));
    storage.setAuthSession(null);
    vi.clearAllMocks();
  });

  it('initializes with null db and false auth', () => {
    const freshStorage = new StorageManager();
    expect(freshStorage.db).toBeNull();
    expect(freshStorage.isAuthenticated).toBe(false);
  });

  it('saves and loads a local save state record', async () => {
    await storage.saveState('test-rom', { score: 100 }, { slot: 'autosave' });
    const loaded = await storage.load('test-rom', { slot: 'autosave', type: SAVE_TYPES.STATE });

    expect(loaded).toMatchObject({
      romId: 'test-rom',
      slot: 'autosave',
      type: SAVE_TYPES.STATE,
      data: { score: 100 },
    });
  });

  it('supports SRAM helpers', async () => {
    await storage.saveSRAM('zelda', { battery: true });
    const loaded = await storage.loadSRAM('zelda');

    expect(loaded).toEqual({ battery: true });
  });

  it('serializes and restores blob data for save states', async () => {
    const stateBlob = {
      type: 'application/octet-stream',
      arrayBuffer: async () => new TextEncoder().encode('retro-state').buffer,
    };

    await storage.saveState('blob-rom', { state: stateBlob }, { slot: 'autosave' });
    const loaded = await storage.loadState('blob-rom');

    expect(loaded.state).toBeInstanceOf(Blob);
    expect(loaded.state.type).toBe('application/octet-stream');
  });

  it('lists newest saves first', async () => {
    await storage.saveState('test-rom', { slot: 1 }, { slot: 'slot-1', updatedAt: 10 });
    await storage.saveState('test-rom', { slot: 2 }, { slot: 'slot-2', updatedAt: 20 });

    const listed = await storage.listStates('test-rom');

    expect(listed.map((entry) => entry.slot)).toEqual(['slot-2', 'slot-1']);
  });

  it('uses cloud storage when authenticated', async () => {
    storage.setAuthSession({ id: 'user-123' });
    await storage.saveState('cloud-rom', { score: 42 });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-123::cloud-rom::state::autosave',
        user_id: 'user-123',
        rom_id: 'cloud-rom',
      }),
      { onConflict: 'user_id,rom_id,slot,save_type' },
    );
  });

  it('deletes a state locally', async () => {
    await storage.saveState('test-rom', { score: 100 }, { slot: 'autosave' });
    await storage.deleteState('test-rom', 'autosave');
    const loaded = await storage.loadState('test-rom');

    expect(loaded).toBeNull();
  });
});
