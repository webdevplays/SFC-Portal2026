import pg from 'pg';
import fs from 'fs';
import path from 'path';

/**
 * Saint Francis Clinic - PostgreSQL Database Connector for Dokploy / Docker Hosting
 * Implements an adapter layer to make PostgreSQL look exactly like mysql2/promise.
 */

let pool: pg.Pool | null = null;
let isConnected = false;
let lastAttemptTime = 0;
let isOfflineCached = false;
const RETRY_COOLDOWN_MS = 60000; // 60 seconds cooldown

export const getPostgresConfig = () => {
  // -----------------------------------------------------------------------------
  // 💾 DOKPLOY POSTGRES DATABASE CREDENTIALS (FALLBACK ENGINE)
  // If your Dokploy container environment variables fail to load correctly from the
  // Environment Setup, fill in your actual PostgreSQL database credentials here.
  // -----------------------------------------------------------------------------
  const DOKPLOY_FALLBACK_HOST = 'sfc-portal-sfcpostdb-snp1ir';
  const DOKPLOY_FALLBACK_USER = 'sfcuser';
  const DOKPLOY_FALLBACK_PASSWORD = 'Saintfrancisclinic2026.';
  const DOKPLOY_FALLBACK_DB = 'sfcdb';
  const DOKPLOY_FALLBACK_PORT = '5432';

  // Helper to sanitize quotes and spaces from environment variables
  const sanitizeEnv = (val: string | undefined): string => {
    if (!val) return '';
    let s = val.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      s = s.substring(1, s.length - 1).trim();
    }
    if (s.startsWith("'") && s.endsWith("'")) {
      s = s.substring(1, s.length - 1).trim();
    }
    return s;
  };

  // Dokploy often injects DATABASE_URL, POSTGRES_URL, or POSTGRES_PRIVATE_URL
  const connectionUrl = sanitizeEnv(
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.POSTGRES_PRIVATE_URL || 
    process.env.DB_URL || 
    process.env.POSTGRES_CONNECTION_URL || 
    process.env.POSTGRESQL_URL || 
    process.env.DB_CONNECTION_URL
  );
  
  let parsedUrlConfig: {
    host?: string;
    user?: string;
    password?: string;
    database?: string;
    port?: number;
  } = {};

  if (connectionUrl && (connectionUrl.startsWith('postgres://') || connectionUrl.startsWith('postgresql://'))) {
    try {
      // Parse PostgreSQL URI
      const url = new URL(connectionUrl);
      parsedUrlConfig = {
        host: url.hostname || undefined,
        user: decodeURIComponent(url.username) || undefined,
        password: decodeURIComponent(url.password) || undefined,
        database: url.pathname.substring(1) || undefined,
        port: url.port ? parseInt(url.port, 10) : 5432
      };
      console.log('🔗 Successfully parsed PostgreSQL Connection URL from environment variables.');
    } catch (urlErr: any) {
      console.warn('⚠️ Warning: Failed to parse PostgreSQL connection URL:', urlErr.message);
    }
  }

  const envHost = sanitizeEnv(process.env.DB_HOST || process.env.POSTGRES_HOST || process.env.POSTGRES_PRIVATE_HOST);
  const envUser = sanitizeEnv(process.env.DB_USER || process.env.POSTGRES_USER);
  const envPassword = sanitizeEnv(process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD);
  const envDatabase = sanitizeEnv(process.env.DB_NAME || process.env.DB_DATABASE || process.env.POSTGRES_DB);
  const envPort = sanitizeEnv(process.env.DB_PORT || process.env.POSTGRES_PORT);

  const host = parsedUrlConfig.host || envHost || DOKPLOY_FALLBACK_HOST;
  const user = parsedUrlConfig.user || envUser || DOKPLOY_FALLBACK_USER;
  const password = parsedUrlConfig.password !== undefined ? parsedUrlConfig.password : (envPassword || DOKPLOY_FALLBACK_PASSWORD);
  const database = parsedUrlConfig.database || envDatabase || DOKPLOY_FALLBACK_DB;
  const rawPort = parsedUrlConfig.port ? String(parsedUrlConfig.port) : (envPort || DOKPLOY_FALLBACK_PORT);

  // Dynamically determine SSL configuration
  let ssl: any = undefined;
  const isSSLEnabled = sanitizeEnv(process.env.DB_SSL) === 'true' || 
                       sanitizeEnv(process.env.POSTGRES_SSL) === 'true' ||
                       (connectionUrl && (connectionUrl.includes('sslmode=require') || connectionUrl.includes('ssl=true') || connectionUrl.includes('sslmode=prefer')));

  if (isSSLEnabled) {
    ssl = { rejectUnauthorized: false };
  } else if (host && host !== 'localhost' && host !== '127.0.0.1' && host.includes('.') && !host.startsWith('192.168.') && !host.startsWith('10.') && !host.startsWith('172.')) {
    // Remote internet databases (e.g., Supabase, Neon, or public Dokploy PostgreSQL) usually require SSL
    ssl = { rejectUnauthorized: false };
  }

  const config: any = {
    host,
    user,
    password,
    database,
    port: parseInt(rawPort, 10),
    ssl,
    max: 10, // maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000, // 5 seconds connect timeout to fail-fast
  };

  // Only pass connectionString as a fallback if we couldn't parse it successfully but a URL exists
  if (connectionUrl && !parsedUrlConfig.host) {
    config.connectionString = connectionUrl;
  }

  return config;
};

