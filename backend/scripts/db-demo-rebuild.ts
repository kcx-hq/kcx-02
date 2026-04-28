// @ts-nocheck
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Sequelize } from "sequelize";
import { activateDemoDbEnv } from "./demo-db-utils.js";
import { runDemoSeed } from "./db-demo-seed.js";
import { runDemoReset } from "./db-demo-reset.js";

type MigrationModule = {
  default?: {
    up?: (queryInterface: any, SequelizeLib: typeof Sequelize) => Promise<void>;
  };
};

async function runMigrationFile(migrationName: string): Promise<void> {
  const { sequelize } = await import("../src/models/index.js");

  try {
    const migrationPath = path.resolve(process.cwd(), "src", "migrations", migrationName);
    const migrationUrl = pathToFileURL(migrationPath).href;
    const migrationModule = (await import(migrationUrl)) as MigrationModule;
    const migration = migrationModule.default;

    if (!migration?.up) {
      throw new Error(`Migration ${migrationName} does not export default.up`);
    }

    await migration.up(sequelize.getQueryInterface(), Sequelize);
  } finally {
    await sequelize.close();
  }
}

async function main(): Promise<void> {
  activateDemoDbEnv();
  await runDemoReset();

  await runMigrationFile("20260428183000-create-full-schema-from-models.ts");
  await runDemoSeed();

  console.info("Demo DB rebuild completed");
}

main().catch((error) => {
  console.error("Demo DB rebuild failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
