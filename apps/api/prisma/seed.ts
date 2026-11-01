import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Local development bootstrap.
 *
 * Creates (or updates) a single administrator account from env-provided
 * credentials, plus a handful of clearly-fictional demo products so the
 * storefront has something to display out of the box.
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

  // Demo category + products so the storefront has content to display locally.
  const category = await prisma.category.upsert({
    where: { slug: 'hoodies' },
    update: {},
    create: { name: 'Hoodies', slug: 'hoodies' },
  });

  const demoProducts = [
    {
      sku: 'PK-HOOD-001',
      name: 'Oversized Hoodie',
      description: 'Heavyweight cotton oversized hoodie built for layering. Demo product for local development.',
      price: 59900,
      originalPrice: 69900,
      colors: ['Black', 'Charcoal'],
      sizes: ['S', 'M', 'L', 'XL'],
      images: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800'],
    },
    {
      sku: 'PK-TEE-001',
      name: 'Mountain Tee',
      description: 'Breathable graphic tee with mountain print. Demo product for local development.',
      price: 32900,
      originalPrice: null,
      colors: ['Sand', 'Olive'],
      sizes: ['S', 'M', 'L'],
      images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800'],
    },
  ];

  for (const p of demoProducts) {
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (existing) continue;

    await prisma.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        description: p.description,
        price: p.price,
        originalPrice: p.originalPrice,
        categoryId: category.id,
        isActive: true,
        colors: JSON.stringify(p.colors),
        sizes: JSON.stringify(p.sizes),
        images: {
          create: p.images.map((url, index) => ({ url, alt: p.name, order: index })),
        },
      },
    });
  }

  console.log('✅ Demo category and products seeded (skipped any that already exist)');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
