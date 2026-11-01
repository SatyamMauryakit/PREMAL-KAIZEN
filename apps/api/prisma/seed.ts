import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Local development bootstrap.
 *
 * Creates (or updates) a single administrator account from env-provided
 * credentials. No demo products/categories - create real ones through
 * the admin panel.
 *
 * Credentials come from apps/api/.env (ADMIN_EMAIL / ADMIN_PASSWORD) and are
 * never logged. This script is safe to re-run - it upserts rather than
 * duplicating records.
 */
async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set in apps/api/.env before seeding.'
    );
  }

  if (adminPassword.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: { role: 'admin', isActive: true, password: hashedPassword },
    create: {
      email: adminEmail.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      emailVerified: new Date(),
      isActive: true,
    },
  });

  console.log(`✅ Admin account ready: ${admin.email} (role: ${admin.role})`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
