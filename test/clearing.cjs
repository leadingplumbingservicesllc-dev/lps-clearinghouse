const assert = require("node:assert/strict");
const { ethers } = require("hardhat");
describe("Assignment lifecycle", function () {
  async function setup() {
    const [admin, contractor, owner, attacker] = await ethers.getSigners();
    const asset = await (await ethers.getContractFactory("TestAsset")).deploy();
    const vault = await (
      await ethers.getContractFactory("LienLiquidityVault")
    ).deploy(asset.target, admin.address);
    const clearing = await (
      await ethers.getContractFactory("MechanicsLienClearing")
    ).deploy(vault.target, admin.address);
    await vault.grantRole(await vault.CLEARING_ROLE(), clearing.target);
    await clearing.grantRole(await clearing.UNDERWRITER_ROLE(), admin.address);
    await clearing.grantRole(await clearing.RESOLVER_ROLE(), admin.address);
    await asset.approve(vault.target, 10000n * 1000000n);
    await vault.deposit(10000n * 1000000n, admin.address);
    return { admin, contractor, owner, attacker, asset, vault, clearing };
  }
  async function verify(s) {
    const terms = ethers.id(
      "Executed, independently verified assignment terms",
    );
    await s.clearing.verifyClaim(
      "palm-beach",
      "20260001",
      "parcel-1",
      1000n * 1000000n,
      s.contractor.address,
      terms,
    );
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const sig = await s.contractor.signTypedData(
      {
        name: "LPS Mechanics Lien Assignment",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: s.clearing.target,
      },
      {
        Assignment: [
          { name: "tokenId", type: "uint256" },
          { name: "termsHash", type: "bytes32" },
          { name: "advance", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { tokenId: 1, termsHash: terms, advance: 930n * 1000000n, deadline },
    );
    return { deadline, sig };
  }
  it("funds exactly once, accounts for illiquidity, settles face value, and burns the claim", async () => {
    const s = await setup();
    const { deadline, sig } = await verify(s);
    const before = await s.vault.totalAssets();
    await s.clearing.fund(1, deadline, sig);
    assert.equal(
      await s.asset.balanceOf(s.contractor.address),
      930n * 1000000n,
    );
    assert.equal(await s.vault.totalAssets(), before);
    assert.equal(await s.vault.maxWithdraw(s.admin.address), 9070n * 1000000n);
    await assert.rejects(s.clearing.fund(1, deadline, sig));
    await s.asset.transfer(s.owner.address, 1000n * 1000000n);
    await s.asset.connect(s.owner).approve(s.vault.target, 1000n * 1000000n);
    await s.clearing.connect(s.owner).resolve(1);
    assert.equal(await s.vault.outstanding(), 0n);
    assert.equal(await s.vault.totalAssets(), before + 70n * 1000000n);
    await assert.rejects(s.clearing.ownerOf(1));
  });
  it("rejects unauthorized claims, duplicate county instruments, and forged signatures", async () => {
    const s = await setup();
    const { deadline } = await verify(s);
    await assert.rejects(
      s.clearing
        .connect(s.attacker)
        .verifyClaim("x", "y", "z", 1000, s.attacker.address, ethers.id("a")),
    );
    await assert.rejects(
      s.clearing.verifyClaim(
        "palm-beach",
        "20260001",
        "other",
        1000,
        s.contractor.address,
        ethers.id("a"),
      ),
    );
    await assert.rejects(s.clearing.fund(1, deadline, "0x"));
    assert.equal(await s.vault.outstanding(), 0n);
    await assert.rejects(
      s.vault.connect(s.attacker).advance(s.attacker.address, 1000),
    );
  });
  it("recognizes losses only with dual pause and resolver authorization", async () => {
    const s = await setup();
    const { deadline, sig } = await verify(s);
    await s.clearing.fund(1, deadline, sig);
    await assert.rejects(s.clearing.writeOff(1, ethers.id("loss")));
    await s.clearing.pause();
    await s.vault.pause();
    await assert.rejects(
      s.clearing.connect(s.attacker).writeOff(1, ethers.id("loss")),
    );
    await s.clearing.writeOff(1, ethers.id("loss"));
    assert.equal(await s.vault.outstanding(), 0n);
    assert.equal(await s.vault.totalAssets(), 9070n * 1000000n);
    assert.equal(await s.vault.maxDeposit(s.admin.address), 0n);
  });
});
