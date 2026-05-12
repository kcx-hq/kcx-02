// @ts-nocheck
import { activateDemoDbEnv } from "./demo-db-utils.js";

export async function runDemoReset(): Promise<void> {
  const demoDb = activateDemoDbEnv();
  const { sequelize } = await import("../src/models/index.js");

  try {
    await sequelize.authenticate();
    await sequelize.query("DROP SCHEMA IF EXISTS public CASCADE;");
    await sequelize.query("CREATE SCHEMA public;");
    console.info("Demo DB schema reset completed", {
      source: demoDb.source,
    });
  } finally {
    await sequelize.close();
  }
}

async function main(): Promise<void> {
  await runDemoReset();
}

main().catch((error) => {
  console.error("Demo DB reset failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
