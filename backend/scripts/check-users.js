const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5433/locationtrack',
});

async function check() {
  await client.connect();
  const res = await client.query('SELECT id, email, role FROM "User";');
  console.log(res.rows);
  await client.end();
}

check().catch(console.error);
