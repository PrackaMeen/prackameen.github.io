/**
 * MessageStore — IndexedDB-backed ordered log of message envelopes.
 *
 * Object store: "messages"
 * Key path:     [sessionId, seq]
 * All operations are idempotent on duplicate seq values.
 */

const DB_NAME = "game-session-store";
const DB_VERSION = 1;
const STORE_NAME = "messages";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: ["sessionId", "seq"] });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class MessageStore {
  constructor() {
    this._db = null;
  }

  async _getDb() {
    if (!this._db) {
      this._db = await openDb();
    }
    return this._db;
  }

  /**
   * Persist an envelope. No-op when [sessionId, seq] already exists.
   * @param {object} envelope — must have .sessionId and .seq
   */
  async append(envelope) {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      // put is idempotent for same key; we use add so duplicates are silently ignored
      const req = store.add(envelope);
      req.onerror = () => {
        // ConstraintError = duplicate key → treat as success
        if (req.error && req.error.name === "ConstraintError") {
          tx.abort();
          resolve();
        } else {
          reject(req.error);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        if (tx.error && tx.error.name === "AbortError") {
          resolve(); // we aborted on ConstraintError
        } else {
          reject(tx.error);
        }
      };
    });
  }

  /**
   * Return all envelopes for a session from a given seq (inclusive), in order.
   * @param {string} sessionId
   * @param {number} fromSeq
   * @returns {Promise<object[]>}
   */
  async getFrom(sessionId, fromSeq) {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const range = IDBKeyRange.bound([sessionId, fromSeq], [sessionId, Number.MAX_SAFE_INTEGER]);
      const req = store.getAll(range);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Return every envelope for a session in order.
   * @param {string} sessionId
   * @returns {Promise<object[]>}
   */
  async getAll(sessionId) {
    return this.getFrom(sessionId, 0);
  }

  /**
   * Delete all stored envelopes for a session.
   * @param {string} sessionId
   */
  async clear(sessionId) {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER]);
      const req = store.delete(range);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Return the highest stored seq for a session, or -1 if none.
   * @param {string} sessionId
   * @returns {Promise<number>}
   */
  async getLastSeq(sessionId) {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER]);
      const req = store.openCursor(range, "prev");
      req.onsuccess = () => {
        const cursor = req.result;
        resolve(cursor ? cursor.value.seq : 0);
      };
      req.onerror = () => reject(req.error);
    });
  }
}
