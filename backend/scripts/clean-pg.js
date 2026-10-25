const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/locationtrack',
});

async function run() {
  await client.connect();
  console.log('Cleaning PostgreSQL database tables...');
  await client.query('TRUNCATE TABLE "LatestLocation", "LocationEvent", "Device", "User" CASCADE;');
  console.log('✅ Database cleaned successfully! All tables truncated.');
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
