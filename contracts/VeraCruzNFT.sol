// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract VeraCruzNFT is ERC721URIStorage, Ownable, Pausable, ReentrancyGuard {
    
    enum DialColor { Black, AuroraBlue }
    enum WarrantyState { None, ActiveStandard, ActiveExtended, Expired }
    
    struct WatchData {
        string model;
        string brand;
        string caseMaterial;
        string caseDiameter;
        string crystalType;
        string movementType;
        string caliber;
        string strap;
        string waterResistance;
        DialColor dialColor;
        string serialNumber;
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
    uint256 public constant MAX_SUPPLY = 50;
    uint256 public constant STANDARD_WARRANTY_YEARS = 1;
    uint256 public constant EXTENDED_WARRANTY_YEARS = 2;
    
    mapping(uint256 => WatchData) public watchData;
    mapping(uint256 => TransferRecord[]) public ownershipHistory;
    mapping(address => OwnerProfile) public ownerProfiles;
    mapping(address => uint256[]) public ownerWatches;
    mapping(DialColor => uint256[]) public watchesByDialColor;
    mapping(uint256 => WarrantyState) public warrantyStates;
    
    // Events
    event WatchMinted(uint256 indexed tokenId, address indexed to, string serialNumber, DialColor dialColor, uint256 edition);
    event OwnershipTransferred(uint256 indexed tokenId, address indexed from, address indexed to, string fromNickname, string toNickname, uint256 timestamp);
    event OwnerNicknameUpdated(uint256 indexed tokenId, address indexed owner, string oldNickname, string newNickname);
    event WarrantyStarted(uint256 indexed tokenId, address indexed owner, bool extendedWarranty, uint256 startTime);
    event WarrantyExpired(uint256 indexed tokenId, address indexed formerOwner);
    
    constructor() ERC721("Vera Cruz Alvorada", "VCRZ-ALV") Ownable(msg.sender) {}
    
    modifier onlyOwnerOrSelf(uint256 tokenId) {
        require(msg.sender == ownerOf(tokenId) || msg.sender == owner(), "Not owner or contract owner");
        _;
    }
    
    function mintBatch(
        address to,
        string memory serialNumber,
        DialColor dialColor,
        uint256 edition
    ) public onlyOwner whenNotPaused nonReentrant {
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");
        require(to != address(0), "Invalid recipient");
        require(bytes(serialNumber).length > 0, "Serial number required");
        
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        
        WatchData memory data = WatchData({
            model: "Alvorada",
            brand: "Vera Cruz",
            caseMaterial: "316L Stainless Steel",
            caseDiameter: "40mm",
            crystalType: "Sapphire Crystal",
            movementType: "Quartz",
            caliber: "Miyota 2115",
            strap: "Solid Stainless Steel President Style",
            waterResistance: "5 ATM",
            dialColor: dialColor,
            serialNumber: serialNumber,
            edition: edition,
            mintedAt: block.timestamp,
            warrantyActive: false,
            warrantyStart: 0,
            extendedWarranty: false
        });
        
        watchData[tokenId] = data;
        watchesByDialColor[dialColor].push(tokenId);
        
        _safeMint(to, tokenId);
        
        emit WatchMinted(tokenId, to, serialNumber, dialColor, edition);
    }
    
    function startWarranty(uint256 tokenId, bool extended) public onlyOwner whenNotPaused {
        require(watchData[tokenId].warrantyActive == false, "Warranty already active");
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
        uint256 years = watchData[tokenId].extendedWarranty ? EXTENDED_WARRANTY_YEARS : STANDARD_WARRANTY_YEARS;
        return watchData[tokenId].warrantyStart + years * 365 days;
    }
    
    function setOwnerNickname(string memory nickname) public {
        require(bytes(nickname).length > 0 && bytes(nickname).length <= 50, "Invalid nickname length");
        OwnerProfile storage profile = ownerProfiles[msg.sender];
        string memory oldNickname = profile.nickname;
        profile.nickname = nickname;
        profile.nicknameUpdatedAt = block.timestamp;
        
        // Update nickname for all owned tokens
        uint256[] memory tokens = ownerWatches[msg.sender];
        for(uint256 i = 0; i < tokens.length; i++) {
            uint256 tokenId = tokens[i];
            TransferRecord memory lastTransfer = ownershipHistory[tokenId][ownershipHistory[tokenId].length - 1];
            lastTransfer.toNickname = nickname;
            emit OwnerNicknameUpdated(tokenId, msg.sender, oldNickname, nickname);
        }
    }
    
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override whenNotPaused {
        super.transferFrom(from, to, tokenId);
        
        // Record transfer
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
    
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override whenNotPaused {
        super.safeTransferFrom(from, to, tokenId);
        
        // Record transfer
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
    
    function getWatchesByDialColor(DialColor color) public view returns (uint256[] memory) {
        return watchesByDialColor[color];
    }
    
    function pause() public onlyOwner {
        _pause();
    }
    
    function unpause() public onlyOwner {
        _unpause();
    }
    
    function setBaseURI(string memory newBaseURI) public onlyOwner {
        _setBaseURI(newBaseURI);
    }
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        
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