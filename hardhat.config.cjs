require("dotenv/config");
require("@nomicfoundation/hardhat-ethers");
const { subtask } = require("hardhat/config");
const {
  TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD,
} = require("hardhat/builtin-tasks/task-names");
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(
  async ({ solcVersion }, _, runSuper) => {
    if (solcVersion === "0.8.38")
      return {
        compilerPath: require.resolve("solc/soljson.js"),
        isSolcJs: true,
        version: solcVersion,
        longVersion: require("solc").version(),
      };
    return runSuper();
  },
);
module.exports = {
  solidity: {
    version: "0.8.38",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
  },
  networks: process.env.RPC_URL
    ? {
        configured: {
          url: process.env.RPC_URL,
          accounts: process.env.DEPLOYER_PRIVATE_KEY
            ? [process.env.DEPLOYER_PRIVATE_KEY]
            : [],
        },
      }
    : {},
};
