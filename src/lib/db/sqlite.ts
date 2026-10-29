import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * The connection to the SQLite database, for Prisma.
 *
 * SQLite allows one writer at a time. The site is one Node process with one
 * connection, so the writer is never contended inside the site; what has to
 * be handled is how requests share that connection:
 *
 * Prisma's better-sqlite3 adapter runs every query on the one connection and
 * only makes transactions wait for each other. A query from another request
 * that arrived while a transaction was open would run *inside* it — reading
 * its uncommitted rows, and silently undone if it rolled back. So here every
 * query outside a transaction waits until no transaction is open, and
 * transactions run one at a time in the order they were asked for. Queries
 * are synchronous in better-sqlite3, so nothing else can slip in between.
 *
 * Consequence for code: inside `prisma.$transaction(async (tx) => …)` use
 * only `tx`, and never wait on the network — the whole database waits with it.
 */

type Adapter = Awaited<ReturnType<PrismaBetterSqlite3["connect"]>>;
type Transaction = Awaited<ReturnType<Adapter["startTransaction"]>>;
type Query = Parameters<Adapter["queryRaw"]>[0];

/** Applied to every connection. */
export const PRAGMAS = [
  // Write-ahead log: readers never block the writer and the writer never
  // blocks readers; also what makes online backups safe.
  "journal_mode = WAL",
  // With WAL, NORMAL only fsyncs at checkpoints: a power cut can lose the
  // last moments of commits but never corrupts the file.
  "synchronous = NORMAL",
  // Another process holding the write lock (a script, a backup) is waited
  // for, up to 5 s, instead of failing at once with SQLITE_BUSY.
  "busy_timeout = 5000",
  // Relations' onDelete rules (Cascade, SetNull) are enforced by the database.
  "foreign_keys = ON",
  "temp_store = MEMORY",
  // 16 MB of page cache — the VM has 1 GB in all.
  "cache_size = -16000",
];

class SerializedAdapter {
  readonly provider: Adapter["provider"];
  readonly adapterName: string;
  #inner: Adapter;
  /** Settles when the transaction ahead in line has finished. */
  #queue: Promise<void> = Promise.resolve();
  /** Set while a transaction is open; settles when it ends. */
  #open: Promise<void> | null = null;

  constructor(inner: Adapter) {
    this.#inner = inner;
    this.provider = inner.provider;
    this.adapterName = inner.adapterName;
  }

  async #idle(): Promise<void> {
    while (this.#open) await this.#open;
  }

  async queryRaw(query: Query) {
    await this.#idle();
    return this.#inner.queryRaw(query);
  }

  async executeRaw(query: Query) {
    await this.#idle();
    return this.#inner.executeRaw(query);
  }

  async executeScript(script: string) {
    await this.#idle();
    return this.#inner.executeScript(script);
  }

  async startTransaction(isolationLevel?: Parameters<Adapter["startTransaction"]>[0]): Promise<Transaction> {
    const ahead = this.#queue;
    let leaveQueue!: () => void;
    this.#queue = new Promise((resolve) => (leaveQueue = resolve));
    await ahead;

    // From here until the transaction ends, other queries wait in #idle().
    let close!: () => void;
    this.#open = new Promise((resolve) => (close = resolve));
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      this.#open = null;
      close();
      leaveQueue();
    };

    let tx: Transaction;
    try {
      tx = await this.#inner.startTransaction(isolationLevel);
    } catch (error) {
      end();
      throw error;
    }
    const commit = tx.commit.bind(tx);
    const rollback = tx.rollback.bind(tx);
    tx.commit = async () => {
      try {
        await commit();
      } finally {
        end();
      }
    };
    tx.rollback = async () => {
      try {
        await rollback();
      } finally {
        end();
      }
    };
    return tx;
  }

  dispose() {
    return this.#inner.dispose();
  }
}

/** A Prisma adapter for the SQLite file at `file`, with the settings above. */
export class SqliteAdapter {
  readonly provider = "sqlite" as const;
  readonly adapterName: string;
  #factory: PrismaBetterSqlite3;

  constructor(file: string) {
    this.#factory = new PrismaBetterSqlite3({ url: file, timeout: 5000 });
    this.adapterName = this.#factory.adapterName;
  }

  async connect() {
    const inner = await this.#factory.connect();
    await inner.executeScript(PRAGMAS.map((p) => `PRAGMA ${p};`).join("\n"));
    return new SerializedAdapter(inner);
  }
}
