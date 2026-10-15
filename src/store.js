import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const tables = ['units', 'users', 'assets', 'revisions', 'proposals', 'tethers', 'delegations', 'connectors', 'events'];
export class Store {
  constructor(file = ':memory:') {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    for (const name of tables) this.db.exec(`CREATE TABLE IF NOT EXISTS ${name} (id TEXT PRIMARY KEY, payload TEXT NOT NULL)`);
  }
  table(name) { if (!tables.includes(name)) throw new Error('Unknown table'); return name; }
  all(name) { return this.db.prepare(`SELECT payload FROM ${this.table(name)}`).all().map(r => JSON.parse(r.payload)); }
  get(name, id) { const row = this.db.prepare(`SELECT payload FROM ${this.table(name)} WHERE id=?`).get(id); return row ? JSON.parse(row.payload) : null; }
  put(name, value) { this.db.prepare(`INSERT INTO ${this.table(name)}(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload`).run(value.id, JSON.stringify(value)); return value; }
  append(name, value) { this.db.prepare(`INSERT INTO ${this.table(name)}(id,payload) VALUES (?,?)`).run(value.id, JSON.stringify(value)); return value; }
  tx(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const result = fn(); this.db.exec('COMMIT'); return result; } catch (error) { this.db.exec('ROLLBACK'); throw error; } }
  close() { this.db.close(); }
}
