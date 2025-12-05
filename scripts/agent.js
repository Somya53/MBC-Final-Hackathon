require("dotenv").config();

const { ethers } = require("ethers");
const path = require("path");

const {
  BASE_SEPOLIA_RPC_URL,
  PRIVATE_KEY,
  CONTRACT_ADDRESS,
  POLL_INTERVAL_MS,
} = process.env;

if (!BASE_SEPOLIA_RPC_URL) throw new Error("Missing BASE_SEPOLIA_RPC_URL in .env");
if (!PRIVATE_KEY) throw new Error("Missing PRIVATE_KEY in .env");
if (!CONTRACT_ADDRESS) throw new Error("Missing CONTRACT_ADDRESS in .env");

const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const artifactPath = path.join(
  __dirname,
  "..",
  "baseflow",
  "artifacts",
  "contracts",
  "TaskAutomator.sol",
  "TaskAutomator.json"
);
const artifact = require(artifactPath);
const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, provider);
const runner = contract.connect(wallet);

let isRunning = false;

async function scanAndRun() {
  if (isRunning) return; // prevent overlapping loops
  isRunning = true;
  try {
    const now = Math.floor(Date.now() / 1000);
    const total = Number(await contract.taskCount());
    console.log(`[agent] checking ${total} tasks at ${now}`);

    for (let id = 1; id <= total; id++) {
      const task = await contract.tasks(id);
      if (!task.active) continue;

      const next = Number(task.nextExecution);
      if (now < next) continue; // not ready yet

      console.log(`[agent] running task #${id} (${task.action})`);
      try {
        const tx = await runner.runTask(id);
        console.log(`[agent] submitted tx ${tx.hash}`);
        await tx.wait();
        console.log(`[agent] confirmed task #${id}`);
      } catch (err) {
        console.error(`[agent] task #${id} failed`, err.reason || err.message);
      }
    }
  } catch (err) {
    console.error("[agent] scan failed", err.message);
  } finally {
    isRunning = false;
  }
}

async function main() {
  console.log(
    `[agent] starting for contract ${CONTRACT_ADDRESS} with wallet ${wallet.address}`
  );
  await scanAndRun();
  const intervalMs = Number(POLL_INTERVAL_MS || 15000);
  setInterval(scanAndRun, intervalMs);
}

main().catch((err) => {
  console.error("[agent] fatal error", err);
  process.exit(1);
});
