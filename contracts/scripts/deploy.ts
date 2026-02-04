import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);

  const KnowledgeStorage = await ethers.getContractFactory("KnowledgeStorage");
  const knowledgeStorage = await KnowledgeStorage.deploy();

  await knowledgeStorage.deployed();

  console.log("KnowledgeStorage deployed to:", knowledgeStorage.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