function isPrivateHost(host: string): boolean {
  if (!host) return true;
  const h = host.toLowerCase().trim();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  // If it's an IP address, check for RFC 1918 private networks
  if (/^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/.test(h)) {
    return true;
  }
  // If the host does not contain a dot (e.g. "sfc-portal-sfcpostdb-snp1ir"), it is an internal/local Docker service name
  if (!h.includes('.')) {
    return true;
  }
  if (h.endsWith('.local') || h.endsWith('.internal')) {
    return true;
  }
  return false;
}

export function shouldAttemptPostgres(): boolean {
  const config = getPostgresConfig();
  if (!config.database || !config.host) {
    return false;
  }

  // Disable localhost and internal Docker host database connections inside the AI Studio development container
  const isAISandbox = 
    process.env.K_SERVICE?.includes('ais-dev') || 
    process.env.K_SERVICE?.includes('ais-pre') || 
    process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL?.includes('ais-sandbox') ||
    process.env.APP_URL?.includes('ais-dev') ||
    process.env.APP_URL?.includes('ais-pre') ||
    process.env.DEFAULT_APP_PORT === '3000';

  if (isAISandbox && isPrivateHost(config.host)) {
    return false;
  }

  if (isOfflineCached) {
    const now = Date.now();
    if (now - lastAttemptTime < RETRY_COOLDOWN_MS) {
      return false;
    }
  }
  return true;
}

export function markPostgresSuccess() {
  isOfflineCached = false;
  isConnected = true;
}

export function markPostgresFailure() {
  if (!isOfflineCached) {
    isOfflineCached = true;
    lastAttemptTime = Date.now();
  }
  isConnected = false;
}

/**
 * Translates MySQL style query to PostgreSQL style query on the fly.
 */
