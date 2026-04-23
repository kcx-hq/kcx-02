import path from "node:path";
import { pathToFileURL } from "node:url";
import { Sequelize } from "sequelize";

import { sequelize } from "../src/models/index.js";

type MigrationModule = {
  default?: {
    up?: (queryInterface: ReturnType<typeof sequelize.getQueryInterface>, SequelizeLib: typeof Sequelize) => Promise<void>;
  };
};

const parseMigrationName = (argv: string[]): string | null => {
  for (const rawArg of argv.slice(2)) {
    const arg = String(rawArg ?? "").trim();
    if (!arg) continue;

    if (arg.startsWith("--name=")) {
      const value = arg.slice("--name=".length).trim();
      return value || null;
    }

    if (arg.startsWith("--migration=")) {
      const value = arg.slice("--migration=".length).trim();
      return value || null;
    }
  }

  return null;
};

const printUsage = (): void => {
  console.info(`
Usage:
  npx tsx scripts/run-single-migration.ts --name=<migration-file.ts>

Example:
  npx tsx scripts/run-single-migration.ts --name=20260423120000-sync-model-schema.ts
`);
};

async function main(): Promise<void> {
  const migrationName = parseMigrationName(process.argv);
  if (!migrationName) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (migrationName.includes("..") || migrationName.includes("/") || migrationName.includes("\\")) {
    throw new Error("Invalid migration name. Provide filename only from src/migrations.");
  }

  const migrationPath = path.resolve(process.cwd(), "src", "migrations", migrationName);
  const migrationUrl = pathToFileURL(migrationPath).href;
  const migrationModule = (await import(migrationUrl)) as MigrationModule;
  const migration = migrationModule.default;

  if (!migration || typeof migration.up !== "function") {
    throw new Error(`Migration ${migrationName} does not export default.up`);
  }

  await migration.up(sequelize.getQueryInterface(), Sequelize);
  console.info(`Migration executed successfully: ${migrationName}`);
}

main()
  .catch((error) => {
    console.error(
      "Failed to execute migration:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
