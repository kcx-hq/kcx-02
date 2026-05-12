import { runDemoSeed } from "./db-demo-seed.js";

async function main(): Promise<void> {
  await runDemoSeed();
}

main().catch((error) => {
  console.error("EC2 demo seed failed:", error);
  process.exitCode = 1;
});
