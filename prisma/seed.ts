import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. First admin user - only created on a brand-new install with zero admins yet.
  // Once you've created your own named admin accounts, this is skipped permanently -
  // it won't come back just because you reseed the database.
  const adminEmail = 'admin@benchmarkeng.com';
  const anyAdminExists = await prisma.user.count({ where: { role: 'ADMIN' } });

  if (anyAdminExists === 0) {
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

  // 2. Starter keyword taxonomy — Canadian oil & gas formations, rig types, skills, certs, software
  const formations = [
    // Cretaceous (Mesozoic)
    'Cardium (AB, BC)',
    'Dunvegan (AB, BC)',
    'Viking (AB, SK)',
    'Clearwater (AB)',
    'McMurray / Mannville (AB, SK)',
    'Newcastle / Ashville (MB)',
    // Triassic & Jurassic (Mesozoic)
    'Montney (BC, AB)',
    'Doig (BC, AB)',
    'Halfway (BC, AB)',
    'Charlie Lake (BC, AB)',
    'Baldonnel (BC)',
    'Shaunavon (SK)',
    'Vanguard / Success (SK, MB)',
    // Carboniferous / Mississippian (Paleozoic)
    'Debolt / Prophet (BC, AB)',
    'Turner Valley (AB)',
    'Midale / Frobisher-Alida (SK, MB)',
    'Bakken / Exshaw (SK, AB, MB)',
    'Lodgepole (MB, SK)',
    // Devonian (Paleozoic)
    'Duvernay (AB)',
    'Leduc (AB)',
    'Muskwa / Otter Park / Evie (BC)',
    'Jean Marie (BC)',
    'Swan Hills (AB)',
    'Beaverhill Lake (AB, SK)',
    'Torquay / Three Forks (SK, MB)',
    'Winnipegosis (SK, MB)',
    // Deep exploratory (Cambrian to Ordovician)
    'Red River (SK, MB)',
    'Deadwood (SK, AB)',
    // Catch-all — consultants can select this and elaborate in the comments/notes field
    'Other',
  ];

  const rigTypes = [
    // Drilling rigs (by configuration & mobility)
    'Pad-Walking Rig',
    'Super-Single Rig',
    'Double Rig',
    'Triple Rig',
    'Coiled Tubing Drilling (CTD) Rig',
    'Conventional Slant Rig',
    // Well service and completion rigs
    'Service Rig (Workover Rig)',
    'Snubbing Unit',
    'Coiled Tubing (CT) Intervention Unit',
  ];

  const skills = [
    'Directional Drilling', 'Well Control', 'Mud Logging', 'Reservoir Engineering',
    'Wellsite Geology', 'Completions Engineering', 'Production Engineering', 'HSE Management',
    'Hydraulic Fracturing', 'Coiled Tubing Operations',
    // Recovery methods & well operation types
    'Steam-Assisted Gravity Drainage (SAGD)',
    'Conventional Drilling & Servicing',
    'Unconventional / Non-Conventional Well Operations',
    'Extended Reach Drilling (ERD) / Long-Lateral Horizontals',
    'Cyclic Steam Stimulation (CSS)',
    // High-spec field operations & well control
    'High-Pressure High-Temperature (HPHT)',
    'Managed Pressure Drilling (MPD)',
    'Underbalanced Drilling (UBD)',
    'Multi-Lateral Well Construction',
    'Live Well Workovers',
  ];

  const certifications = ['IWCF', 'IADC RigPass', 'API 653', 'H2S Alive', 'NEBOSH', 'CSTS-09'];

  const software = [
    'Petrel', 'Landmark', 'OpenWells', 'Techlog', 'Eclipse', 'Prosper',
    'PetroSight', 'WellView', 'CMG (Computer Modelling Group)', 'GeoScout',
    'AccuMap', 'Petrinex', 'IHS Enerdeq', 'P2 Energy Solutions', 'OFM (Oilfield Manager)',
    'PipeSim',
  ];

  const taxonomy: { label: string; type: 'FORMATION' | 'RIG_TYPE' | 'SKILL' | 'CERTIFICATION' | 'SOFTWARE' }[] = [
    ...formations.map((label) => ({ label, type: 'FORMATION' as const })),
    ...rigTypes.map((label) => ({ label, type: 'RIG_TYPE' as const })),
    ...skills.map((label) => ({ label, type: 'SKILL' as const })),
    ...certifications.map((label) => ({ label, type: 'CERTIFICATION' as const })),
    ...software.map((label) => ({ label, type: 'SOFTWARE' as const })),
  ];

  // Clean up formation/rig type keywords from an older seed run that aren't in the current
  // lists — only deletes ones with zero consultants/applications tagged, so real data is never touched.
  const staleKeywords = await prisma.keyword.findMany({
    where: {
      OR: [
        { type: 'FORMATION', label: { notIn: formations } },
        { type: 'RIG_TYPE', label: { notIn: rigTypes } },
      ],
    },
    include: { _count: { select: { consultants: true, applications: true } } },
  });
  for (const kw of staleKeywords) {
    if (kw._count.consultants === 0 && kw._count.applications === 0) {
      await prisma.keyword.delete({ where: { id: kw.id } });
    }
  }
  if (staleKeywords.length > 0) {
    console.log(`Cleaned up ${staleKeywords.length} outdated keyword(s) (unused ones only).`);
  }

  for (const kw of taxonomy) {
    await prisma.keyword.upsert({
      where: { label_type: { label: kw.label, type: kw.type } },
      update: {},
      create: kw,
    });
  }

  console.log(`Seeded ${taxonomy.length} starter keywords.`);

  // 3. Starter ticket types (required safety certifications, by discipline)
  // Global "discipline" here is just the default fallback used when a consultant has no
  // client selected - actual per-client requirements (which can differ) are set below.
  // hasExpiry: false means the ticket never expires - it just needs to be on file once,
  // shown as "N/A" instead of an expiry date.
  const ticketTypes: {
    label: string;
    discipline: 'DRILLING' | 'COMPLETIONS' | 'LEASE_CONSTRUCTION' | 'ALL';
    validMonths: number;
    hasExpiry?: boolean;
  }[] = [
    { label: 'H2S Alive', discipline: 'ALL', validMonths: 36 },
    { label: 'Standard First Aid (w/CPR)', discipline: 'ALL', validMonths: 36 },
    { label: 'WHMIS', discipline: 'ALL', validMonths: 36, hasExpiry: false }, // lifetime, per official sheet
    { label: 'Fall Protection', discipline: 'ALL', validMonths: 36 },
    { label: 'Confined Space Entry', discipline: 'ALL', validMonths: 36 },
    { label: 'IADC RigPass', discipline: 'DRILLING', validMonths: 36 },
    { label: 'Well Control (2nd Line, IWCF or IADC)', discipline: 'DRILLING', validMonths: 24 },
    { label: 'CSTS-09', discipline: 'COMPLETIONS', validMonths: 36 },
    { label: 'Pressure Testing Awareness', discipline: 'COMPLETIONS', validMonths: 24 },
    { label: "Class 5 Driver's License", discipline: 'ALL', validMonths: 60 },
    { label: "Driver's Abstract", discipline: 'ALL', validMonths: 12 },
    { label: 'Fit for Work', discipline: 'ALL', validMonths: 12, hasExpiry: false }, // lifetime, per official sheet
    { label: 'Drug and Alcohol Testing (13 Panel)', discipline: 'ALL', validMonths: 12, hasExpiry: false }, // lifetime, per official sheet
    { label: 'Transportation of Dangerous Goods (TDG)', discipline: 'ALL', validMonths: 36 },
    { label: "Well Servicing BOP's", discipline: 'COMPLETIONS', validMonths: 60 },
    { label: "Coiled Tubing Well Servicing BOP's", discipline: 'COMPLETIONS', validMonths: 60 },
    { label: 'Detection and Control of Flammable Substances', discipline: 'COMPLETIONS', validMonths: 36, hasExpiry: false }, // lifetime, per official sheet
    { label: 'Ground Disturbance Level II', discipline: 'ALL', validMonths: 36 },
    { label: 'ATV Certification', discipline: 'ALL', validMonths: 36 },
    { label: 'Defensive Driving', discipline: 'ALL', validMonths: 36 },
    { label: 'Safety Leadership for H&S / Safety Management Regulatory Awareness', discipline: 'ALL', validMonths: 36 },
    // New additions
    { label: 'First Line Supervisor Blowout Prevention', discipline: 'DRILLING', validMonths: 24 },
    { label: 'Common Safety Orientation', discipline: 'ALL', validMonths: 36, hasExpiry: false },
    { label: 'ICS-100', discipline: 'ALL', validMonths: 36, hasExpiry: false },
    { label: 'Certificate of Insurance', discipline: 'ALL', validMonths: 12 },
  ];

  for (const tt of ticketTypes) {
    await prisma.ticketType.upsert({
      where: { label: tt.label },
      update: { discipline: tt.discipline, validMonths: tt.validMonths, hasExpiry: tt.hasExpiry ?? true },
      create: { label: tt.label, discipline: tt.discipline, validMonths: tt.validMonths, hasExpiry: tt.hasExpiry ?? true },
    });
  }

  // Clean up ticket types from earlier seed runs that got renamed/replaced (e.g. "Driver's
  // License" -> "Class 5 Driver's License") - only removes ones with zero tickets attached.
  const canonicalLabels = ticketTypes.map((t) => t.label);
  const staleTicketTypes = await prisma.ticketType.findMany({
    where: { label: { notIn: canonicalLabels } },
    include: { _count: { select: { tickets: true } } },
  });
  for (const tt of staleTicketTypes) {
    if (tt._count.tickets === 0) {
      await prisma.ticketType.delete({ where: { id: tt.id } });
    }
  }
  if (staleTicketTypes.length > 0) {
    console.log(`Cleaned up ${staleTicketTypes.length} outdated ticket type(s) (unused ones only).`);
  }

  console.log(`Seeded ${ticketTypes.length} starter ticket types.`);

  // 4. Starter list of major Western Canadian oil & gas companies (AB, BC, SK, MB) - just the
  // company names for now, with no specific ticket requirements set. Set each one's exact
  // requirements anytime from Admin > Clients (same as we did for Cenovus below).
  const westernCanadaOilGasCompanies = [
    // Major integrated producers
    'Suncor Energy',
    'Canadian Natural Resources (CNRL)',
    'Imperial Oil',
    'ConocoPhillips Canada',
    // Mid-size & intermediate producers
    'Ovintiv',
    'ARC Resources',
    'Tourmaline Oil',
    'Crescent Point Energy',
    'Whitecap Resources',
    'Baytex Energy',
    'Vermilion Energy',
    'Paramount Resources',
    'NuVista Energy',
    'Peyto Exploration & Development',
    'Birchcliff Energy',
    'Enerplus',
    'Athabasca Oil',
    'MEG Energy',
    'Cardinal Energy',
    'Obsidian Energy',
    'Kelt Exploration',
    'Advantage Energy',
    'Crew Energy',
    'Journey Energy',
    'Surge Energy',
    'Gear Energy',
    'InPlay Oil',
    'Petrus Resources',
  ];

  for (const name of westernCanadaOilGasCompanies) {
    await prisma.clientCompany.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`Seeded ${westernCanadaOilGasCompanies.length} Western Canadian oil & gas companies.`);

  // 5. Cenovus Energy - exact on-boarding requirements per discipline, from their
  // official requirements sheet.
  const cenovus = await prisma.clientCompany.upsert({
    where: { name: 'Cenovus' },
    update: {},
    create: { name: 'Cenovus' },
  });

  const cenovusRequirements: { label: string; discipline: 'DRILLING' | 'COMPLETIONS' | 'LEASE_CONSTRUCTION' | 'ALL' }[] = [
    // Pre-contract requirements (both disciplines)
    { label: 'Drug and Alcohol Testing (13 Panel)', discipline: 'ALL' },
    { label: 'Fit for Work', discipline: 'ALL' },
    { label: "Driver's Abstract", discipline: 'ALL' },
    // Required training / certifications
    { label: 'Well Control (2nd Line, IWCF or IADC)', discipline: 'DRILLING' },
    { label: 'Standard First Aid (w/CPR)', discipline: 'ALL' },
    { label: 'H2S Alive', discipline: 'ALL' },
    { label: 'Transportation of Dangerous Goods (TDG)', discipline: 'ALL' },
    { label: 'WHMIS', discipline: 'ALL' },
    { label: "Class 5 Driver's License", discipline: 'ALL' },
    { label: "Well Servicing BOP's", discipline: 'COMPLETIONS' },
    { label: "Coiled Tubing Well Servicing BOP's", discipline: 'COMPLETIONS' },
    { label: 'Detection and Control of Flammable Substances', discipline: 'COMPLETIONS' },
    { label: 'Ground Disturbance Level II', discipline: 'COMPLETIONS' },
    { label: 'Confined Space Entry', discipline: 'COMPLETIONS' },
    // Note: ATV Certification, Defensive Driving, and Safety Leadership for H&S / Safety
    // Management Regulatory Awareness are on Cenovus's sheet but marked as not required
    // for either discipline, so they're intentionally left out here.
  ];

  // Clear any previous placeholder requirements for Cenovus, then set the exact list
  await prisma.clientTicketRequirement.deleteMany({ where: { clientId: cenovus.id } });

  for (const req of cenovusRequirements) {
    const ticketType = await prisma.ticketType.findUnique({ where: { label: req.label } });
    if (!ticketType) continue;
    await prisma.clientTicketRequirement.create({
      data: { clientId: cenovus.id, ticketTypeId: ticketType.id, discipline: req.discipline },
    });
  }

  console.log(`Set ${cenovusRequirements.length} exact requirements for Cenovus.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

