# Vera Cruz NFT - Smart Contract Architecture

## Project Summary

NFT smart contract for the watch brand **Vera Cruz**, model **Alvorada**. Each watch will have a corresponding NFT serving as:
- **Proof of Authenticity** - unique record on the blockchain
- **Extended Warranty** - access to exclusive benefits
- **Future Value** - prevention of counterfeits, appreciation like Rolex

---

## 1. Product Specifications (On-Chain)

### Watch Identity and Warranty Data (Minted at creation)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `model` | string | Watch model name | "Alvorada" |
| `modelCode` | string | SKU model code | "AL" |
| `dialColor` | string | Flexible dial color code | "AA", "PR", "VM" |
| `serialNumber` | string | Unique serial number | "VR-AL-AA-01001" |
| `sku` | string | Full commercial product identifier | "VR-AL-AA-01001" |
| `batchNumber` | uint256 | Production batch | 1 |
| `edition` | uint256 | Piece number within model/color/batch | 1-25 |
| `mintedAt` | uint256 | Minting timestamp | Auto (block timestamp) |

The detailed product specification is stored in the token's IPFS metadata. This keeps the contract extensible and below the EVM bytecode limit while preserving the product identity on-chain.

### Serial Number Format

```
VR-AL-AA-01001
│   │  │  │
│   │  │  └── Specific watch number (001-025 within batch)
│   │  └───── Batch number (01 = first batch)
│   └──────── Dial color code:
│              AA = Aurora Blue (Azul Aurora)
│              PR = Black (Preto)
└──────────── Model code:
               AL = Alvorada
Brand code:    VR = Vera Cruz
```

**Examples:**
- `VR-AL-AA-01001` → First Aurora Blue watch of first batch
- `VR-AL-AA-01025` → 25th Aurora Blue watch of first batch
- `VR-AL-PR-01001` → First Black watch of first batch
- `VR-AL-PR-01025` → 25th Black watch of first batch

---

## 2. NFT Structure

### 2.1 Standard
- **ERC-721** (each watch has a unique global `tokenId`)
- Extensions: `Ownable`, `Pausable`, `ReentrancyGuard`
- Individual metadata URI stored on-chain per token

### 2.2 Metadata (Off-Chain via IPFS)

```json
{
    "name": "Vera Cruz Alvorada Azul Aurora #1/25",
  "description": "Vera Cruz Alvorada watch - Aurora Blue dial, 40mm, 316L Stainless Steel, Sapphire Crystal, Miyota 2115 Quartz movement. Serial: VR-AL-AA-01001",
  "image": "ipfs://...",
    "external_url": "https://relogiosveracruz.com.br/alvorada/1",
  "attributes": [
    {"trait_type": "Model", "value": "Alvorada"},
    {"trait_type": "Brand", "value": "Vera Cruz"},
    {"trait_type": "Case Material", "value": "316L Stainless Steel"},
    {"trait_type": "Case Color", "value": "Prata"},
    {"trait_type": "Case Diameter", "value": "40mm"},
    {"trait_type": "Crystal", "value": "Sapphire Crystal"},
    {"trait_type": "Bezel", "value": "Sem bezel"},
    {"trait_type": "Watch Style", "value": "Tres ponteiros com data"},
    {"trait_type": "Movement", "value": "Quartz"},
    {"trait_type": "Caliber", "value": "Miyota 2115"},
    {"trait_type": "Strap", "value": "Solid Stainless Steel President Style"},
    {"trait_type": "Strap Color", "value": "Prata"},
    {"trait_type": "Strap Material", "value": "Aco"},
    {"trait_type": "Strap Type", "value": "President"},
    {"trait_type": "Clasp", "value": "Borboleta"},
    {"trait_type": "Water Resistance", "value": "5 ATM"},
    {"trait_type": "Dial Color", "value": "Azul Aurora"},
    {"trait_type": "Edition", "value": "1/25"},
    {"trait_type": "Power Reserve", "value": "N/A (Quartz)"},
    {"trait_type": "Serial Number", "value": "VR-AL-AA-01001"}
  ]
}
```

---

## 3. Smart Contract Architecture

