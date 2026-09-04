require("dotenv").config();
const { ethers } = require("ethers");

const CONTRACT_ABI = [
  "function owner() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function watchData(uint256) view returns (string model,string modelCode,string dialColor,string serialNumber,string sku,uint256 batchNumber,uint256 edition,uint256 mintedAt,bool warrantyActive,uint256 warrantyStart,bool extendedWarranty)",
  "function sellWatch(address buyer,uint256 tokenId,bool extended)",
];

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasOption(name) {
  return process.argv.includes(name);
}

function fail(message) {
  console.error(`Erro: ${message}`);
  process.exit(1);
}

async function main() {
  const network = readOption("--network") || "amoy";
  const sku = readOption("--sku");
  const buyer = readOption("--buyer");
  const warranty = readOption("--warranty") || "standard";
  const rpc = network === "amoy" ? process.env.AMOY_URL : process.env.POLYGON_URL;
  const privateKey = network === "amoy" ? process.env.AMOY_PRIVATE_KEY : process.env.POLYGON_PRIVATE_KEY;
  const contractAddress = network === "amoy" ? process.env.AMOY_CONTRACT_ADDRESS : process.env.POLYGON_CONTRACT_ADDRESS;

  if (!sku) fail("informe --sku");
  if (!buyer || !ethers.isAddress(buyer)) fail("informe um --buyer valido");
  if (!['standard', 'extended'].includes(warranty)) fail("--warranty deve ser standard ou extended");
  if (!rpc || !privateKey || !contractAddress || !ethers.isAddress(contractAddress)) {
    fail(`configuracao incompleta para ${network}; verifique URL, chave e endereco do contrato no .env`);
  }
  if (!hasOption("--confirm")) fail("adicione --confirm para autorizar o envio da transacao");

  const provider = new ethers.JsonRpcProvider(rpc);
  const signer = new ethers.Wallet(privateKey, provider);
  const readContract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
  const writeContract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
  const [chain, signerAddress, contractOwner, totalSupply] = await Promise.all([
    provider.getNetwork(),
    signer.getAddress(),
    readContract.owner(),
    readContract.totalSupply(),
  ]);

  const expectedChainId = network === "amoy" ? 80002n : 137n;
  if (chain.chainId !== expectedChainId) fail(`chain ID inesperado: ${chain.chainId}`);
  if (signerAddress.toLowerCase() !== contractOwner.toLowerCase()) fail("a carteira configurada nao e o owner do contrato");

  let tokenId;
  let tokenData;
  for (let id = 1n; id <= totalSupply; id += 1n) {
    const data = await readContract.watchData(id);
    if (data.sku === sku) {
      if (tokenId !== undefined) fail(`SKU duplicado encontrado nos tokens ${tokenId} e ${id}`);
      tokenId = id;
      tokenData = data;
    }
  }

  if (tokenId === undefined) fail(`SKU nao encontrado: ${sku}`);
  if (tokenData.warrantyActive) fail(`o SKU ${sku} ja possui garantia ativa`);

  const currentOwner = await readContract.ownerOf(tokenId);
  if (currentOwner.toLowerCase() !== contractOwner.toLowerCase()) fail(`o token #${tokenId} nao esta na tesouraria`);

  const extended = warranty === "extended";
  const gasEstimate = await writeContract.sellWatch.estimateGas(buyer, tokenId, extended);
  const gasLimit = (gasEstimate * 120n) / 100n;

  console.log(`Rede: ${network} (${chain.chainId})`);
  console.log(`SKU: ${sku}`);
  console.log(`Token: #${tokenId}`);
  console.log(`Comprador: ${buyer}`);
  console.log(`Garantia: ${warranty}`);
  console.log(`Gas estimado: ${gasEstimate}`);
  console.log("Enviando transacao...");

  const transaction = await writeContract.sellWatch(buyer, tokenId, extended, { gasLimit });
  console.log(`Transacao: ${transaction.hash}`);
  const receipt = await transaction.wait();
  console.log(`Confirmada no bloco ${receipt.blockNumber} (status ${receipt.status})`);
}

main().catch((error) => {
  console.error(error.shortMessage || error.message);
  process.exit(1);
});
