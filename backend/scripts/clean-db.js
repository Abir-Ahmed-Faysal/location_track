const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  console.log('Cleaning database...');
  await prisma.latestLocation.deleteMany({});
  await prisma.locationEvent.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('✅ Database cleaned successfully! All tables truncated.');
  await prisma.$disconnect();
}

clean().catch((e) => {
  console.error('Error cleaning database:', e);
  process.exit(1);
});
