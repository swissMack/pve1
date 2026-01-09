/**
 * Create an API client for external mediation systems
 *
 * Usage: node scripts/create-api-client.js
 */

import { createHash, randomBytes } from 'crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });
dotenv.config({ path: join(__dirname, '..', '.env.local'), override: true });

const { Pool } = pg;

// Generate a random API key
function generateApiKey() {
  const prefix = 'mqs_';  // mediation query simulator
  const random = randomBytes(24).toString('base64url');
  return prefix + random;
}

// Hash API key with SHA256
function hashApiKey(apiKey) {
  return createHash('sha256').update(apiKey).digest('hex');
}

async function createApiClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    user: process.env.DATABASE_URL ? undefined : (process.env.DB_USER || 'simportal'),
    password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
    host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST || 'localhost'),
    port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || '5434', 10),
    database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME || 'simcardportal'),
  });

  const SCHEMA = process.env.USE_PUBLIC_SCHEMA === 'true' ? '' : '"sim-card-portal-v2".';

  // Generate API key
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);
  const apiKeyPrefix = apiKey.substring(0, 8);

  console.log('\n========================================');
  console.log('  Creating API Client for Mediation');
  console.log('========================================\n');

  try {
    const result = await pool.query(`
      INSERT INTO ${SCHEMA}api_clients (
        name,
        description,
        api_key_hash,
        api_key_prefix,
        permissions,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, created_at
    `, [
      'MQTT Mediation Simulator',
      '3rd party mediation system for sending usage records',
      apiKeyHash,
      apiKeyPrefix,
      JSON.stringify(['usage:write', 'usage:read', 'sims:read']),
      true
    ]);

    console.log('API Client created successfully!\n');
    console.log('Client ID:', result.rows[0].id);
    console.log('Name:', result.rows[0].name);
    console.log('Created:', result.rows[0].created_at);
    console.log('\n========================================');
    console.log('  YOUR API KEY (save this securely!)');
    console.log('========================================');
    console.log('\n  ' + apiKey + '\n');
    console.log('========================================');
    console.log('\nUse this key in the Mediation tab:');
    console.log('  Connection Settings > API Key\n');

  } catch (error) {
    console.error('Error creating API client:', error.message);
  } finally {
    await pool.end();
  }
}

createApiClient();
