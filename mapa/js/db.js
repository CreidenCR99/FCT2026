/**
 * Módulo: db.js
 * Gestión de persistencia local mediante IndexedDB para carga instantánea.
 */

const DB_NAME = 'SicoLaresMapDB';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

/**
 * Inicializa la conexión con la base de datos IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Recupera un valor del almacén de datos persistente.
 * @param {string} key - Identificador del recurso.
 * @returns {Promise<any|null>}
 */
export async function getCache(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IndexedDB GET error:', e);
    return null;
  }
}

/**
 * Almacena o actualiza un recurso en la base de datos persistente.
 * @param {string} key - Identificador del recurso.
 * @param {any} value - Datos a persistir.
 * @returns {Promise<void>}
 */
export async function setCache(key, value) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IndexedDB SET error:', e);
  }
}