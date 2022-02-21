// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

// Contract by METACANNY.eth (@METACANNY)

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./ERC721A.sol";

contract MegansDolls is Ownable, ERC721A, ReentrancyGuard {
	string _baseTokenURI;
	uint256 public price = 0.04 ether;
	uint256 public immutable collectionSize = 8888;
	uint256 public immutable reserves = 100;
	uint256 public immutable maxBatchSize = 5;
	uint256 public saleState = 0;

	bytes32 public merkleRoot;
	mapping(address => uint256) public addressToMinted;

	constructor(string memory baseTokenURI) ERC721A("Megans Dolls", "MGD") {
		_baseTokenURI = baseTokenURI;
	}

	modifier callerIsUser() {
		require(tx.origin == msg.sender, "The caller is another contract.");
		_;
	}

	function privateSaleMint(
		uint256 quantity,
		uint256 allowance,
		bytes32[] calldata proof
	) public payable callerIsUser {
		require(saleState > 0, "Presale must be active to mint.");
    require(totalSupply() + quantity <= collectionSize - reserves, "Exceeds max supply.");
		require(
			_verify(_leaf(_msgSender(), allowance), proof),
			"Invalid Merkle Tree proof supplied."
		);
		require(addressToMinted[_msgSender()] + quantity <= allowance, "Exceeds whitelist supply.");
		require(quantity * price == msg.value, "Invalid funds provided.");

		addressToMinted[_msgSender()] += quantity;
		_safeMint(msg.sender, quantity);
		refundIfOver(price * quantity);
	}

	function publicSaleMint(uint256 quantity) external payable callerIsUser {
		require(saleState > 1, "Sale must be active to mint.");
		require(totalSupply() + quantity <= collectionSize - reserves, "Exceeds max supply.");
		require(numberMinted(msg.sender) + quantity <= maxBatchSize, "Cannot mint this many.");
		require(quantity * price == msg.value, "Invalid funds provided.");
		_safeMint(msg.sender, quantity);
		refundIfOver(price * quantity);
	}

	function ownerMint(uint256 quantity, address reciever) external onlyOwner {
		require(totalSupply() + quantity <= collectionSize, "Exceeds max supply.");
		require(quantity <= maxBatchSize, "Cannot mint this many.");
		_safeMint(reciever, quantity);
	}

	function refundIfOver(uint256 _price) private {
		require(msg.value >= _price, "Need to send more ETH.");
		if (msg.value > _price) {
			payable(msg.sender).transfer(msg.value - _price);
		}
	}

	function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
		merkleRoot = _merkleRoot;
	}

	function setPrice(uint256 _newPrice) public onlyOwner {
		price = _newPrice;
	}
  

	function setSaleState(uint256 _saleState) public onlyOwner {
		saleState = _saleState;
	}

	function _leaf(address payload, uint256 allowance) internal pure returns (bytes32) {
    // https://blog.8bitzen.com/posts/18-03-2019-keccak-abi-encodepacked-with-javascript/
		return keccak256(abi.encodePacked(payload, allowance));
	}

	function _verify(bytes32 leaf, bytes32[] memory proof) internal view returns (bool) {
		return MerkleProof.verify(proof, merkleRoot, leaf);
	}

	function getAllowance(uint256 allowance, bytes32[] calldata proof)
		public
		view
		returns (uint256)
	{
		require(_verify(_leaf(_msgSender(), allowance), proof), "Invalid Merkle Tree proof supplied.");
		return allowance;
	}

	function _baseURI() internal view virtual override returns (string memory) {
		return _baseTokenURI;
	}

	function setBaseURI(string calldata baseURI) external onlyOwner {
		_baseTokenURI = baseURI;
	}

	function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
		if (!_exists(tokenId)) revert URIQueryForNonexistentToken();

        string memory baseURI = _baseURI();
        return bytes(baseURI).length != 0 ? string(abi.encodePacked(baseURI, Strings.toString(tokenId), ".json")) : '';
	}

	function withdrawMoney() external onlyOwner nonReentrant {
		(bool success, ) = msg.sender.call{ value: address(this).balance }("");
		require(success, "Transfer failed.");
	}

	function numberMinted(address owner) public view returns (uint256) {
		return _numberMinted(owner);
	}

	function getOwnershipData(uint256 tokenId) external view returns (TokenOwnership memory) {
		return ownershipOf(tokenId);
	}

  function exists(uint256 tokenId) public view returns (bool) {
    return _exists(tokenId);
  }
}