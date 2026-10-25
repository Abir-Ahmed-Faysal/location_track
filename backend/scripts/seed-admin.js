const { Client } = require('pg');
const bcrypt = require('bcrypt');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/locationtrack',
});

async function run() {
  await client.connect();
  const email = 'fr.abir.ahmed.faysal@gmail.com';
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 12);

  await client.query(`
    INSERT INTO "User" (id, email, password, role, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), $1, $2, 'ADMIN', NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET password = $2, role = 'ADMIN';
  `, [email, passwordHash]);

  console.log('✅ Admin user created/updated successfully:', email);
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
