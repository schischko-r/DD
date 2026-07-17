import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearConstructorDraft,
  draftStorageKey,
  loadConstructorDraft,
  saveConstructorDraft,
} from './constructorStorage.js';

function createMemoryIndexedDb() {
  const values = new Map();
  const database = {
    objectStoreNames: {contains: () => true},
    createObjectStore: () => {},
    close: () => {},
    transaction: () => {
      let pending = 0;
      let completed = false;
      const tx = {
        error: null,
        oncomplete: null,
        onerror: null,
        onabort: null,
        abort() {
          if (completed) return;
          completed = true;
          queueMicrotask(() => tx.onabort?.());
        },
        objectStore() {
          const request = (operation) => {
            const result = {result: undefined, error: null, onsuccess: null, onerror: null};
            pending += 1;
            queueMicrotask(() => {
              if (completed) return;
              try {
                result.result = operation();
                result.onsuccess?.();
              } catch (error) {
                result.error = error;
                tx.error = error;
                result.onerror?.();
                tx.onerror?.();
              } finally {
                pending -= 1;
                finish();
              }
            });
            return result;
          };
          return {
            get: (key) => request(() => values.get(key)),
            put: (value, key) => request(() => { values.set(key, value); return key; }),
            delete: (key) => request(() => values.delete(key)),
          };
        },
      };
      const finish = () => {
        if (completed || pending) return;
        completed = true;
        queueMicrotask(() => tx.oncomplete?.());
      };
      queueMicrotask(finish);
      return tx;
    },
  };
  return {
    open() {
      const request = {result: database, error: null, onerror: null, onupgradeneeded: null, onsuccess: null};
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
}

test('draft storage key follows document identity and fingerprint fallbacks', () => {
  assert.equal(draftStorageKey({constructor: {documentId: 'document-id', sourceFingerprint: 'hash'}}), 'document-id');
  assert.equal(draftStorageKey({constructor: {sourceFingerprint: 'hash'}}), 'hash');
  assert.equal(draftStorageKey({}), 'default');
});

test('missing IndexedDB is reported without mutating the report', async () => {
  const report = {constructor: {documentId: 'document-id'}, products: []};
  await assert.rejects(loadConstructorDraft('document-id'), /IndexedDB недоступен/);
  await assert.rejects(saveConstructorDraft('document-id', report), /IndexedDB недоступен/);
  await assert.rejects(clearConstructorDraft('document-id'), /IndexedDB недоступен/);
  assert.deepEqual(report, {constructor: {documentId: 'document-id'}, products: []});
});

test('draft pointers are isolated by embedded source document', async () => {
  const previous = globalThis.indexedDB;
  globalThis.indexedDB = createMemoryIndexedDb();
  const reportA = {constructor: {documentId: 'import-a'}, products: [{id: 'a'}]};
  const reportA2 = {constructor: {documentId: 'import-a-2'}, products: [{id: 'a2'}]};
  const reportB = {constructor: {documentId: 'import-b'}, products: [{id: 'b'}]};
  try {
    await saveConstructorDraft('source-a', reportA);
    await saveConstructorDraft('source-b', reportB);
    assert.deepEqual(await loadConstructorDraft('source-a'), reportA);
    assert.deepEqual(await loadConstructorDraft('source-b'), reportB);
    assert.equal(await loadConstructorDraft('source-c'), null);

    await saveConstructorDraft('source-a', reportA2);
    assert.deepEqual(await loadConstructorDraft('source-a'), reportA2);
    assert.deepEqual(await loadConstructorDraft('source-b'), reportB);

    await clearConstructorDraft('source-a');
    assert.equal(await loadConstructorDraft('source-a'), null);
    assert.deepEqual(await loadConstructorDraft('source-b'), reportB);
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});
