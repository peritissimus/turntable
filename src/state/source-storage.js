const DB_NAME = "turntable-assets";
const STORE_NAME = "source-images";
const SOURCE_KEY = "active-source";

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, action) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveSource(file) {
  try {
    await transact("readwrite", (store) => store.put({
      blob: file,
      name: file.name || "Pasted image",
      type: file.type,
      savedAt: Date.now(),
    }, SOURCE_KEY));
  } catch {
    // Persistence is a convenience. The editor remains usable when
    // IndexedDB is unavailable (for example in strict private browsing).
  }
}

export async function restoreSource() {
  try {
    return await transact("readonly", (store) => store.get(SOURCE_KEY));
  } catch {
    return null;
  }
}

export async function clearStoredSource() {
  try {
    await transact("readwrite", (store) => store.delete(SOURCE_KEY));
  } catch {
    // See saveSource: source persistence is deliberately non-blocking.
  }
}

