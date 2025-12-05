require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");

// Config
const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddress = process.env.TASK_AUTOMATOR_ADDRESS;

// TaskAutomator ABI (simplified for events)
const abi = [
  "event TaskCreated(uint256 taskId, address user, string action)",
  "event TaskExecuted(uint256 taskId, string action)",
  "function tasks(uint256) view returns (address user, uint256 amount, string action, uint256 nextExecution, uint256 interval, bool active)",
  "function runTask(uint256 taskId)"
];

const contract = new ethers.Contract(contractAddress, abi, wallet);

// Circle API config
const CIRCLE_API = "https://api-sandbox.circle.com/v1/payments";
const API_KEY = process.env.CIRCLE_API_KEY;
const ACCOUNT_ID = process.env.CIRCLE_ACCOUNT_ID;

// Listen for new tasks
contract.on("TaskCreated", async (taskId, user, action) => {
  console.log(`New task #${taskId} by ${user}: ${action}`);

  try {
    const task = await contract.tasks(taskId);

    if (task.active && task.amount > 0) {
      // Execute USDC payment via Circle
      await executeUSDC(task.user, task.amount, `Task #${taskId}: ${task.action}`);

      // Call runTask on-chain to mark executed
      const tx = await contract.runTask(taskId);
      await tx.wait();
      console.log(`Task #${taskId} executed successfully.`);
    }
  } catch (err) {
    console.error(`Error handling task #${taskId}:`, err);
  }
});

// Circle payment function
async function executeUSDC(toAddress, amount, description) {
  try {
    const response = await axios.post(
      CIRCLE_API,
      {
        idempotencyKey: `task-${Date.now()}`,
        source: { type: "wallet", id: ACCOUNT_ID },
        amount: { value: (amount / 1e6).toString(), currency: "USD" }, // USDC is 6 decimals
        destination: { type: "blockchain", address: toAddress, chain: "BASE" },
        metadata: { description }
      },
      { headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" } }
    );

    console.log("Circle payment response:", response.data);
    return response.data;
  } catch (err) {
    console.error("Circle payment failed:", err.response?.data || err.message);
  }
}
