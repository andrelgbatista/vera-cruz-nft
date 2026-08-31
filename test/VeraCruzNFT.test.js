const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VeraCruzNFT", function () {
  let veraCruzNFT;
  let admin;
  let buyer;
  let alias1;
  let alias2;

  beforeEach(async function () {
    [admin, buyer, alias1, alias2] = await ethers.getSigners();
    const VeraCruzNFT = await ethers.getContractFactory("VeraCruzNFT");
    veraCruzNFT = await VeraCruzNFT.deploy();
    await veraCruzNFT.waitForDeployment();
  });

  describe("Minting", function () {
    it("Should mint first NFT with correct data", async function () {
      await veraCruzNFT.mintBatch(
        buyer.address,
        "VR-AL-AA-01001",
        1,
        1
      );
      
      expect(await veraCruzNFT.totalSupply()).to.equal(1);
      const watchData = await veraCruzNFT.getWatchData(1);
      expect(watchData.serialNumber).to.equal("VR-AL-AA-01001");
      expect(watchData.dialColor).to.equal(1);
      expect(watchData.edition).to.equal(1);
    });

    it("Should mint all 50 NFTs", async function () {
      for (let i = 1; i <= 50; i++) {
        await veraCruzNFT.mintBatch(
          buyer.address,
          `VR-AL-AA-01${i.toString().padStart(3, '0')}`,
          0,
          i
        );
      }
      expect(await veraCruzNFT.totalSupply()).to.equal(50);
    });

    it("Should not mint beyond max supply", async function () {
      for (let i = 1; i <= 50; i++) {
        await veraCruzNFT.mintBatch(
          buyer.address,
          `VR-AL-AA-${String(i).padStart(5, '0')}`,
          0,
          i
        );
      }

      await expect(
        veraCruzNFT.mintBatch(
          buyer.address,
          "VR-AL-AA-00051",
          0,
          51
        )
      ).to.be.revertedWith("Max supply reached");

      expect(await veraCruzNFT.totalSupply()).to.equal(50);
    });
  });

  describe("Warranty", function () {
    beforeEach(async function () {
      await veraCruzNFT.mintBatch(
        buyer.address,
        "VR-AL-AA-01001",
        1,
        1
      );
    });

    it("Should start standard warranty", async function () {
      await veraCruzNFT.startWarranty(1, false);
      expect(await veraCruzNFT.isUnderWarranty(1)).to.be.true;
    });

    it("Should start extended warranty", async function () {
      await veraCruzNFT.startWarranty(1, true);
      expect(await veraCruzNFT.isUnderWarranty(1)).to.be.true;
    });

    it("Should not start warranty twice", async function () {
      await veraCruzNFT.startWarranty(1, false);
      await expect(veraCruzNFT.startWarranty(1, false)).to.be.revertedWith("Warranty already active");
    });

    it("Should check warranty expiry", async function () {
      await veraCruzNFT.startWarranty(1, false);
      const expiry = await veraCruzNFT.warrantyExpiry(1);
      expect(expiry).to.be.gt(0);
    });
  });

  describe("Ownership & Aliases", function () {
    beforeEach(async function () {
      await veraCruzNFT.mintBatch(
        buyer.address,
        "VR-AL-AA-01001",
        1,
        1
      );
    });

    it("Should set owner nickname", async function () {
      await veraCruzNFT.connect(buyer).setOwnerNickname("RelogioLover");
      const nickname = await veraCruzNFT.getOwnerNickname(buyer.address);
      expect(nickname).to.equal("RelogioLover");
    });

    it("Should transfer NFT and record history", async function () {
      await veraCruzNFT.connect(buyer).transferFrom(buyer.address, alias1.address, 1);

      const history = await veraCruzNFT.getOwnershipHistory(1);
      expect(history.length).to.equal(1);
      expect(history[0].from).to.equal(buyer.address);
      expect(history[0].to).to.equal(alias1.address);
      expect(history[0].warrantyTransferred).to.be.true;
    });

    it("Should update nickname for the current owner in the transfer history", async function () {
      await veraCruzNFT.connect(buyer).setOwnerNickname("RelogioLover");
      await veraCruzNFT.connect(buyer).transferFrom(buyer.address, alias1.address, 1);

      await veraCruzNFT.connect(alias1).setOwnerNickname("NovoApelido");

      const history = await veraCruzNFT.getOwnershipHistory(1);
      expect(history[0].toNickname).to.equal("NovoApelido");
      expect(await veraCruzNFT.getOwnerNickname(alias1.address)).to.equal("NovoApelido");
    });
  });
});