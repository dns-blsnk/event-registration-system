import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@ers/shared';

import { loadConfig } from '../../src/config/config.module.js';
import { PasswordService } from '../../src/modules/auth/local/password.service.js';
import { StorageService } from '../../src/modules/storage/storage.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

import { DEMO_EMAILS, generateSeedPlan } from './generate.js';
import { writeSeedPlan } from './write.js';

/** Fixed, so every run builds the same people and events; dates are relative to the day it runs. */
const SEED = 2026;

/**
 * `pnpm db:seed`: fills an empty database with demo data. It refuses to touch a database that
 * already has users, so it can never mix with or overwrite real data; `pnpm db:reset` wipes first.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const password = config.seedDemoPassword;
  if (
    password === undefined ||
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new Error(
      `Set SEED_DEMO_PASSWORD (${String(PASSWORD_MIN_LENGTH)}-${String(PASSWORD_MAX_LENGTH)} characters) to seed the demo accounts`,
    );
  }
  const prisma = new PrismaService(config);
  const storage = new StorageService(config);
  try {
    if ((await prisma.user.count()) > 0) {
      throw new Error('The database already has users; run `pnpm db:reset` to start from scratch');
    }
    const plan = generateSeedPlan({ seed: SEED, now: new Date() });
    const demoPasswordHash = await new PasswordService().hash(password);
    const summary = await writeSeedPlan({ prisma, storage }, { plan, demoPasswordHash });
    // The seed is a CLI tool: printing the summary to the terminal is its output.
    // eslint-disable-next-line no-console -- command-line output
    console.log(
      `Seeded ${JSON.stringify(summary)}. Demo accounts: ${Object.values(DEMO_EMAILS).join(', ')}`,
    );
  } finally {
    await prisma.$disconnect();
    storage.onModuleDestroy();
  }
}

await main();
