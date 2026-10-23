/**
 * Camada de persistência (IndexedDB), isolada da interface.
 * Nenhum componente deve chamar indexedDB diretamente: use os repositórios.
 */

export const DB_NAME = 'fitness-app';
/** Aumente ao mudar o esquema e trate a migração em `migrate`. */
export const DB_VERSION = 3;

export const STORE = {
  profile: 'profile',
  settings: 'settings',
  exercises: 'exercises',
  plannedWorkouts: 'plannedWorkouts',
  sessions: 'sessions',
  meals: 'meals',
  bodyMetrics: 'bodyMetrics',
  photos: 'photos',
  reminders: 'reminders',
  /** Planos semanais (ativo e arquivados). */
  plans: 'plans',
  /** Check-ins diários: um registro por data local (id = data). */
  checkins: 'checkins',
  /** Valores auxiliares (ex.: contador de gerações com o Gemini). */
  meta: 'meta',
  /** Etapa 3: fichas próprias, exercícios personalizados e suas fotos. */
  routines: 'routines',
  customExercises: 'customExercises',
  exerciseImages: 'exerciseImages',
} as const;

export type StoreName = (typeof STORE)[keyof typeof STORE];

const INDEXES: Partial<Record<StoreName, ReadonlyArray<readonly [string, string]>>> = {
  meals: [['by-date', 'date']],
  bodyMetrics: [['by-date', 'date']],
  sessions: [['by-date', 'date']],
  photos: [['by-date', 'date']],
  plannedWorkouts: [['by-scheduledFor', 'scheduledFor']],
  plans: [['by-status', 'status']],
};

const V1_STORES: StoreName[] = [
  STORE.profile,
  STORE.settings,
  STORE.exercises,
  STORE.plannedWorkouts,
  STORE.sessions,
  STORE.meals,
  STORE.bodyMetrics,
  STORE.photos,
  STORE.reminders,
];

function migrate(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    for (const name of V1_STORES) {
      const store = db.createObjectStore(name, { keyPath: 'id' });
      for (const [indexName, keyPath] of INDEXES[name] ?? []) {
        store.createIndex(indexName, keyPath);
      }
    }
  }
  if (oldVersion < 2) {
    // Etapa 2: planos semanais, check-ins e metadados. Dados existentes (perfil, aparência) são preservados.
    for (const name of [STORE.plans, STORE.checkins, STORE.meta] as const) {
      if (db.objectStoreNames.contains(name)) continue;
      const store = db.createObjectStore(name, { keyPath: 'id' });
      for (const [indexName, keyPath] of INDEXES[name] ?? []) store.createIndex(indexName, keyPath);
    }
  }
  if (oldVersion < 3) {
    // Etapa 3: só ACRESCENTA stores. Perfil, planos, sessões, check-ins e refeições existentes não são tocados.
    for (const name of [STORE.routines, STORE.customExercises, STORE.exerciseImages] as const) {
      if (db.objectStoreNames.contains(name)) continue;
      db.createObjectStore(name, { keyPath: 'id' });
    }
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível neste navegador.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => migrate(request.result, event.oldVersion);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir o IndexedDB.'));
    request.onblocked = () => reject(new Error('Abertura do banco bloqueada por outra aba.'));
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

/** Fecha a conexão e esquece o cache (usado em testes). */
export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  try {
    (await dbPromise).close();
  } catch {
    /* nada a fechar */
  }
  dbPromise = null;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha na operação do IndexedDB.'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha na transação.'));
    tx.onabort = () => reject(tx.error ?? new Error('Transação cancelada.'));
  });
}

/** Repositório genérico: um por object store. */
export class Repository<T extends { id: string }> {
  private readonly storeName: StoreName;

  constructor(storeName: StoreName) {
    this.storeName = storeName;
  }

  private async run<R>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<R>): Promise<R> {
    const db = await openDb();
    const tx = db.transaction(this.storeName, mode);
    const done = transactionDone(tx);
    const result = await requestToPromise(op(tx.objectStore(this.storeName)));
    await done;
    return result;
  }

  get(id: string): Promise<T | undefined> {
    return this.run('readonly', (s) => s.get(id)) as Promise<T | undefined>;
  }

  async put(value: T): Promise<T> {
    await this.run('readwrite', (s) => s.put(value));
    return value;
  }

  async delete(id: string): Promise<void> {
    await this.run('readwrite', (s) => s.delete(id));
  }

  all(): Promise<T[]> {
    return this.run('readonly', (s) => s.getAll()) as Promise<T[]>;
  }

  byIndex(indexName: string, query: IDBValidKey | IDBKeyRange): Promise<T[]> {
    return this.run('readonly', (s) => s.index(indexName).getAll(query)) as Promise<T[]>;
  }

  async clear(): Promise<void> {
    await this.run('readwrite', (s) => s.clear());
  }
}

/**
 * Executa várias escritas em UMA transação (tudo ou nada). Use só requisições do IndexedDB
 * dentro do callback; não espere outras promessas (a transação fecharia sozinha).
 */
export async function writeTransaction(
  names: StoreName[],
  work: (stores: Record<string, IDBObjectStore>) => Promise<void> | void,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(names, 'readwrite');
  const done = transactionDone(tx);
  const stores: Record<string, IDBObjectStore> = {};
  for (const n of names) stores[n] = tx.objectStore(n);
  try {
    await work(stores);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* já finalizada */
    }
    await done.catch(() => undefined);
    throw error;
  }
  await done;
}

export function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return requestToPromise(request);
}
