// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract VeraCruzNFT is ERC721, Ownable, Pausable, ReentrancyGuard {
    using Strings for uint256;
    enum WarrantyState { None, ActiveStandard, ActiveExtended, Expired }
    
    struct WatchData {
        string model;
        string modelCode;
        string dialColor;
        string serialNumber;
        string sku;
        uint256 batchNumber;
        uint256 edition;
        uint256 mintedAt;
        bool warrantyActive;
        uint256 warrantyStart;      // Block timestamp when started
        bool extendedWarranty;      // True if extended
    }
    
    struct TransferRecord {
        address from;
        address to;
        uint256 timestamp;
        string fromNickname;
        string toNickname;
        bool warrantyTransferred;
    }
    
    struct OwnerProfile {
        string nickname;
        uint256 nicknameUpdatedAt;
        bool hasExtendedWarranty;
    }
    
    // State
    uint256 private _nextTokenId = 1;
    uint256 public constant STANDARD_WARRANTY_YEARS = 1;
    uint256 public constant EXTENDED_WARRANTY_YEARS = 2;
    
    mapping(uint256 => WatchData) public watchData;
    mapping(uint256 => TransferRecord[]) public ownershipHistory;
    mapping(address => OwnerProfile) public ownerProfiles;
    mapping(address => uint256[]) public ownerWatches;
    mapping(string => uint256[]) private watchesByDialColor;
    mapping(uint256 => string) private tokenMetadataURI;
    mapping(uint256 => WarrantyState) public warrantyStates;
    string private _baseTokenURI;
    
    // Events
    event WatchMinted(uint256 indexed tokenId, address indexed to, string sku, string modelCode, string dialColor, uint256 batchNumber, uint256 edition);
    event WatchSold(uint256 indexed tokenId, address indexed from, address indexed to, bool extendedWarranty);
    event OwnershipTransferred(uint256 indexed tokenId, address indexed from, address indexed to, string fromNickname, string toNickname, uint256 timestamp);
    event OwnerNicknameUpdated(uint256 indexed tokenId, address indexed owner, string oldNickname, string newNickname);
    event WarrantyStarted(uint256 indexed tokenId, address indexed owner, bool extendedWarranty, uint256 startTime);
    event WarrantyExpired(uint256 indexed tokenId, address indexed formerOwner);
    
    constructor() ERC721("Vera Cruz Alvorada", "VCRZ-ALV") Ownable() {
        _baseTokenURI = "ipfs://bafybeibuiuivphrxhhye3ohgjdyqh54fyapftys73pknnd3fskk7usirfu/";
    }
    
    modifier onlyOwnerOrSelf(uint256 tokenId) {
        require(msg.sender == ownerOf(tokenId) || msg.sender == owner(), "Not owner or contract owner");
        _;
    }
    
    function mintBatch(
        address to,
        string memory serialNumber,
        uint256 dialColor,
        uint256 edition
    ) public onlyOwner whenNotPaused nonReentrant {
        _mintWatch(to, "VR-AL", "Alvorada", "AL", dialColor == 1 ? "AA" : "PR", 1, edition, serialNumber, "");
    }

    function mintWatch(
        address to,
        string memory sku,
        string memory model,
        string memory modelCode,
        string memory dialColor,
        uint256 batchNumber,
        uint256 edition,
        string memory serialNumber,
        string memory metadataURI
    ) public onlyOwner whenNotPaused nonReentrant {
        _mintWatch(to, sku, model, modelCode, dialColor, batchNumber, edition, serialNumber, metadataURI);
    }

    function mintBatch(
        address[] memory recipients,
        string[] memory skus,
        string[] memory models,
        string[] memory modelCodes,
        string[] memory dialColors,
        uint256[] memory batchNumbers,
        uint256[] memory editions,
        string[] memory serialNumbers,
        string[] memory metadataURIs
    ) public onlyOwner whenNotPaused nonReentrant {
        uint256 count = recipients.length;
        require(count > 0, "Empty batch");
        require(
            skus.length == count && models.length == count && modelCodes.length == count && dialColors.length == count &&
            batchNumbers.length == count && editions.length == count && serialNumbers.length == count &&
            metadataURIs.length == count,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < count; i++) {
            _mintWatch(recipients[i], skus[i], models[i], modelCodes[i], dialColors[i], batchNumbers[i], editions[i], serialNumbers[i], metadataURIs[i]);
        }
    }

    function _mintWatch(
        address to,
        string memory sku,
        string memory model,
        string memory modelCode,
        string memory dialColor,
        uint256 batchNumber,
        uint256 edition,
        string memory serialNumber,
        string memory metadataURI
    ) internal {
        require(to != address(0), "Invalid recipient");
        require(bytes(serialNumber).length > 0, "Serial number required");
        require(bytes(sku).length > 0, "SKU required");
        
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        
        WatchData memory data = WatchData({
            model: model,
            modelCode: modelCode,
            dialColor: dialColor,
            serialNumber: serialNumber,
            sku: sku,
            batchNumber: batchNumber,
            edition: edition,
            mintedAt: block.timestamp,
            warrantyActive: false,
            warrantyStart: 0,
            extendedWarranty: false
        });
        
        watchData[tokenId] = data;
        watchesByDialColor[dialColor].push(tokenId);
        
        _safeMint(to, tokenId);
        if (bytes(metadataURI).length > 0) {
            tokenMetadataURI[tokenId] = metadataURI;
        }
        
        emit WatchMinted(tokenId, to, sku, modelCode, dialColor, batchNumber, edition);
    }
    
    function startWarranty(uint256 tokenId, bool extended) public onlyOwner whenNotPaused {
        _startWarranty(tokenId, extended);
    }

    function sellWatch(address buyer, uint256 tokenId, bool extended) public onlyOwner whenNotPaused nonReentrant {
        require(ownerOf(tokenId) == owner(), "Watch is not in treasury");
        address treasury = owner();
        _transfer(treasury, buyer, tokenId);
        _recordTransfer(treasury, buyer, tokenId);
        _startWarranty(tokenId, extended);
        emit WatchSold(tokenId, treasury, buyer, extended);
    }

    function _startWarranty(uint256 tokenId, bool extended) internal {
        require(!watchData[tokenId].warrantyActive, "Warranty already active");
        require(tokenId > 0 && tokenId <= totalSupply(), "Invalid token");
        
        uint256 startTime = block.timestamp;
        warrantyStates[tokenId] = extended ? WarrantyState.ActiveExtended : WarrantyState.ActiveStandard;
        
        watchData[tokenId].warrantyActive = true;
        watchData[tokenId].warrantyStart = startTime;
        watchData[tokenId].extendedWarranty = extended;
        
        // Update owner profile
        address owner = ownerOf(tokenId);
        OwnerProfile storage profile = ownerProfiles[owner];
        profile.hasExtendedWarranty = extended;
        
        emit WarrantyStarted(tokenId, owner, extended, startTime);
    }
    
    function isUnderWarranty(uint256 tokenId) public view returns (bool) {
        require(watchData[tokenId].warrantyActive, "Warranty data not found");
        return warrantyStates[tokenId] != WarrantyState.Expired;
    }
    
    function warrantyExpiry(uint256 tokenId) public view returns (uint256) {
        require(watchData[tokenId].warrantyActive, "Warranty data not found");
        uint256 warrantyYears = watchData[tokenId].extendedWarranty ? EXTENDED_WARRANTY_YEARS : STANDARD_WARRANTY_YEARS;
        return watchData[tokenId].warrantyStart + (warrantyYears * 365 days);
    }
    
    function setOwnerNickname(string memory nickname) public {
        _setOwnerNickname(msg.sender, nickname);
    }

    function setOwnerNicknameFor(address account, string memory nickname) public onlyOwner {
        require(account != address(0), "Invalid account");
        _setOwnerNickname(account, nickname);
    }

    function _setOwnerNickname(address account, string memory nickname) internal {
        require(bytes(nickname).length > 0 && bytes(nickname).length <= 50, "Invalid nickname length");
        OwnerProfile storage profile = ownerProfiles[account];
        string memory oldNickname = profile.nickname;
        profile.nickname = nickname;
        profile.nicknameUpdatedAt = block.timestamp;

        uint256[] memory tokens = ownerWatches[account];
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 tokenId = tokens[i];
            uint256 historyLength = ownershipHistory[tokenId].length;
            if (historyLength == 0) {
                continue;
            }
            ownershipHistory[tokenId][historyLength - 1].toNickname = nickname;
            emit OwnerNicknameUpdated(tokenId, account, oldNickname, nickname);
        }
    }
    
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721) whenNotPaused {
        super.transferFrom(from, to, tokenId);
        _recordTransfer(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721) whenNotPaused {
        super.safeTransferFrom(from, to, tokenId);
        _recordTransfer(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override(ERC721) whenNotPaused {
        super.safeTransferFrom(from, to, tokenId, data);
        _recordTransfer(from, to, tokenId);
    }

    function _recordTransfer(address from, address to, uint256 tokenId) internal {
        TransferRecord memory transfer = TransferRecord({
            from: from,
            to: to,
            timestamp: block.timestamp,
            fromNickname: ownerProfiles[from].nickname,
            toNickname: ownerProfiles[to].nickname,
            warrantyTransferred: true
        });

        ownershipHistory[tokenId].push(transfer);

        emit OwnershipTransferred(tokenId, from, to, ownerProfiles[from].nickname, ownerProfiles[to].nickname, block.timestamp);
    }
    
    function getWatchData(uint256 tokenId) public view returns (WatchData memory) {
        return watchData[tokenId];
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721)
        returns (string memory)
    {
        require(_exists(tokenId), "ERC721: invalid token ID");

        if (bytes(tokenMetadataURI[tokenId]).length > 0) {
            return tokenMetadataURI[tokenId];
        }

        uint256 edition = tokenId <= 25 ? tokenId : tokenId - 25;
        string memory folder = tokenId <= 25 ? "vc_al_aa/aa" : "vc_al_pr/pr";
        string memory editionNumber = edition < 10
            ? string.concat("0", edition.toString())
            : edition.toString();

        return string.concat(_baseURI(), folder, editionNumber, ".json");
    }
    
    function getOwnershipHistory(uint256 tokenId) public view returns (TransferRecord[] memory) {
        return ownershipHistory[tokenId];
    }
    
    function getOwnerNickname(address owner) public view returns (string memory) {
        return ownerProfiles[owner].nickname;
    }
    
    function getWatchesByOwner(address owner) public view returns (uint256[] memory) {
        return ownerWatches[owner];
    }
    
    function totalSupply() public view returns (uint256) {
        return _nextTokenId - 1;
    }
    
    function getWatchesByDialColor(uint256 color) public view returns (uint256[] memory) {
        return watchesByDialColor[color == 1 ? "AA" : "PR"];
    }
    
    function pause() public onlyOwner {
        _pause();
    }
    
    function unpause() public onlyOwner {
        _unpause();
    }
    
    function setBaseURI(string memory newBaseURI) public onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256
    ) internal override whenNotPaused {
        
        // Update ownerWatches mapping
        if (from != address(0)) {
            uint256[] storage fromWatches = ownerWatches[from];
            for(uint256 i = 0; i < fromWatches.length; i++) {
                if(fromWatches[i] == tokenId) {
                    fromWatches[i] = fromWatches[fromWatches.length - 1];
                    fromWatches.pop();
                    break;
                }
            }
        }
        
        if (to != address(0)) {
            ownerWatches[to].push(tokenId);
        }
    }
}