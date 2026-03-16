import { supabase } from './supabase';

const DB_NAME = 'RetroGamerDB';
const DB_VERSION = 2;
const STORE_NAME = 'gameStates';

const hasIndexedDb = () => typeof indexedDB !== 'undefined';

export const SAVE_TYPES = {
  STATE: 'state',
  SRAM: 'sram',
};

const blobToBase64 = async (blob) => {
  const buffer = typeof blob.arrayBuffer === 'function'
    ? await blob.arrayBuffer()
    : await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(reader.result);
      reader.readAsArrayBuffer(blob);
    });
  const bytes = new Uint8Array(buffer);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
};

const base64ToBlob = (base64, type = 'application/octet-stream') => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type });
};

const serializeValue = async (value) => {
  if (
    value instanceof Blob ||
    (value && typeof value === 'object' && typeof value.arrayBuffer === 'function' && typeof value.type === 'string')
  ) {
    return {
      kind: 'blob',
      mimeType: value.type || 'application/octet-stream',
      data: await blobToBase64(value),
    };
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((entry) => serializeValue(entry)));
  }

  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, nestedValue]) => [key, await serializeValue(nestedValue)]),
    );

    return Object.fromEntries(entries);
  }

  return value;
};

const deserializeValue = (value) => {
  if (!value) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => deserializeValue(entry));
  }

  if (value.kind === 'blob' && value.data) {
    return base64ToBlob(value.data, value.mimeType);
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, deserializeValue(nestedValue)]),
    );
  }

  return value;
};

const isMissingCloudTableError = (error) => {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  return message.includes("could not find the table 'public.save_states'")
    || message.includes('relation "public.save_states" does not exist')
    || message.includes('relation "save_states" does not exist');
};

export class StorageManager {
  constructor() {
    this.db = null;
    this.isAuthenticated = false;
    this.authUserId = null;
    this.initPromise = null;
  }

