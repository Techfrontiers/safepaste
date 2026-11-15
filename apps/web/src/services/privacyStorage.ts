export interface PrivacyHistoryEntry {
  id: string;
  timestamp: string;
  taskType: string;
  executionSource: string;
  tokensCount: number;
  latencyMs: number;
  zeroLeakageVerified: boolean;
}

export interface PrivacyStats {
  totalScans: number;
  totalEntitiesProtected: number;
  onDeviceExecutions: number;
  cloudExecutions: number;
  sandboxExecutions: number;
  categoryCounts: Record<string, number>;
  recentAuditLogs: PrivacyHistoryEntry[];
}

const DB_NAME = 'safepaste_privacy_db';
const DB_VERSION = 1;
const STORE_NAME = 'audit_metrics';
const RECORD_KEY = 'global_stats';
const FALLBACK_STORAGE_KEY = 'safepaste_privacy_stats_fallback';

function createEmptyStats(): PrivacyStats {
  return {
    totalScans: 0,
    totalEntitiesProtected: 0,
    onDeviceExecutions: 0,
    cloudExecutions: 0,
    sandboxExecutions: 0,
    categoryCounts: {},
    recentAuditLogs: [],
  };
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readStatsFromIdb(): Promise<PrivacyStats | null> {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_KEY);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as PrivacyStats) || null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function writeStatsToIdb(stats: PrivacyStats): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(stats, RECORD_KEY);
      req.onsuccess = () => {
        db.close();
        resolve(true);
      };
      req.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

function readFallbackStats(): PrivacyStats {
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) return createEmptyStats();
    return { ...createEmptyStats(), ...JSON.parse(raw) };
  } catch {
    return createEmptyStats();
  }
}

function writeFallbackStats(stats: PrivacyStats): void {
  try {
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota errors
  }
}

export async function getPrivacyStats(): Promise<PrivacyStats> {
  const idbStats = await readStatsFromIdb();
  if (idbStats) return { ...createEmptyStats(), ...idbStats };
  return readFallbackStats();
}

async function savePrivacyStats(stats: PrivacyStats): Promise<PrivacyStats> {
  const saved = await writeStatsToIdb(stats);
  if (!saved) {
    writeFallbackStats(stats);
  } else {
    writeFallbackStats(stats);
  }
  return stats;
}

export async function recordScanMetrics(
  entitiesCount: number,
  categoryCounts: Record<string, number>
): Promise<PrivacyStats> {
  const current = await getPrivacyStats();
  const nextCategories = { ...current.categoryCounts };
  for (const [cat, count] of Object.entries(categoryCounts)) {
    nextCategories[cat] = (nextCategories[cat] || 0) + count;
  }

  const next: PrivacyStats = {
    ...current,
    totalScans: current.totalScans + 1,
    totalEntitiesProtected: current.totalEntitiesProtected + entitiesCount,
    categoryCounts: nextCategories,
  };

  return savePrivacyStats(next);
}

export async function recordExecutionMetrics(entry: {
  taskType: string;
  executionSource: string;
  tokensCount: number;
  latencyMs: number;
  zeroLeakageVerified: boolean;
}): Promise<PrivacyStats> {
  const current = await getPrivacyStats();

  const isOnDevice =
    entry.executionSource === 'GEMINI_NANO_ON_DEVICE' ||
    entry.executionSource === 'FIREBASE_HYBRID_ON_DEVICE';
  const isCloud = entry.executionSource === 'FIREBASE_CLOUD_GEMINI';

  const historyEntry: PrivacyHistoryEntry = {
    id: Math.random().toString(36).slice(2, 10),
    timestamp: new Date().toISOString(),
    taskType: entry.taskType,
    executionSource: entry.executionSource,
    tokensCount: entry.tokensCount,
    latencyMs: entry.latencyMs,
    zeroLeakageVerified: entry.zeroLeakageVerified,
  };

  const next: PrivacyStats = {
    ...current,
    onDeviceExecutions: current.onDeviceExecutions + (isOnDevice ? 1 : 0),
    cloudExecutions: current.cloudExecutions + (isCloud ? 1 : 0),
    sandboxExecutions: current.sandboxExecutions + (!isOnDevice && !isCloud ? 1 : 0),
    recentAuditLogs: [historyEntry, ...current.recentAuditLogs].slice(0, 20),
  };

  return savePrivacyStats(next);
}

export async function resetPrivacyStats(): Promise<PrivacyStats> {
  const empty = createEmptyStats();
  return savePrivacyStats(empty);
}
