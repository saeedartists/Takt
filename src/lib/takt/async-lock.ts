const locks = new Map<string, Promise<unknown>>();

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let resolve!: (value: unknown) => void;
  const gate = new Promise((r) => {
    resolve = r;
  });
  locks.set(key, gate);
  try {
    await previous;
    return await fn();
  } finally {
    resolve(undefined);
    if (locks.get(key) === gate) locks.delete(key);
  }
}
