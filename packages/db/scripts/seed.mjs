import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

await client.query(`
  INSERT INTO users (email, username, password_hash, display_name, role)
  VALUES
    ('admin@snackspot.local', 'admin', '$argon2id$seed-placeholder', 'Admin', 'admin')
  ON CONFLICT (email) DO NOTHING
`);

console.log('Seed completed (admin placeholder user)');
await client.end();
