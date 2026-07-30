import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. First admin user — CHANGE THIS PASSWORD after first login
  const adminEmail = 'admin@benchmarkeng.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
    await prisma.user.create({
      data: {
        name: 'Admin',
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
      },
    });
    console.log(`Created admin user: ${adminEmail} / ChangeMe123! (change this immediately)`);
  }

  // 2. Starter keyword taxonomy — expand freely from the admin UI or by re-running this seed
  const formations = [
    'Permian Basin', 'Bakken', 'Eagle Ford', 'Marcellus', 'Haynesville',
    'Anadarko Basin', 'Denver-Julesburg Basin', 'Barnett Shale', 'Utica Shale', 'Woodford Shale',
  ];

  const rigTypes = [
    'Land Rig', 'Jackup', 'Semi-Submersible', 'Drillship', 'Platform Rig',
    'Workover Rig', 'Coiled Tubing Unit', 'Snubbing Unit',
  ];

  const skills = [
    'Directional Drilling', 'Well Control', 'Mud Logging', 'Reservoir Engineering',
    'Wellsite Geology', 'Completions Engineering', 'Production Engineering', 'HSE Management',
  ];

  const certifications = ['IWCF', 'IADC RigPass', 'API 653', 'H2S Alive', 'NEBOSH'];

  const software = ['Petrel', 'Landmark', 'OpenWells', 'Techlog', 'Eclipse', 'Prosper'];

  const taxonomy: { label: string; type: 'FORMATION' | 'RIG_TYPE' | 'SKILL' | 'CERTIFICATION' | 'SOFTWARE' }[] = [
    ...formations.map((label) => ({ label, type: 'FORMATION' as const })),
    ...rigTypes.map((label) => ({ label, type: 'RIG_TYPE' as const })),
    ...skills.map((label) => ({ label, type: 'SKILL' as const })),
    ...certifications.map((label) => ({ label, type: 'CERTIFICATION' as const })),
    ...software.map((label) => ({ label, type: 'SOFTWARE' as const })),
  ];

  for (const kw of taxonomy) {
    await prisma.keyword.upsert({
      where: { label_type: { label: kw.label, type: kw.type } },
      update: {},
      create: kw,
    });
  }

  console.log(`Seeded ${taxonomy.length} starter keywords.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