### 3.1 Key Design Decisions
- **ERC-721 chosen** because each watch has a unique serial number on-chain
- **Batch minting possible** but warranty starts at first sale
- **Admin-controlled warranty activation** - only Vera Cruz can start the warranty period

### 3.2 Contract Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    VeraCruzNFT.sol                          │
├─────────────────────────────────────────────────────────────┤
│  Owner Functions (Vera Cruz):                                │
│  ├── mintWatch(...) / mintBatch(arrays...)                 │
│  ├── sellWatch(address buyer, uint256 tokenId, bool extended)│
│  ├── startWarranty(uint256 tokenId, bool extended)          │
│  ├── setBaseURI(string memory newBaseURI)                   │
│  └── pause() / unpause()                                    │
├─────────────────────────────────────────────────────────────┤
│  NFT Owner Functions:                                       │
│  ├── transferFrom(address from, address to, uint256 id)     │
│  ├── safeTransferFrom(address from, address to, uint256 id) │
│  └── setOwnerNickname(string memory nickname)              │
├─────────────────────────────────────────────────────────────┤
│  Read-Only Query Functions:                                 │
│  ├── getWatchData(uint256 tokenId) → WatchData              │
│  ├── getOwnershipHistory(uint256 tokenId) → Transfer[]       │
│  ├── getOwnerNickname(address owner) → string               │
│  ├── getWatchesByOwner(address owner) → uint256[]           │
│  ├── totalSupply() → uint256                                │
│  ├── getWatchesByDialColor(uint256) → uint256[]             │
│  ├── isUnderWarranty(uint256 tokenId) → bool                │
│  ├── warrantyStartTime(uint256 tokenId) → uint256            │
│  ├── warrantyType(uint256 tokenId) → bool                    │
│  └── getWarrantyExpiry(uint256 tokenId) → uint256            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Data Structures

### 4.1 WatchData (struct)

```solidity
struct WatchData {
    string model;              // Model name, for example "Alvorada"
    string modelCode;          // SKU model code, for example "AL"
    string dialColor;          // Flexible code, for example "AA", "PR" or "VM"
    string serialNumber;       // Physical serial number
    string sku;                // Full product SKU
    uint256 batchNumber;       // Production batch
    uint256 edition;           // Piece number within the batch/color
    uint256 mintedAt;          // Block timestamp of minting
    bool warrantyActive;       // Is warranty currently active?
    uint256 warrantyStart;     // When warranty was started
    bool extendedWarranty;     // True if extended warranty was purchased
}
```

### 4.2 TransferRecord (struct)

```solidity
struct TransferRecord {
    address from;              // Sender address
    address to;                // Recipient address
    uint256 timestamp;         // Block timestamp of transfer
    string fromAlias;          // Sender's pseudonym (optional)
    string toAlias;            // Recipient's pseudonym (optional)
    bool warrantyTransferred;  // Does warranty transfer with NFT?
}
```

### 4.3 OwnerProfile (struct)

```solidity
struct OwnerProfile {
    string alias;              // User-chosen pseudonym
    uint256 aliasUpdatedAt;    // Last alias update timestamp
    bool hasExtendedWarranty;  // Does this owner have extended warranty?
}
```

### 4.4 WarrantyState (enum)

```solidity
enum WarrantyState {
    None,          // Warranty not started
    ActiveStandard, // Standard 1-year warranty active
    ActiveExtended, // Extended 2-year warranty active
    Expired        // Warranty period ended
}
```

---

## 5. Operation Flow

### 5.1 Minting Phase (Admin only)

```mermaid
sequenceDiagram
    participant V as Vera Cruz (Admin)
    participant C as NFT Contract
    participant B as Blockchain
    participant P as Potential Buyer

    Note over V: 1. Mint the watches for the current batch
    
    V->>C: mintBatch(batch data and individual metadata URIs)
    C->>B: Transactions created
    B->>C: All 50 NFTs minted
    Note over P: NFTs in Vera Cruz wallet, not yet "active"
    
    Note over V: 2. Store NFTs until sales begin
```

### 5.2 Warranty Activation Phase (After First Sale)

