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
      expect(watchData.dialColor).to.equal("AA");
      expect(watchData.edition).to.equal(1);
    });

    it("Should mint a batch with individual metadata URIs", async function () {
      await veraCruzNFT["mintBatch(address[],string[],string[],string[],string[],uint256[],uint256[],string[],string[])"](
        [buyer.address, buyer.address],
        ["VR-AL-AA-01001", "VR-AL-AA-01002"],
        ["Alvorada", "Alvorada"],
        ["AL", "AL"],
        ["AA", "AA"],
        [1, 1],
        [1, 2],
        ["VR-AL-AA-01001", "VR-AL-AA-01002"],
        ["ipfs://metadata/aa01.json", "ipfs://metadata/aa02.json"]
      );

      expect(await veraCruzNFT.totalSupply()).to.equal(2);
      expect(await veraCruzNFT.tokenURI(2)).to.equal("ipfs://metadata/aa02.json");
    });

    it("Should map token IDs to Pinata metadata paths", async function () {
      for (let edition = 1; edition <= 25; edition++) {
        await veraCruzNFT.mintBatch(
          buyer.address,
          `VR-AL-AA-01${String(edition).padStart(3, "0")}`,
          1,
          edition
        );
      }
      await veraCruzNFT.mintBatch(buyer.address, "VR-AL-PR-01001", 0, 1);

      expect(await veraCruzNFT.tokenURI(1)).to.equal(
        "ipfs://bafybeibuiuivphrxhhye3ohgjdyqh54fyapftys73pknnd3fskk7usirfu/vc_al_aa/aa01.json"
      );
      expect(await veraCruzNFT.tokenURI(25)).to.equal(
        "ipfs://bafybeibuiuivphrxhhye3ohgjdyqh54fyapftys73pknnd3fskk7usirfu/vc_al_aa/aa25.json"
      );
      expect(await veraCruzNFT.tokenURI(26)).to.equal(
        "ipfs://bafybeibuiuivphrxhhye3ohgjdyqh54fyapftys73pknnd3fskk7usirfu/vc_al_pr/pr01.json"
      );
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

    it("Should allow future collections beyond the first 50 NFTs", async function () {
      for (let i = 1; i <= 51; i++) {
        await veraCruzNFT.mintBatch(
          buyer.address,
          `VR-AL-AA-01${String(i).padStart(3, "0")}`,
          1,
          i
        );
      }

      expect(await veraCruzNFT.totalSupply()).to.equal(51);
    });
  });

  describe("Warranty", function () {
    beforeEach(async function () {
      await veraCruzNFT.mintBatch(
        admin.address,
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

    it("Should sell a treasury watch and activate its warranty", async function () {
      await veraCruzNFT.connect(admin).sellWatch(buyer.address, 1, false);

      expect(await veraCruzNFT.ownerOf(1)).to.equal(buyer.address);
      expect(await veraCruzNFT.isUnderWarranty(1)).to.be.true;
      expect((await veraCruzNFT.getOwnershipHistory(1)).length).to.equal(1);
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

  describe("Access control", function () {
    beforeEach(async function () {
      await veraCruzNFT.mintBatch(
        admin.address,
        "VR-AL-AA-01001",
        1,
        1
      );
    });

    it("Should restrict minting and warranty changes to the contract owner", async function () {
      await expect(
        veraCruzNFT.connect(buyer).mintBatch(
          buyer.address,
          "VR-AL-AA-01002",
          1,
          2
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        veraCruzNFT.connect(buyer).startWarranty(1, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        veraCruzNFT.connect(buyer).sellWatch(buyer.address, 1, false)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should restrict administrative configuration to the contract owner", async function () {
      await expect(veraCruzNFT.connect(buyer).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await expect(veraCruzNFT.connect(buyer).unpause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await expect(
        veraCruzNFT.connect(buyer).setBaseURI("ipfs://attacker/")
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(
        veraCruzNFT.connect(buyer).transferOwnership(alias1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(veraCruzNFT.connect(buyer).renounceOwnership()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should allow only the NFT owner to transfer it", async function () {
      await expect(
        veraCruzNFT.connect(buyer).transferFrom(admin.address, alias1.address, 1)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");

      await veraCruzNFT
        .connect(admin)
        .transferFrom(admin.address, alias1.address, 1);
      expect(await veraCruzNFT.ownerOf(1)).to.equal(alias1.address);
    });

    it("Should allow the contract owner to register a buyer nickname", async function () {
      await veraCruzNFT.setOwnerNicknameFor(buyer.address, "Rafa");
      expect(await veraCruzNFT.getOwnerNickname(buyer.address)).to.equal("Rafa");

      await expect(
        veraCruzNFT.connect(buyer).setOwnerNicknameFor(alias1.address, "Unauthorized")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});