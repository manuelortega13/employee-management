import { BACKUP_PREFIX } from './backup.types';

const HANDLE_STORE_DB = 'em-fs-handles';
const HANDLE_STORE_NAME = 'handles';
const DIR_HANDLE_KEY = 'backupDirectoryHandle';

interface FileSystemWritableFileStreamLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandleLike {
  kind: 'file';
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

export interface FileSystemDirectoryHandleLike {
  name: string;
  kind: 'directory';
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandleLike>;
  removeEntry(name: string): Promise<void>;
  entries(): AsyncIterableIterator<
    [string, FileSystemFileHandleLike | FileSystemDirectoryHandleLike]
  >;
  queryPermission(options: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission(options: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: {
      mode?: 'read' | 'readwrite';
    }) => Promise<FileSystemDirectoryHandleLike>;
  }
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export async function getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandleLike | null> {
  const handle = await readHandle();
  if (!handle) return null;
  const permission = await handle.queryPermission({ mode: 'readwrite' });
  if (permission === 'granted') return handle;
  return handle;
}

export async function ensurePermission(handle: FileSystemDirectoryHandleLike): Promise<boolean> {
  const current = await handle.queryPermission({ mode: 'readwrite' });
  if (current === 'granted') return true;
  const requested = await handle.requestPermission({ mode: 'readwrite' });
  return requested === 'granted';
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandleLike | null> {
  if (!isFileSystemAccessSupported() || !window.showDirectoryPicker) return null;
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await saveHandle(handle);
  return handle;
}

export async function clearStoredDirectoryHandle(): Promise<void> {
  const idb = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction([HANDLE_STORE_NAME], 'readwrite');
    tx.objectStore(HANDLE_STORE_NAME).delete(DIR_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readHandle(): Promise<FileSystemDirectoryHandleLike | null> {
  const idb = await openIdb();
  return new Promise((resolve) => {
    const tx = idb.transaction([HANDLE_STORE_NAME], 'readonly');
    const req = tx.objectStore(HANDLE_STORE_NAME).get(DIR_HANDLE_KEY);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandleLike) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function saveHandle(handle: FileSystemDirectoryHandleLike): Promise<void> {
  const idb = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction([HANDLE_STORE_NAME], 'readwrite');
    tx.objectStore(HANDLE_STORE_NAME).put(handle, DIR_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_STORE_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(HANDLE_STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function writeBackupFile(
  handle: FileSystemDirectoryHandleLike,
  filename: string,
  contents: string
): Promise<void> {
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}

export async function rotateBackupFiles(
  handle: FileSystemDirectoryHandleLike,
  keep: number
): Promise<string[]> {
  const matches: string[] = [];
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind !== 'directory' && name.startsWith(BACKUP_PREFIX) && name.endsWith('.json')) {
      matches.push(name);
    }
  }
  matches.sort();
  const toDelete = matches.slice(0, Math.max(0, matches.length - keep));
  for (const name of toDelete) {
    try {
      await handle.removeEntry(name);
    } catch {
      /* file may have been removed already; ignore */
    }
  }
  return toDelete;
}
