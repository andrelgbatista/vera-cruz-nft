require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("ethers");

const ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function owner() view returns (address)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
  "function watchData(uint256) view returns (string model,string modelCode,string dialColor,string serialNumber,string sku,uint256 batchNumber,uint256 edition,uint256 mintedAt,bool warrantyActive,uint256 warrantyStart,bool extendedWarranty)",
  "function warrantyStates(uint256) view returns (uint8)",
  "function warrantyExpiry(uint256) view returns (uint256)",
  "function getOwnerNickname(address) view returns (string)",
];

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message) {
  console.error(`Erro: ${message}`);
  process.exit(1);
}

function csvValue(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function main() {
  const network = readOption("--network") || "amoy";
  const outputDirectory = readOption("--output") || "output";
  const rpc = network === "amoy" ? process.env.AMOY_URL : process.env.POLYGON_URL;
  const contractAddress = readOption("--contract") || (network === "amoy" ? process.env.AMOY_CONTRACT_ADDRESS : process.env.POLYGON_CONTRACT_ADDRESS);

  if (!rpc || !contractAddress || !ethers.isAddress(contractAddress)) {
    fail(`configuracao incompleta para ${network}; informe o endereco do contrato no .env ou com --contract`);
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const contract = new ethers.Contract(contractAddress, ABI, provider);
  const chain = await provider.getNetwork();
  const expectedChainId = network === "amoy" ? 80002n : 137n;
  if (chain.chainId !== expectedChainId) fail(`chain ID inesperado: ${chain.chainId}`);

  const [name, symbol, totalSupply, contractOwner, block] = await Promise.all([
    contract.name(),
    contract.symbol(),
    contract.totalSupply(),
    contract.owner(),
    provider.getBlock("latest"),
  ]);
  const reportTimestamp = Number(block.timestamp);
  const tokens = [];

  for (let tokenId = 1n; tokenId <= totalSupply; tokenId += 1n) {
    const [data, tokenOwner, tokenURI, warrantyState] = await Promise.all([
      contract.watchData(tokenId),
      contract.ownerOf(tokenId),
      contract.tokenURI(tokenId),
      contract.warrantyStates(tokenId),
    ]);
    const nickname = await contract.getOwnerNickname(tokenOwner);
    const hasWarranty = data.warrantyActive;
    const expiry = hasWarranty ? await contract.warrantyExpiry(tokenId) : 0n;
    const currentlyValid = hasWarranty && warrantyState !== 3n && expiry > BigInt(reportTimestamp);
    const warrantyType = !hasWarranty ? "none" : data.extendedWarranty ? "extended" : "standard";
    const warrantyStatus = !hasWarranty ? "Não iniciada" : currentlyValid ? "Vigente" : "Expirada";

    tokens.push({
      tokenId: Number(tokenId),
      sku: data.sku,
      serialNumber: data.serialNumber,
      owner: tokenOwner,
      buyerNickname: nickname,
      warranty: warrantyType,
      warrantyState: ["none", "standard", "extended", "expired"][Number(warrantyState)] || "unknown",
      warrantyActive: hasWarranty,
      warrantyCurrentlyValid: currentlyValid,
      warrantyStatus,
      warrantyStart: hasWarranty ? Number(data.warrantyStart) : null,
      warrantyExpiry: hasWarranty ? Number(expiry) : null,
      warrantyExpiryDate: hasWarranty ? new Date(Number(expiry) * 1000).toISOString() : null,
      tokenURI,
    });
  }

  fs.mkdirSync(outputDirectory, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    chainId: Number(chain.chainId),
    network,
    contract: contractAddress,
    contractOwner,
    collection: { name, symbol, totalSupply: Number(totalSupply) },
    block: { number: block.number, timestamp: reportTimestamp },
    tokens,
  };
  const csvHeader = ["tokenId", "sku", "serialNumber", "owner", "buyerNickname", "warranty", "warrantyState", "warrantyStatus", "warrantyActive", "warrantyCurrentlyValid", "warrantyStart", "warrantyExpiry", "warrantyExpiryDate", "tokenURI"];
  const csv = [csvHeader, ...tokens.map(token => csvHeader.map(field => csvValue(token[field])))].map(row => row.join(",")).join("\n") + "\n";
  fs.writeFileSync(path.join(outputDirectory, `token-status-${network}.json`), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDirectory, `token-status-${network}.csv`), csv);

  console.log(`Relatorio JSON: ${path.join(outputDirectory, `token-status-${network}.json`)}`);
  console.log(`Relatorio CSV: ${path.join(outputDirectory, `token-status-${network}.csv`)}`);
  console.log(`Tokens consultados: ${tokens.length}`);
}

main().catch(error => {
  console.error(error.shortMessage || error.message);
  process.exit(1);
});