  async init() {
    if (this.db) {
      return this.db;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    if (!hasIndexedDb()) {
      this.initPromise = Promise.resolve(null);
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('romId', 'romId', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          return;
        }

        const transaction = event.target.transaction;
        const store = transaction.objectStore(STORE_NAME);

        if (!store.indexNames.contains('romId')) {
          store.createIndex('romId', 'romId', { unique: false });
        }

        if (!store.indexNames.contains('updatedAt')) {
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  async saveState(romId, stateData, options = {}) {
    return this.save(romId, stateData, { ...options, type: SAVE_TYPES.STATE });
  }

  async loadState(romId, slot = 'autosave') {
    const record = await this.load(romId, { slot, type: SAVE_TYPES.STATE });
    return record?.data ?? null;
  }

  async saveSRAM(romId, sramData, options = {}) {
    return this.save(romId, sramData, { ...options, type: SAVE_TYPES.SRAM, slot: 'battery' });
  }

  async loadSRAM(romId) {
    const record = await this.load(romId, { slot: 'battery', type: SAVE_TYPES.SRAM });
    return record?.data ?? null;
  }

  async save(romId, data, options = {}) {
    const record = await this._createRecord(romId, data, options);

    if (this.isAuthenticated) {
      try {
        await this._saveToCloud(record);
      } catch (error) {
        if (!isMissingCloudTableError(error)) {
          throw error;
        }
      }
    }

    await this._saveToLocal(record);
    return record;
  }

  async load(romId, options = {}) {
    const slot = options.slot ?? 'autosave';
    const type = options.type ?? SAVE_TYPES.STATE;

    if (this.isAuthenticated) {
      try {
        const cloudRecord = await this._loadFromCloud(romId, slot, type);
        if (cloudRecord) {
          await this._saveToLocal(cloudRecord);
          return cloudRecord;
        }
      } catch (error) {
        if (!isMissingCloudTableError(error)) {
          throw error;
        }
      }
    }

    return this._loadFromLocal(romId, slot, type);
  }

  async listStates(romId) {
    const records = await this._getAllLocalRecords();
    return records
      .filter((record) => record.romId === romId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async deleteState(romId, slot = 'autosave', type = SAVE_TYPES.STATE) {
    await this.init();
    const id = this._buildId(romId, slot, type);

    if (this.db) {
      await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    }

    if (this.isAuthenticated) {
      try {
        await this._deleteFromCloud(romId, slot, type);
      } catch (error) {
        if (!isMissingCloudTableError(error)) {
          throw error;
        }
      }
    }
  }

  setAuthStatus(isAuthenticated, userId = null) {
    this.isAuthenticated = Boolean(isAuthenticated && userId);
    this.authUserId = this.isAuthenticated ? userId : null;
  }

  setAuthSession(user) {
    this.setAuthStatus(Boolean(user?.id), user?.id ?? null);
  }

  _buildId(romId, slot, type) {
    return `${romId}::${type}::${slot}`;
  }

  async _createRecord(romId, data, options) {
    const slot = options.slot ?? 'autosave';
    const type = options.type ?? SAVE_TYPES.STATE;
    const now = Date.now();

    return {
      id: this._buildId(romId, slot, type),
      romId,
      slot,
      type,
      data: await serializeValue(data),
      metadata: options.metadata ?? {},
      updatedAt: options.updatedAt ?? now,
      createdAt: options.createdAt ?? now,
    };
  }

  async _saveToLocal(record) {
    await this.init();

    if (!this.db) {
      return record;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(record);
    });
  }

  async _loadFromLocal(romId, slot = 'autosave', type = SAVE_TYPES.STATE) {
    await this.init();

    if (!this.db) {
      return null;
    }

    const id = this._buildId(romId, slot, type);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (!request.result) {
          resolve(null);
          return;
        }

        resolve({
          ...request.result,
          data: deserializeValue(request.result.data),
        });
      };
    });
  }

  async _getAllLocalRecords() {
    await this.init();

    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () =>
        resolve(
          (request.result ?? []).map((record) => ({
            ...record,
            data: deserializeValue(record.data),
          })),
        );
    });
  }

  async _saveToCloud(record) {
    if (!this.authUserId) {
      return record;
    }

    const payload = {
      id: `${this.authUserId}::${record.id}`,
      user_id: this.authUserId,
      rom_id: record.romId,
      slot: record.slot,
      save_type: record.type,
      state_data: record.data,
      metadata: record.metadata,
      created_at: new Date(record.createdAt).toISOString(),
      updated_at: new Date(record.updatedAt).toISOString(),
    };

    const { error } = await supabase
      .from('save_states')
      .upsert(payload, { onConflict: 'user_id,rom_id,slot,save_type' });

    if (error) {
      throw error;
    }

    return record;
  }

  async _loadFromCloud(romId, slot = 'autosave', type = SAVE_TYPES.STATE) {
    if (!this.authUserId) {
      return null;
    }

    const { data, error } = await supabase
      .from('save_states')
      .select('*')
      .eq('user_id', this.authUserId)
      .eq('rom_id', romId)
      .eq('slot', slot)
      .eq('save_type', type)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id ? String(data.id).replace(`${this.authUserId}::`, '') : this._buildId(romId, slot, type),
      romId,
      slot,
      type,
      data: deserializeValue(data.state_data),
      metadata: data.metadata ?? {},
      createdAt: data.created_at ? Date.parse(data.created_at) : Date.now(),
      updatedAt: data.updated_at ? Date.parse(data.updated_at) : Date.now(),
    };
  }

  async _deleteFromCloud(romId, slot = 'autosave', type = SAVE_TYPES.STATE) {
    if (!this.authUserId) {
      return;
    }

    const { error } = await supabase
      .from('save_states')
      .delete()
      .eq('user_id', this.authUserId)
      .eq('rom_id', romId)
      .eq('slot', slot)
      .eq('save_type', type);

    if (error) {
      throw error;
    }
  }
}
