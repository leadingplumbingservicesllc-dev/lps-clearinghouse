const { ethers } = require("hardhat");
async function main() {
  for (const name of ["USDC_ADDRESS", "MULTISIG_ADMIN"])
    if (!process.env[name]) throw new Error(`Missing ${name}`);
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("DEPLOYER_PRIVATE_KEY required");
  const admin = ethers.getAddress(process.env.MULTISIG_ADMIN),
    usdc = ethers.getAddress(process.env.USDC_ADDRESS);
  if ((await ethers.provider.getCode(usdc)) === "0x")
    throw new Error("USDC address has no code");
  const vault = await (
    await ethers.getContractFactory("LienLiquidityVault")
  ).deploy(usdc, deployer.address);
  await vault.waitForDeployment();
  const clearing = await (
    await ethers.getContractFactory("MechanicsLienClearing")
  ).deploy(await vault.getAddress(), admin);
  await clearing.waitForDeployment();
  await (
    await vault.grantRole(
      await vault.CLEARING_ROLE(),
      await clearing.getAddress(),
    )
  ).wait();
  await (await vault.grantRole(await vault.DEFAULT_ADMIN_ROLE(), admin)).wait();
  if (admin !== deployer.address)
    await (
      await vault.renounceRole(
        await vault.DEFAULT_ADMIN_ROLE(),
        deployer.address,
      )
    ).wait();
  console.log(
    JSON.stringify(
      {
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        vault: await vault.getAddress(),
        clearing: await clearing.getAddress(),
        admin,
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
