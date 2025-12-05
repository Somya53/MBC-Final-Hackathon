const hre = require("hardhat");

async function main() {
  const Contract = await hre.ethers.getContractFactory("TaskAutomator");
  const contract = await Contract.deploy();
  await contract.waitForDeployment();

  console.log("TaskAutomator deployed at:", await contract.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
