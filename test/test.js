const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require('merkletreejs');
const { soliditySha3 } = require("web3-utils");

const keccak256 = require('keccak256');

describe('MegansDolls', function () {
  beforeEach(async function () {
    this.MegansDolls = await ethers.getContractFactory('MegansDolls');
    this.baseTokenURI = "ipfs://QmTFLWHBq6jvs1LX7Zg1sS8GNtmHFnTE2DSxMs2giDqPCe/";
    this.megansdolls = await this.MegansDolls.deploy(this.baseTokenURI);
    await this.megansdolls.deployed();
  });

  context('Test with no minted tokens', async function () {
    it('has 0 totalSupply', async function () {
      const supply = await this.megansdolls.totalSupply();
      expect(supply).to.equal(0);
    });

    it('All Constant parameters are properly set', async function () {
      expect(await this.megansdolls.price()).to.be.equal(ethers.utils.parseEther("0.04"));
      expect(await this.megansdolls.collectionSize()).to.be.equal(8888);
      expect(await this.megansdolls.reserves()).to.be.equal(100);
      expect(await this.megansdolls.maxBatchSize()).to.be.equal(5);
      expect(await this.megansdolls.saleState()).to.be.equal(0);
    });

  });

  context('Test before setting saleState', async function () {
    beforeEach(async function () {
      const [owner, addr1] = await ethers.getSigners();
      this.owner = owner;
      this.addr1 = addr1;
    });
   
    it('Test publicSaleMint()', async function () {
      const amount1 = ethers.utils.parseEther("0.04")
      const tx = await this.megansdolls.connect(this.addr1).publicSaleMint;
      expect(tx(1, {value: amount1})).to.be.revertedWith(
        'Sale must be active to mint.'
      );
    });

    describe('Test ownerMint()', async function () {
      it('owner cant mint beyond maxBatchSize', async function () {
        const tx = await this.megansdolls.connect(this.owner).ownerMint;
        expect(tx(6, this.addr1.address)).to.be.revertedWith(
          'Cannot mint this many.'
        );
      });

      it('owner mints for free', async function () {
        await this.megansdolls.connect(this.owner).ownerMint(5, this.addr1.address);
        const numOfMints = await this.megansdolls.numberMinted(this.addr1.address)
        expect(numOfMints).to.be.equal(5)
      });
    });
  });

  context('with minted tokens', async function () {
    beforeEach(async function () {
      const [owner, addr1, addr2, addr3] = await ethers.getSigners();
      this.owner = owner;
      this.addr1 = addr1;
      this.addr2 = addr2;
      this.addr3 = addr3;
      await this.megansdolls['setSaleState(uint256)'](2);
      const amount1 = ethers.utils.parseEther("0.04")
      const amount2 = ethers.utils.parseEther("0.08")
      const amount3 = ethers.utils.parseEther("0.12")
      await this.megansdolls.connect(this.addr1).publicSaleMint(1, {value: amount1});
      await this.megansdolls.connect(this.addr2).publicSaleMint(2, {value: amount2});
      await this.megansdolls.connect(this.addr3).publicSaleMint(3, {value: amount3});
    });
    

    describe('Exists', async function () {
      it('verifies valid tokens', async function () {
        for (let tokenId = 0; tokenId < 6; tokenId++) {
          const exists = await this.megansdolls.exists(tokenId);
          expect(exists).to.be.true;
        }
      });

      it("verifies invalid tokens", async function () {
        const exists = await this.megansdolls.exists(6);
        expect(exists).to.be.false;
      });

      it("verifies tokens URI's", async function () {
        for (let tokenId = 0; tokenId < 6; tokenId++) {
          const tokenURI = await this.megansdolls.tokenURI(tokenId)
          expect(tokenURI).to.be.equal(this.baseTokenURI + tokenId.toString());
        }
      });
    });

  });

  context('Testing Private Sale', async function () {
    beforeEach(async function () {
      const [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();
      this.owner = owner;
      this.addr1 = addr1;
      this.addr2 = addr2;
      this.addr3 = addr3;
      this.addr4 = addr4;

      const hashFunc = function(item) {
        itemSha3 = soliditySha3(item[0], item[1])
        return itemSha3;
      }

      const whitelistAddresses = [
        [this.addr1.address, "1"],
        ["0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", 2],
        [this.addr3.address, "3"],
        [this.addr4.address, "4"]
      ];
    

      this.leafNodes = whitelistAddresses.map(addr => hashFunc(addr));
      const merkleTree = new MerkleTree(this.leafNodes, keccak256, { sortPairs: true});
      this.rootHash = merkleTree.getHexRoot();


      this.hexProof1 = merkleTree.getHexProof(this.leafNodes[0]);
      this.hexProof2 = merkleTree.getHexProof(this.leafNodes[1]);
      this.hexProof3 = merkleTree.getHexProof(this.leafNodes[2]);
      this.hexProof4 = merkleTree.getHexProof(this.leafNodes[3]);

      await this.megansdolls.setMerkleRoot(this.rootHash);
    });

    it('Testing types and abi.encodePacked Solidity vs JavaScript', async function () {
      const hashtest = "0xaa5b0493f6586511770cf7f209d5081ac0c99b2e43b33045962259fcfbca5529"
      expect(this.leafNodes[1].toString('Hex')).to.be.equal(hashtest);
    });

    it('Check merkle root is set', async function () {
      const quantity = 1;
      const allowance = 1;
      const amount = ethers.utils.parseEther("0.04")
      const merkleRoot = this.megansdolls.merkleRoot();
      expect(await merkleRoot).to.be.equal(this.rootHash);
    });
    
    it('Addr1 tries minting before state set to minting', async function () {
      const quantity = 1;
      const allowance = 1;
      const amount = ethers.utils.parseEther("0.04")
      const tx = await this.megansdolls.connect(this.addr1).privateSaleMint;
      expect(tx(quantity, allowance, this.hexProof1, {value: amount})).to.be.revertedWith(
        "Presale must be active to mint."
      );
    });

    it('Addr2 tries minting after state set to private mint', async function () {
      const quantity = 3;
      const allowance = 3;
      const amount = ethers.utils.parseEther("0.12")
      await this.megansdolls.setSaleState(1);
      await this.megansdolls.connect(this.addr3).privateSaleMint(quantity, allowance, this.hexProof3, {value: amount});
      expect(await this.megansdolls.numberMinted(this.addr3.address)).to.be.equal(3)
    });

    it("Test token uri's after private sale", async function () {
      const quantity = 4;
      const allowance = 4;
      const amount = ethers.utils.parseEther("0.16")
      await this.megansdolls.setSaleState(1);
      await this.megansdolls.connect(this.addr4).privateSaleMint(quantity, allowance, this.hexProof4, {value: amount});
      for (let tokenId = 0; tokenId < allowance; tokenId++) {
        let exists = await this.megansdolls.exists(tokenId);
        expect(exists).to.be.true;
        let test0URI = this.baseTokenURI + tokenId.toString();
        expect(await this.megansdolls.tokenURI(tokenId)).to.be.equal(test0URI)
      };
    });

  });

  context('Testing Public Sale', async function () {
    beforeEach(async function () {
      const [owner, addr1, addr2] = await ethers.getSigners();
      this.owner = owner;
      this.addr1 = addr1;
      this.addr2 = addr2;

    });
    
    it('Addr1 tries minting after state set to public mint', async function () {
      const quantity = 3;
      const amount = ethers.utils.parseEther("0.12")
      await this.megansdolls.setSaleState(2);
      await this.megansdolls.connect(this.addr1).publicSaleMint(quantity, {value: amount});
      expect(await this.megansdolls.numberMinted(this.addr1.address)).to.be.equal(3)
    });
    

  });

});