```mermaid
sequenceDiagram
    participant B as Buyer
    participant C as NFT Contract
    participant V as Vera Cruz (Admin)

    Note over B: 1. Buyer purchases physical watch + NFT
    
    B->>C: transferFrom(VeraCruz, Buyer, tokenId)
    C->>B: NFT transferred to buyer
    
    Note over V: 2. Admin starts warranty
    
    V->>C: startWarranty(tokenId, false)  // false = standard warranty
    C->>B: Warranty activated, starts from block timestamp
    
    Note over B: 3. Warranty now active for 1 year
    
    Loop Warranty Verification
        B->>C: isUnderWarranty(tokenId)
        C-->>B: Returns true/false
        B->>C: warrantyExpiry(tokenId)
        C-->>B: Returns expiry timestamp
    End
```

### 5.3 Extended Warranty Purchase

```mermaid
sequenceDiagram
    participant C as Customer
    participant V as Vera Cruz (Admin)
    participant B as Blockchain

    Note over C: 1. Customer pays for extended warranty
    
    C->>V: Payment for extended warranty
    V->>C: Confirmation
    
    V->>C: startWarranty(tokenId, true)  // true = extended warranty
    C->>B: Warranty activated for 2 years
```

---

## 6. LGPD Compliance

### 6.1 What is NOT stored
- ❌ Full name
- ❌ CPF/CNPJ (Brazilian tax ID)
- ❌ Residential address
- ❌ Email
- ❌ Phone number

### 6.2 What IS stored
- ✅ Wallet address (public by blockchain design)
- ✅ Pseudonym/alias (user-chosen, optional)
- ✅ Transaction timestamps (automatic)
- ✅ Product data (non-personal)

### 6.3 Data Protection
- Wallet addresses are not personal data (they are pseudonymous)
- Alias is optional and chosen by the user themselves
- Product data does not identify individuals
- No personal information is stored on-chain

---

## 7. Security

### 7.1 Permissions

| Function | Who can execute |
|----------|----------------|
| `mintWatch` / `mintBatch` | Only the contract owner (Vera Cruz) |
| `sellWatch` | Contract owner; transfers a treasury NFT and activates warranty |
| `startWarranty` | Only the contract owner (Vera Cruz) |
| `setBaseURI` | Only the contract owner |
| `pause` / `unpause` | Only the contract owner |
| `transferFrom` | Current NFT owner (or approved) |
| `setOwnerNickname` | Current NFT owner |
| `setOwnerNicknameFor` | Only the contract owner; used to assist with buyer onboarding |
| `isUnderWarranty` | Anyone (read-only) |
| `getWatchData` | Anyone (read-only) |

### 7.2 Security Measures
- `Ownable` contract for administrative control
- `ReentrancyGuard` on state-changing functions
- `Pausable` mechanism for emergency stops
- Token existence validation
- Events for auditing all operations
- Zero address checks (0x0000...)

### 7.3 Static Analysis Review

Slither was run against the current implementation in `contracts/VeraCruzNFT.sol`, excluding dependencies, artifacts and cache. The analysis completed with the following accepted findings:

| Finding | Assessment | Decision |
|---------|------------|----------|
| `timestamp` in warranty functions | `block.timestamp` is used to record minting, transfer and warranty start times and to calculate the warranty expiry. A block timestamp can be adjusted slightly by a validator, but this application uses periods of one or two years, so second-level precision is not a security boundary. | Accepted risk. Reassess if warranty rules become dependent on short time windows or exact timestamps. |
| `costly-loop` in array `mintBatch` | Batch minting intentionally performs one mint and several storage updates per item. A sufficiently large batch can exceed the transaction gas limit. | Accepted design constraint. Keep batches sized for the target network and add a maximum batch size if operational testing shows gas-limit failures. |

The boolean equality finding was fixed by using `!watchData[tokenId].warrantyActive` in `_startWarranty`. The remaining findings are documented rather than suppressed so future reviews can distinguish intentional design constraints from newly introduced warnings.

---

## 8. Events

