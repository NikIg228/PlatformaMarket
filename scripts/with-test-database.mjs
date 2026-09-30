import { spawn } from "node:child_process";
import { localDatabaseProfile, databaseLabel } from "./lib/local-database-profile.mjs";
import { assertPortsAvailable } from "./lib/local-readiness.mjs";

const { testDatabaseUrl } = localDatabaseProfile();
const args = process.argv.slice(2);
if (!process.env.npm_execpath || !args.length) throw new Error("Use npm run db:test -- run <verification-script>.");
// The legacy E2E config reuses occupied ports. Never let that silently attach
// database-writing tests to the user's dev API or frontend.
if (args.some(arg => arg === "e2e" || arg.startsWith("e2e:"))) await assertPortsAvailable([3000, 3001, 3002, 3003, 4012]);
console.log(`Isolated test database: ${databaseLabel(testDatabaseUrl)}`);
const child = spawn(process.execPath, [process.env.npm_execpath, ...args], {
  env: { ...process.env, DATABASE_URL: testDatabaseUrl, POSTGRES_TEST_DATABASE_URL: testDatabaseUrl }, stdio: "inherit", windowsHide: true,
});
child.once("error", () => { console.error("Could not start the test command."); process.exitCode = 1; });
child.once("exit", code => { process.exitCode = code ?? 1; });
