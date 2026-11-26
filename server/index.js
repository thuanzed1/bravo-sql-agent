import express from 'express';
import cors from 'cors';
import { testConnection, listDatabases, executeQuery, getEngineConfig } from './sqlEngine.js';
import { fetchLiveSchema, invalidateSchemaCache } from './schemaService.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Active connection state in memory
let currentConfig = getEngineConfig({
  server: process.env.SQL_SERVER || 'localhost',
  database: process.env.SQL_DATABASE || 'Quan_Ly_Kho_Hang',
  authMode: process.env.SQL_AUTH_MODE || 'windows',
  user: process.env.SQL_USER || '',
  password: process.env.SQL_PASSWORD || ''
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BRAVO SQL Agent Backend Server',
    port: PORT,
    database: currentConfig.database,
    server: currentConfig.server
  });
});

// Test connection
app.get('/api/db/status', async (req, res) => {
  const result = await testConnection(currentConfig);
  res.json({
    ...result,
    activeConfig: {
      server: currentConfig.server,
      database: currentConfig.database,
      authMode: currentConfig.authMode
    }
  });
});

// List available databases on SQL Server instance
app.get('/api/db/databases', async (req, res) => {
  const databases = await listDatabases(currentConfig);
  res.json({ databases });
});

// Switch active database or update connection
app.post('/api/db/config', async (req, res) => {
  const { server, database, authMode, user, password } = req.body;
  if (server) currentConfig.server = server;
  if (database && database !== currentConfig.database) {
    currentConfig.database = database;
    invalidateSchemaCache();
  }
  if (authMode) currentConfig.authMode = authMode;
  if (user !== undefined) currentConfig.user = user;
  if (password !== undefined) currentConfig.password = password;

  const test = await testConnection(currentConfig);
  res.json({
    success: test.success,
    message: test.message,
    activeConfig: {
      server: currentConfig.server,
      database: currentConfig.database,
      authMode: currentConfig.authMode
    }
  });
});

// Fetch live schema directly from SQL Server
app.get('/api/db/schema', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const schema = await fetchLiveSchema(currentConfig, forceRefresh);
    res.json(schema);
  } catch (err) {
    res.status(500).json({
      error: err.message,
      databaseName: currentConfig.database
    });
  }
});

// Execute arbitrary SQL query on SQL Server
app.post('/api/db/execute', async (req, res) => {
  const { sql, database } = req.body;
  if (!sql || !sql.trim()) {
    return res.status(400).json({
      status: 'error',
      errorMessage: 'Câu lệnh SQL không được để trống.'
    });
  }

  const runConfig = database ? { ...currentConfig, database } : currentConfig;
  const result = await executeQuery(sql, runConfig);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`[BRAVO SQL Backend] Server running at http://localhost:${PORT}`);
  console.log(`[BRAVO SQL Backend] Target SQL Server: ${currentConfig.server} | Database: [${currentConfig.database}]`);
});