```solidity
event WatchMinted(
    uint256 indexed tokenId,
    address indexed to,
    string sku,
    string modelCode,
    string dialColor,
    uint256 batchNumber,
    uint256 edition
);

event WatchSold(
    uint256 indexed tokenId,
    address indexed from,
    address indexed to,
    bool extendedWarranty
);

event OwnershipTransferred(
    uint256 indexed tokenId,
    address indexed from,
    address indexed to,
    string fromAlias,
    string toAlias,
    uint256 timestamp
);

event OwnerAliasUpdated(
    uint256 indexed tokenId,
    address indexed owner,
    string oldAlias,
    string newAlias
);

event WarrantyStarted(
    uint256 indexed tokenId,
    address indexed owner,
    bool extendedWarranty,
    uint256 startTime
);

event WarrantyExpired(
    uint256 indexed tokenId,
    address indexed formerOwner
);
```

---

## 9. Smart Contract Code Structure

The deployed implementation is maintained in `contracts/VeraCruzNFT.sol`. The current contract uses ERC-721 with `Ownable`, `Pausable` and `ReentrancyGuard`; it stores identity and warranty data on-chain, and stores an individual IPFS metadata URI for each token. The legacy preview below is historical context only and is not an implementation specification.

```solidity
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
        string fromAlias;
        string toAlias;
        bool warrantyTransferred;
    }
    
    struct OwnerProfile {
        string alias;
        uint256 aliasUpdatedAt;
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
    event OwnershipTransferred(uint256 indexed tokenId, address indexed from, address indexed to, string fromAlias, string toAlias, uint256 timestamp);
    event OwnerAliasUpdated(uint256 indexed tokenId, address indexed owner, string oldAlias, string newAlias);
    event WarrantyStarted(uint256 indexed tokenId, address indexed owner, bool extendedWarranty, uint256 startTime);
    event WarrantyExpired(uint256 indexed tokenId, address indexed formerOwner);
    
    constructor() ERC721("Vera Cruz Alvorada", "VCRZ-ALV") Ownable(msg.sender) {}
    
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
        require(watchData[tokenId].warrantyActive, "Watching data not found");
        return warrantyStates[tokenId] != WarrantyState.Expired;
    }
    
    function warrantyExpiry(uint256 tokenId) public view returns (uint256) {
        require(watchData[tokenId].warrantyActive, "Warranty data not found");
        uint256 years = watchData[tokenId].extendedWarranty ? EXTENDED_WARRANTY_YEARS : STANDARD_WARRANTY_YEARS;
        return watchData[tokenId].warrantyStart + years * 365 days;
    }
    
    // ... additional functions
}
```

---

## 10. Implementation Timeline

### Current Testnet Deployment

- Network: Polygon Amoy
- Contract: `0x21fd55622967cAE5722113fa8F8b8d9664Be4924`
- Explorer: https://amoy.polygonscan.com/address/0x21fd55622967cAE5722113fa8F8b8d9664Be4924

### Phase 1: Development
- [ ] Create Hardhat/Foundry project structure
- [ ] Implement `VeraCruzNFT.sol` contract with warranty features
- [ ] Write unit tests (minting, warranty activation, transfers)
- [ ] Create deployment script

### Phase 2: Preparation
- [x] Prepare images for the current collection (IPFS)
- [x] Prepare JSON metadata for each NFT
- [x] Configure IPFS via Pinata
- [ ] Test the current contract on Polygon Amoy

### Phase 3: Deployment
- [ ] Audit contract (pay special attention to warranty functions)
- [ ] Deploy the audited contract to Polygon mainnet
- [ ] Mint the planned watches in batches
- [ ] Configure marketplace (OpenSea)
- [ ] Set up warranty tracking dashboard (off-chain)

---

## 11. Suggested Tech Stack

| Component | Technology |
|-----------|------------|
| Blockchain | Ethereum (L1) or Polygon (L2 cheaper) |
| Testnet | Polygon Amoy |
| Framework | Hardhat or Foundry |
| Library | OpenZeppelin Contracts |
| Storage | IPFS via Pinata or OpenSea |
| Marketplace | OpenSea |
| Warranty Dashboard | Off-chain service (The Graph, or custom backend) |

---

## 12. Next Steps

1. Pin the corrected metadata folder in Pinata and record its root CID.
2. Deploy the current contract to Polygon Amoy.
3. Mint a small batch and verify each individual `tokenURI`.
4. Test `sellWatch`, transfers and warranty queries on Amoy.
5. Audit the final version before deploying to Polygon mainnet.

---

*Document generated in Architect mode for the Vera Cruz NFT project*
