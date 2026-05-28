import 'reflect-metadata';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/datasource';
import { env } from '../config/env';
import { Holiday } from '../entities/Holiday';
import { Resource } from '../entities/Resource';
import { User, UserRole } from '../entities/User';

type SeedUser = {
  email: string;
  password: string;
  role: UserRole;
};

type SeedResource = {
  name: string;
  type: string;
  description: string;
  allowOutsideHours: boolean;
  allowWeekendsAndHolidays: boolean;
};

type SeedHoliday = {
  date: string;
  name: string;
};

const SEED_RESOURCES: SeedResource[] = [
  {
    name: 'Meeting Room A',
    type: 'meeting_room',
    description: 'Standard meeting room, working hours only.',
    allowOutsideHours: false,
    allowWeekendsAndHolidays: false,
  },
  {
    name: 'Company Vehicle 1',
    type: 'vehicle',
    description: 'Company car, may be booked on weekends and holidays.',
    allowOutsideHours: false,
    allowWeekendsAndHolidays: true,
  },
  {
    name: '3D Printer',
    type: 'equipment',
    description: 'Shared 3D printer; bookable outside working hours.',
    allowOutsideHours: true,
    allowWeekendsAndHolidays: false,
  },
];

const SEED_HOLIDAYS: SeedHoliday[] = [
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2027-01-01', name: "New Year's Day" },
];

const upsertUser = async (input: SeedUser): Promise<void> => {
  const repo = AppDataSource.getRepository(User);
  const existing = await repo.findOne({ where: { email: input.email } });
  if (existing) {
    console.info(`user ${input.email} already exists, skipping`);
    return;
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  await repo.save(repo.create({ email: input.email, passwordHash, role: input.role }));
  console.info(`seeded ${input.role.toLowerCase()} ${input.email}`);
};

const upsertResource = async (input: SeedResource): Promise<void> => {
  const repo = AppDataSource.getRepository(Resource);
  const existing = await repo.findOne({ where: { name: input.name } });
  if (existing) {
    console.info(`resource "${input.name}" already exists, skipping`);
    return;
  }
  await repo.save(repo.create(input));
  console.info(`seeded resource "${input.name}"`);
};

const upsertHoliday = async (input: SeedHoliday): Promise<void> => {
  const repo = AppDataSource.getRepository(Holiday);
  const existing = await repo.findOne({ where: { date: input.date } });
  if (existing) {
    console.info(`holiday ${input.date} already exists, skipping`);
    return;
  }
  await repo.save(repo.create(input));
  console.info(`seeded holiday ${input.date} (${input.name})`);
};

const run = async (): Promise<void> => {
  await AppDataSource.initialize();
  try {
    await upsertUser({
      email: env.ADMIN_SEED_EMAIL,
      password: env.ADMIN_SEED_PASSWORD,
      role: UserRole.ADMIN,
    });
    await upsertUser({
      email: env.USER_SEED_EMAIL,
      password: env.USER_SEED_PASSWORD,
      role: UserRole.USER,
    });
    for (const resource of SEED_RESOURCES) {
      await upsertResource(resource);
    }
    for (const holiday of SEED_HOLIDAYS) {
      await upsertHoliday(holiday);
    }
    console.info('seed complete');
  } finally {
    await AppDataSource.destroy();
  }
};

run().catch((err) => {
  console.error('seed failed', err);
  process.exit(1);
});
