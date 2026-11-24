import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding NITECHSPARK Mail database...');

  // Create domains
  const domain1 = await prisma.domain.upsert({
    where: { domainName: 'nitechspark.site' },
    update: {},
    create: {
      domainName: 'nitechspark.site',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    },
  });

  const domain2 = await prisma.domain.upsert({
    where: { domainName: 'nskgroups.website' },
    update: {},
    create: {
      domainName: 'nskgroups.website',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    },
  });

  // Create admin user
  const adminPasswordHash = await argon2.hash('Admin@NITECHSPARK2024!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@nitechspark.site' },
    update: {},
    create: {
      email: 'admin@nitechspark.site',
      displayName: 'NITECHSPARK Admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  // Create admin mail account
  await prisma.mailAccount.upsert({
    where: { emailAddress: 'admin@nitechspark.site' },
    update: {},
    create: {
      userId: adminUser.id,
      domainId: domain1.id,
      emailAddress: 'admin@nitechspark.site',
      displayName: 'NITECHSPARK Admin',
      mailboxQuota: BigInt(10737418240), // 10GB
    },
  });

  // Create test user
  const userPasswordHash = await argon2.hash('User@NITECHSPARK2024!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const testUser = await prisma.user.upsert({
    where: { email: 'nithyananthan@nskgroups.website' },
    update: {},
    create: {
      email: 'nithyananthan@nskgroups.website',
      displayName: 'Nithyananthan N',
      passwordHash: userPasswordHash,
      role: 'USER',
      status: 'ACTIVE',
    },
  });

  // Create user mail account
  await prisma.mailAccount.upsert({
    where: { emailAddress: 'nithyananthan@nskgroups.website' },
    update: {},
    create: {
      userId: testUser.id,
      domainId: domain2.id,
      emailAddress: 'nithyananthan@nskgroups.website',
      displayName: 'Nithyananthan N',
      mailboxQuota: BigInt(5368709120), // 5GB
    },
  });

  // Create email settings for users
  await prisma.emailSettings.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      timezone: 'Asia/Kolkata',
      language: 'en',
      theme: 'dark',
    },
  });

  await prisma.emailSettings.upsert({
    where: { userId: testUser.id },
    update: {},
    create: {
      userId: testUser.id,
      timezone: 'Asia/Kolkata',
      language: 'en',
      theme: 'dark',
    },
  });

  // Create default signature for test user
  await prisma.emailSignature.create({
    data: {
      userId: testUser.id,
      name: 'Default',
      content: `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <strong>Nithyananthan N</strong><br>
  Founder &amp; CEO<br>
  <strong>NITECHSPARK</strong><br>
  Cybersecurity &amp; IT Infrastructure<br>
  <a href="mailto:nithyananthan@nskgroups.website">nithyananthan@nskgroups.website</a>
</div>`,
      isHtml: true,
      isDefault: true,
    },
  });

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Default accounts created:');
  console.log('  Admin: admin@nitechspark.site / Admin@NITECHSPARK2024!');
  console.log('  User:  nithyananthan@nskgroups.website / User@NITECHSPARK2024!');
  console.log('');
  console.log('⚠️  CHANGE THESE PASSWORDS IMMEDIATELY IN PRODUCTION!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