export function translateMySQLToPostgres(sql: string, params: any[] = []): { sql: string; params: any[] } {
  let pgSql = sql;
  let pgParams: any[] = [];
  
  // Replace MySQL backticks with double quotes
  pgSql = pgSql.replace(/`/g, '"');

  // Handle FOREIGN_KEY_CHECKS checks
  if (pgSql.trim().toUpperCase() === 'SET FOREIGN_KEY_CHECKS = 0') {
    pgSql = `SET session_replication_role = 'replica'`;
  } else if (pgSql.trim().toUpperCase() === 'SET FOREIGN_KEY_CHECKS = 1') {
    pgSql = `SET session_replication_role = 'origin'`;
  }

  // Handle SHOW TABLES
  if (pgSql.trim().toUpperCase() === 'SHOW TABLES') {
    pgSql = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  } else if (pgSql.trim().toUpperCase().startsWith("SHOW TABLES LIKE '")) {
    const match = pgSql.match(/SHOW TABLES LIKE '([^']+)'/i);
    if (match) {
      const tableName = match[1];
      pgSql = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${tableName}'`;
    }
  }

  // Handle ALTER TABLE ADD/MODIFY column statements in migrations
  pgSql = pgSql.replace(/MODIFY COLUMN\s+"(\w+)"\s+(\w+(\(\d+\))?(\s+NOT\s+NULL)?(\s+DEFAULT\s+[^\s,]+)?)/ig, 'ALTER COLUMN "$1" TYPE $2');
  pgSql = pgSql.replace(/MODIFY COLUMN\s+(\w+)\s+(\w+(\(\d+\))?(\s+NOT\s+NULL)?(\s+DEFAULT\s+[^\s,]+)?)/ig, 'ALTER COLUMN $1 TYPE $2');

  // Map MySQL types to Postgres compatible types in dynamic DDLs
  pgSql = pgSql.replace(/TINYINT\(1\)/ig, 'SMALLINT');
  pgSql = pgSql.replace(/TINYINT/ig, 'SMALLINT');
  pgSql = pgSql.replace(/LONGTEXT/ig, 'TEXT');
  pgSql = pgSql.replace(/DOUBLE\s+/ig, 'DOUBLE PRECISION ');
  pgSql = pgSql.replace(/ENGINE=InnoDB/ig, '');
  pgSql = pgSql.replace(/DEFAULT\s+CHARSET=utf8mb4/ig, '');
  pgSql = pgSql.replace(/COLLATE=utf8mb4_unicode_ci/ig, '');

  // Handle Purok <-> Barangay relational synchronization query
  if (pgSql.includes('UPDATE puroks p') && pgSql.includes('JOIN barangays b')) {
    pgSql = `
      UPDATE "puroks" p
      SET "barangay_id" = b.id
      FROM "barangays" b
      WHERE LOWER(TRIM(p.barangay)) = LOWER(TRIM(b.name))
        AND (p.barangay_id IS NULL OR p.barangay_id = '')
    `;
  }

  // Rewrite ON DUPLICATE KEY UPDATE to ON CONFLICT
  if (/ON DUPLICATE KEY UPDATE/i.test(pgSql)) {
    // Standard conflict target in this application is 'id' since all models have it
    pgSql = pgSql.replace(/ON DUPLICATE KEY UPDATE/i, 'ON CONFLICT (id) DO UPDATE SET');
    pgSql = pgSql.replace(/(\w+)\s*=\s*VALUES\s*\(\s*(\w+)\s*\)/ig, '"$1" = EXCLUDED."$2"');
  }

  // Translate placeholders '?' to '$1', '$2', etc., expanding list arrays
  let paramIndex = 1;
  let finalSql = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let paramValueIndex = 0;

  for (let i = 0; i < pgSql.length; i++) {
    const char = pgSql[i];
    if (char === "'" && pgSql[i - 1] !== "\\") {
      inSingleQuote = !inSingleQuote;
    }
    if (char === '"' && pgSql[i - 1] !== "\\") {
      inDoubleQuote = !inDoubleQuote;
    }

    if (char === '?' && !inSingleQuote && !inDoubleQuote) {
      const paramValue = params[paramValueIndex];
      paramValueIndex++;

      if (Array.isArray(paramValue)) {
        // Expand list parameters in: IN (?)
        const precedingText = finalSql.trim();
        if (precedingText.toUpperCase().endsWith('IN') || precedingText.toUpperCase().endsWith('IN (')) {
          if (precedingText.toUpperCase().endsWith('IN (')) {
            finalSql = finalSql.substring(0, finalSql.toUpperCase().lastIndexOf('IN ('));
          } else {
            finalSql = finalSql.substring(0, finalSql.toUpperCase().lastIndexOf('IN'));
          }
          finalSql += `= ANY($${paramIndex}::varchar[])`;
          pgParams.push(paramValue);
          paramIndex++;

          if (pgSql[i + 1] === ')') {
            i++; // skip ')'
          }
        } else {
          finalSql += `$${paramIndex}`;
          pgParams.push(paramValue);
          paramIndex++;
        }
      } else {
        finalSql += `$${paramIndex}`;
        pgParams.push(paramValue);
        paramIndex++;
      }
    } else {
      finalSql += char;
    }
  }

  while (paramValueIndex < params.length) {
    pgParams.push(params[paramValueIndex]);
    paramValueIndex++;
  }

  return { sql: finalSql, params: pgParams };
}

/**
 * PostgreSQL Pool and Connection Adapter class that mirrors mysql2/promise behavior
 */
class PgConnectionAdapter {
  constructor(private client: pg.PoolClient | pg.Pool) {}

  async query<T = any>(sql: string, params?: any[]): Promise<[T[], any]> {
    const translated = translateMySQLToPostgres(sql, params);
    try {
      const result = await this.client.query(translated.sql, translated.params);
      markPostgresSuccess();
      return [result.rows as T[], null];
    } catch (err) {
      markPostgresFailure();
      throw err;
    }
  }

  async execute<T = any>(sql: string, params?: any[]): Promise<[T[], any]> {
    return this.query<T>(sql, params);
  }

