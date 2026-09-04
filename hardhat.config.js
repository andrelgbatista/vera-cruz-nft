require("dotenv").config({ path: process.env.ENV_FILE || ".env" });
require("@nomicfoundation/hardhat-toolbox");

const amoyAccount = process.env.AMOY_PRIVATE_KEY ? [process.env.AMOY_PRIVATE_KEY] : [];
const polygonAccount = process.env.POLYGON_PRIVATE_KEY ? [process.env.POLYGON_PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1
      },
      viaIR: true
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    polygon: {
      url: process.env.POLYGON_URL || "",
      accounts: polygonAccount,
      chainId: 137
    },
    mumbai: {
      url: process.env.MUMBAI_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    amoy: {
      url: process.env.AMOY_URL || "",
      accounts: amoyAccount,
      chainId: 80002
    }
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || ""
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};