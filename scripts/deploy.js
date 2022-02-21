const { expect } = require("chai");

const main = async () => {
  this.baseTokenURI = "ipfs://QmTFLWHBq6jvs1LX7Zg1sS8GNtmHFnTE2DSxMs2giDqPCe/";
  const nftContractFactory = await hre.ethers.getContractFactory('MegansDolls');
  const nftContract = await nftContractFactory.deploy(this.baseTokenURI);
  const [deployer] = await hre.ethers.getSigners();
  await nftContract.deployed();
  console.log("Contract deployed to:", nftContract.address);
  console.log("deployer address", deployer.address);

  // Call the function.
  let txn = await nftContract.ownerMint(2, deployer.address)
  // Wait for it to be mined.
  await txn.wait()
  console.log("Minted NFT #1 & #2")

  txn = await nftContract.ownerMint(2, deployer.address)
  // Wait for it to be mined.
  await txn.wait()
  console.log("Minted NFT #3 & #4")
  for (let tokenId = 0; tokenId < 4; tokenId++) {
    const exists = await nftContract.exists(0);
    expect(exists).to.be.true;
    const tokenURI = await nftContract.tokenURI(tokenId)
    console.log(`NFT #${tokenId} TokenURI: ${tokenURI}`)
  };
};

const runMain = async () => {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

runMain();