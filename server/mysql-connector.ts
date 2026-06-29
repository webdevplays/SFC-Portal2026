import mysql from 'mysql2/promise';

/**
 * Saint Francis Clinic - MySQL Database Connector for Dokploy / Docker Hosting
 */

let pool: mysql.Pool | null = null;
let isConnected = false;
let lastAttemptTime = 0;
let isOfflineCached = false;
const RETRY_COOLDOWN_MS = 60000; // 60 seconds cooldown before trying to connect again if it failed

export const getMySQLConfig = () => {
  // -----------------------------------------------------------------------------
  // 💾 DOKPLOY DATABASE CREDENTIALS (FALLBACK ENGINE)
  // If your Dokploy container environment variables fail to load correctly from the
  // Environment Setup, fill in your actual MySQL database credentials here.
  // -----------------------------------------------------------------------------
  const CPANEL_FALLBACK_HOST = 'localhost';             // In Dokploy, local test is localhost or container service host
  const CPANEL_FALLBACK_USER = '';                      // Enter your database user here
  const CPANEL_FALLBACK_PASSWORD = '';                  // Enter your database password here
  const CPANEL_FALLBACK_DB = '';                        // Enter your database name here
  const CPANEL_FALLBACK_PORT = '3306';                  // MySQL port number (standard 3306)

  // Dokploy, Coolify, and other Docker-based hosting platforms often inject standard connection URLs/URIs
  const connectionUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_PRIVATE_URL || '';
  
  let parsedUrlConfig: {
    host?: string;
    user?: string;
    password?: string;
    database?: string;
    port?: number;
  } = {};

  if (connectionUrl && (connectionUrl.startsWith('mysql://') || connectionUrl.startsWith('mysql2://'))) {
    try {
      // Safely parse MySQL URI
      const cleanUrl = connectionUrl.replace(/^mysql2?:\/\//, '');
      const [authAndHost, dbPart] = cleanUrl.split('/');
      const [auth, hostAndPort] = authAndHost.includes('@') ? authAndHost.split('@') : ['', authAndHost];
      
      const [user, password] = auth.includes(':') ? auth.split(':').map(decodeURIComponent) : [auth, ''];
      const [host, portStr] = hostAndPort.includes(':') ? hostAndPort.split(':') : [hostAndPort, '3306'];
      
      const dbName = dbPart ? dbPart.split('?')[0] : '';
      
      parsedUrlConfig = {
        host: host || undefined,
        user: user || undefined,
        password: password || undefined,
        database: dbName || undefined,
        port: portStr ? parseInt(portStr, 10) : undefined
      };
      console.log('🔗 Successfully parsed MySQL Connection URL from environment variables for deployment.');
    } catch (urlErr: any) {
      console.warn('⚠️ Warning: Failed to parse MySQL connection URL, falling back to individual environment variables:', urlErr.message);
    }
  }

  // Support multiple common environment variable naming standards across cPanel, Dokploy, Heroku, Coolify, etc.
  const host = parsedUrlConfig.host || 
               process.env.DB_HOST || 
               process.env.MYSQL_HOST || 
               process.env.MYSQLHOST || 
               CPANEL_FALLBACK_HOST;
               
  const user = parsedUrlConfig.user || 
               process.env.DB_USER || 
               process.env.MYSQL_USER || 
               process.env.MYSQLUSER || 
               CPANEL_FALLBACK_USER;
               
  const password = parsedUrlConfig.password !== undefined ? parsedUrlConfig.password : (
                   process.env.DB_PASSWORD || 
                   process.env.MYSQL_PASSWORD || 
                   process.env.MYSQLPASSWORD || 
                   CPANEL_FALLBACK_PASSWORD
                 );
                 
  const database = parsedUrlConfig.database || 
                   process.env.DB_NAME || 
                   process.env.DB_DATABASE || 
                   process.env.MYSQL_DATABASE || 
                   process.env.MYSQLDATABASE || 
                   CPANEL_FALLBACK_DB;
                   
  const rawPort = parsedUrlConfig.port ? String(parsedUrlConfig.port) : (
                  process.env.DB_PORT || 
                  process.env.MYSQL_PORT || 
                  process.env.MYSQLPORT || 
                  CPANEL_FALLBACK_PORT
                );

  return {
    host,
    user,
    password,
    database,
    port: parseInt(rawPort, 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000 // 5 seconds connect timeout to fail-fast if MySQL is unreachable or lagging
  };
};

export function shouldAttemptMySQL(): boolean {
  const config = getMySQLConfig();
  if (!config.database || !config.host) {
    return false;
  }

  // In our development sandbox container running on AI Studio, 
  // any connection to raw local 'localhost' or '127.0.0.1' is guaranteed to fail
  // with ECONNREFUSED since no MySQL runs on the development runner itself.
  //
  // We disable localhost connections inside the AI Studio development container
  // to avoid spammy logs and connection failures, but keep them fully enabled
  // in the user's live production environments (like Dokploy or GCP Cloud SQL) where
  // a local MySQL database or proxy is expected and correctly configured.
  const isAISandbox = 
    process.env.K_SERVICE?.includes('ais-dev') || 
    process.env.K_SERVICE?.includes('ais-pre') || 
    process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL?.includes('ais-sandbox') ||
    process.env.APP_URL?.includes('ais-dev') ||
    process.env.APP_URL?.includes('ais-pre');

  if (isAISandbox && (config.host === 'localhost' || config.host === '127.0.0.1')) {
    return false;
  }

  if (isOfflineCached) {
    const now = Date.now();
    if (now - lastAttemptTime < RETRY_COOLDOWN_MS) {
      return false; // Skip to avoid blocking requests when MySQL is offline
    }
  }
  return true;
}

export function markMySQLSuccess() {
  isOfflineCached = false;
  isConnected = true;
}

export function markMySQLFailure() {
  if (!isOfflineCached) {
    isOfflineCached = true;
    lastAttemptTime = Date.now();
  }
  isConnected = false;
}

/**
 * Initializes and retrieves the MySQL connection pool
 */
export function getMySQLPool(): mysql.Pool | null {
  if (!shouldAttemptMySQL()) {
    return null;
  }

  const config = getMySQLConfig();
  
  if (!pool) {
    try {
      pool = mysql.createPool(config);
      console.log('⚡ MySQL Pool client constructed for:', config.host);
    } catch (err) {
      console.warn('⚠️ Note: Could not construct MySQL Pool client (run Dokploy to connect):', err);
      markMySQLFailure();
      pool = null;
    }
  }

  return pool;
}

let lastTestResult: { connected: boolean; message: string } | null = null;
let lastTestTime = 0;
const CACHE_TEST_MS = 15000; // Cache connection check for 15 seconds to prevent memory/CPU overhead on server

/**
 * Tests connection to MySQL and logs state details. Supports force parameter to bypass cache.
 */
export async function testMySQLConnection(force: boolean = false): Promise<{ connected: boolean; message: string }> {
  const config = getMySQLConfig();
  if (!config.database || !config.host) {
    return { 
      connected: false, 
      message: 'MySQL environment credentials not configured in .env. Falling back to local/JSON persistence system.' 
    };
  }

  const now = Date.now();
  if (!force && lastTestResult && (now - lastTestTime < CACHE_TEST_MS)) {
    return lastTestResult;
  }

  if (force) {
    // Clear offline cache for manual test request
    isOfflineCached = false;
  }

  let myPool: mysql.Pool | null = null;
  try {
    if (!pool) {
      pool = mysql.createPool(config);
    }
    myPool = pool;
  } catch (err: any) {
    markMySQLFailure();
    const failureResult = {
      connected: false,
      message: `Database connection configuration failed: ${err.message}`
    };
    lastTestResult = failureResult;
    lastTestTime = now;
    return failureResult;
  }

  try {
    const connection = await myPool.getConnection();
    try {
      // Execute simple query to test connection integrity
      await connection.query('SELECT 1 + 1 AS result');
      markMySQLSuccess();
      console.log('✅ Dokploy/MySQL Database tests succeeded fully!');
      const successResult = { 
        connected: true, 
        message: `Successfully connected to database '${process.env.DB_NAME}' on host '${process.env.DB_HOST}'.` 
      };
      lastTestResult = successResult;
      lastTestTime = now;
      return successResult;
    } finally {
      connection.release();
    }
  } catch (err: any) {
    console.log('ℹ️ MySQL database connection is currently unavailable:', err.message);
    markMySQLFailure();
    const errorResult = { 
      connected: false, 
      message: `Database connection failed: ${err.message}` 
    };
    lastTestResult = errorResult;
    lastTestTime = now;
    return errorResult;
  }
}

/**
 * Custom wrappers showing how standard CRUD updates are made with type-safety
 */
export async function queryMySQL<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const myPool = getMySQLPool();
  if (!myPool) {
    throw new Error('MySQL Database not configured or connected.');
  }

  try {
    const [rows] = await myPool.execute(sql, params);
    markMySQLSuccess();
    return rows as T[];
  } catch (err) {
    markMySQLFailure();
    throw err;
  }
}
