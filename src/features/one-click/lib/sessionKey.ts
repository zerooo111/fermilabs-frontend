/**
 * sessionKey.ts
 * Browser-held Ed25519 trading key for one-click trading. The owner's wallet
 * delegates to it once (Mango `account_edit`); afterwards it signs order
 * intents without wallet prompts.
 *
 * The private key is a non-extractable WebCrypto key kept in IndexedDB: page
 * script can ask it to sign, but can never read the key material out. One
 * key per owner wallet.
 */
import { PublicKey } from '@solana/web3.js';

const DB_NAME = 'fermi-one-click';
const STORE = 'session-keys';

export interface SessionKey {
  owner: string;
  publicKey: PublicKey;
  privateKey: CryptoKey;
  createdAt: number;
}

interface StoredSessionKey {
  owner: string;
  publicKey: string;
  privateKey: CryptoKey;
  createdAt: number;
}

let supportPromise: Promise<boolean> | null = null;

/** Whether this browser can generate non-extractable Ed25519 keys. */
export function isSessionKeySupported(): Promise<boolean> {
  supportPromise ??= (async () => {
    try {
      if (!globalThis.crypto?.subtle || !globalThis.indexedDB) return false;
      await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
      return true;
    } catch {
      return false;
    }
  })();
  return supportPromise;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'owner' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function loadSessionKey(owner: string): Promise<SessionKey | null> {
  try {
    const stored = await withStore<StoredSessionKey | undefined>('readonly', s => s.get(owner));
    if (!stored) return null;
    return { ...stored, publicKey: new PublicKey(stored.publicKey) };
  } catch {
    return null;
  }
}

/** Generates and stores a fresh key for `owner`, replacing any previous one. */
export async function createSessionKey(owner: string): Promise<SessionKey> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, false, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  // Public keys stay exportable even when the private key isn't.
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const key: SessionKey = {
    owner,
    publicKey: new PublicKey(raw),
    privateKey: pair.privateKey,
    createdAt: Date.now(),
  };
  await withStore('readwrite', s =>
    s.put({ ...key, publicKey: key.publicKey.toBase58() } satisfies StoredSessionKey)
  );
  return key;
}

export async function deleteSessionKey(owner: string): Promise<void> {
  try {
    await withStore('readwrite', s => s.delete(owner));
  } catch {
    // Nothing stored or storage unavailable — nothing to delete.
  }
}

export async function signWithSessionKey(
  key: SessionKey,
  message: Uint8Array
): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key.privateKey, message));
}
