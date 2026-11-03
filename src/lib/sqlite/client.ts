// Main-thread side of the SQLite worker: a tiny promise-based RPC.
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./sqlite.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const { id, ok, result, error } = e.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (ok) p.resolve(result);
    else p.reject(new Error(error));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'SQLite worker failed to load.'));
    pending.clear();
  };
  return worker;
}

export function callSqlite<T>(op: string, ...args: unknown[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, op, args });
  });
}