  release() {
    if ('release' in this.client) {
      this.client.release();
    }
  }

  destroy() {
    this.release();
  }
}

class PgPoolAdapter {
  constructor(private pgPool: pg.Pool) {}

  async getConnection(): Promise<PgConnectionAdapter> {
    try {
      const client = await this.pgPool.connect();
      return new PgConnectionAdapter(client);
    } catch (err) {
      markPostgresFailure();
      throw err;
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<[T[], any]> {
    const translated = translateMySQLToPostgres(sql, params);
    try {
      const result = await this.pgPool.query(translated.sql, translated.params);
      markPostgresSuccess();
      return [result.rows as T[], null];
    } catch (err) {
      markPostgresFailure();
      throw err;
    }
  }

  async execute<T = any>(sql: string, params?: any[]): Promise<[T[], any]> {
    return this.query<T>(sql, params);
  }

  async end(): Promise<void> {
    await this.pgPool.end();
  }
}

let wrappedPool: PgPoolAdapter | null = null;

export function getPostgresPool(): PgPoolAdapter | null {
  if (!shouldAttemptPostgres()) {
    return null;
  }

  const config = getPostgresConfig();
  
  if (!pool) {
    try {
      pool = new pg.Pool(config);
      wrappedPool = new PgPoolAdapter(pool);
      console.log('⚡ PostgreSQL Pool client constructed for:', config.host);
    } catch (err) {
      console.warn('⚠️ Note: Could not construct PostgreSQL Pool client (run Dokploy to connect):', err);
      markPostgresFailure();
      pool = null;
      wrappedPool = null;
    }
  }

  return wrappedPool;
}

let lastTestResult: { connected: boolean; message: string } | null = null;
let lastTestTime = 0;
const CACHE_TEST_MS = 15000;

export async function testPostgresConnection(force: boolean = false): Promise<{ connected: boolean; message: string }> {
  const config = getPostgresConfig();
  if (!config.database || !config.host) {
    return { 
      connected: false, 
      message: 'PostgreSQL environment credentials not configured in .env. Falling back to local/JSON persistence system.' 
    };
  }

  const now = Date.now();
  if (!force && lastTestResult && (now - lastTestTime < CACHE_TEST_MS)) {
    return lastTestResult;
  }

  if (force) {
    isOfflineCached = false;
  }

  try {
    const pgPool = new pg.Pool(config);
    const client = await pgPool.connect();
    try {
      await client.query('SELECT 1 + 1 AS result');
      markPostgresSuccess();
      console.log('✅ Dokploy/PostgreSQL Database tests succeeded fully!');
      const successResult = { 
        connected: true, 
        message: `Successfully connected to PostgreSQL database '${config.database}' on host '${config.host}'.` 
      };
      lastTestResult = successResult;
      lastTestTime = now;
      await client.release();
      await pgPool.end();
      return successResult;
    } catch (err: any) {
      await client.release();
      await pgPool.end();
      throw err;
    }
  } catch (err: any) {
    console.log('ℹ️ PostgreSQL database connection is currently unavailable:', err.message);
    markPostgresFailure();

    const isAISandbox = 
      process.env.K_SERVICE?.includes('ais-dev') || 
      process.env.K_SERVICE?.includes('ais-pre') || 
      process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL?.includes('ais-sandbox') ||
      process.env.APP_URL?.includes('ais-dev') ||
      process.env.APP_URL?.includes('ais-pre') ||
      process.env.DEFAULT_APP_PORT === '3000';

    let extraMsg = '';
    if (isAISandbox && isPrivateHost(config.host)) {
      extraMsg = ` (Note: '${config.host}' is an internal Dokploy Docker network host. Google AI Studio preview sandbox is isolated from your private server network, so this EAI_AGAIN error is fully expected here. Once this container is built and run inside your Dokploy server, it will resolve and connect flawlessly.)`;
    }

    const errorResult = { 
      connected: false, 
      message: `Database connection failed: ${err.message}${extraMsg}` 
    };
    lastTestResult = errorResult;
    lastTestTime = now;
    return errorResult;
  }
}

export async function queryPostgres<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const myPool = getPostgresPool();
  if (!myPool) {
    throw new Error('PostgreSQL Database not configured or connected.');
  }

  try {
    const [rows] = await myPool.execute(sql, params);
    markPostgresSuccess();
    return rows as T[];
  } catch (err) {
    markPostgresFailure();
    throw err;
  }
}
