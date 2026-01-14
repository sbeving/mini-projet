import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create Default Admin User
  const adminEmail = 'admin@logchat.io';
  const adminPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'System Admin',
      password: adminPassword,
      role: Role.ADMIN,
      active: true,
    },
  });

  console.log(`✅ Admin user upserted: ${admin.email}`);

  // 2. Create System Security Aletr Rule
  const ruleName = 'System Security Rules';
  
  await prisma.alertRule.upsert({
    where: { 
        // We can't upsert by name directly as it's not unique in schema, 
        // but for seeding we can try to find first. 
        // Since upsert requires unique constraint, we'll use findFirst/create pattern.
        id: 'system-security-rule-default' // Force a known ID if we want, or just check logic below
    }, 
    update: {},
    create: {
        id: 'system-security-rule-default',
        name: ruleName,
        createdById: admin.id,
        condition: 'Pattern Match',
        type: 'SYSTEM',
        severity: 'HIGH',
        isActive: true,
        config: {
            description: 'Default rules for detecting SQLi, XSS, and Brute Force patterns'
        }
    }
  });

  console.log(`✅ Default Alert Rules created`);

  console.log('🌱 Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
