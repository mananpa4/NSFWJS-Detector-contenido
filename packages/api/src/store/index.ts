import type { ModerationRecord } from '../types.js';

/** Puerto de persistencia (hibrido: el agente elige implementacion via STORE). */
export interface Store {
  save(record: ModerationRecord): Promise<void>;
  get(id: string): Promise<ModerationRecord | null>;
  list(limit?: number): Promise<ModerationRecord[]>;
}

/** Memoria: desarrollo y tests. Sin dependencias. */
export class MemoryStore implements Store {
  private map = new Map<string, ModerationRecord>();

  async save(record: ModerationRecord): Promise<void> {
    this.map.set(record.id, record);
  }

  async get(id: string): Promise<ModerationRecord | null> {
    return this.map.get(id) ?? null;
  }

  async list(limit = 50): Promise<ModerationRecord[]> {
    return [...this.map.values()].slice(-limit).reverse();
  }
}

/**
 * SQLite via `node:sqlite` (stdlib de Node 22+). Cero dependencias.
 * Import dinamico para no romper en runtimes sin el modulo.
 */
export class SqliteStore implements Store {
  private db: {
    exec(sql: string): void;
    prepare(sql: string): { run(...p: unknown[]): void; get(...p: unknown[]): unknown; all(...p: unknown[]): unknown[] };
  } | null = null;
  private path: string;

  constructor(path = './moderacion.db') {
    this.path = path;
  }

  private async open(): Promise<NonNullable<SqliteStore['db']>> {
    if (this.db !== null) return this.db;
    const mod = (await import('node:sqlite')) as unknown as {
      DatabaseSync: new (path: string) => NonNullable<SqliteStore['db']>;
    };
    const db = new mod.DatabaseSync(this.path);
    db.exec(
      `CREATE TABLE IF NOT EXISTS moderations (
        id TEXT PRIMARY KEY, kind TEXT, payload TEXT, created_at TEXT)`,
    );
    this.db = db;
    return db;
  }

  async save(record: ModerationRecord): Promise<void> {
    const db = await this.open();
    db.prepare(
      `INSERT INTO moderations (id, kind, payload, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload=excluded.payload`,
    ).run(record.id, record.kind, JSON.stringify(record), record.createdAt);
  }

  async get(id: string): Promise<ModerationRecord | null> {
    const db = await this.open();
    const row = db.prepare(`SELECT payload FROM moderations WHERE id=?`).get(id) as {
      payload: string;
    } | null;
    return row === null ? null : (JSON.parse(row.payload) as ModerationRecord);
  }

  async list(limit = 50): Promise<ModerationRecord[]> {
    const db = await this.open();
    const rows = db.prepare(`SELECT payload FROM moderations ORDER BY created_at DESC LIMIT ?`).all(limit) as {
      payload: string;
    }[];
    return rows.map((r) => JSON.parse(r.payload) as ModerationRecord);
  }
}

/**
 * Postgres via `pg` (lazy: solo se importa si STORE=postgres).
 * Requiere DATABASE_URL. La tabla se crea al primer uso.
 */
export class PostgresStore implements Store {
  private pool: import('pg').Pool | null = null;

  private async poolOpen(): Promise<import('pg').Pool> {
    if (this.pool !== null) return this.pool;
    const { Pool } = (await import('pg')) as typeof import('pg');
    const connectionString = process.env.DATABASE_URL ?? '';
    this.pool = new Pool({ connectionString });
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS moderations (
        id TEXT PRIMARY KEY, kind TEXT, payload JSONB, created_at TIMESTAMPTZ)`,
    );
    return this.pool;
  }

  async save(record: ModerationRecord): Promise<void> {
    const pool = await this.poolOpen();
    await pool.query(
      `INSERT INTO moderations (id, kind, payload, created_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload`,
      [record.id, record.kind, JSON.stringify(record), record.createdAt],
    );
  }

  async get(id: string): Promise<ModerationRecord | null> {
    const pool = await this.poolOpen();
    const res = await pool.query(`SELECT payload FROM moderations WHERE id=$1`, [id]);
    if (res.rowCount === 0) return null;
    const row = res.rows[0] as { payload: ModerationRecord | string };
    return typeof row.payload === 'string' ? (JSON.parse(row.payload) as ModerationRecord) : row.payload;
  }

  async list(limit = 50): Promise<ModerationRecord[]> {
    const pool = await this.poolOpen();
    const res = await pool.query(`SELECT payload FROM moderations ORDER BY created_at DESC LIMIT $1`, [limit]);
    return (res.rows as { payload: ModerationRecord | string }[]).map((r) =>
      typeof r.payload === 'string' ? (JSON.parse(r.payload) as ModerationRecord) : r.payload,
    );
  }
}
