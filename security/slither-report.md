# Slither Security Report

- **Date:** 2026-09-03
- **Target:** `contracts/VeraCruzNFT.sol`
- **Tool:** Slither 0.11.6
- **Compiler:** Solidity 0.8.24 via Hardhat
- **Command:** `npm run slither`
- **Scope:** project contract; `node_modules`, `artifacts` and `cache` excluded

## Result

The analysis completed with 4 findings. They represent 2 accepted design constraints:

| Detector | Location | Assessment | Decision |
|---|---|---|---|
| `timestamp` | Warranty functions | `block.timestamp` records minting, transfer and warranty start times and calculates one- or two-year periods. Small validator timestamp adjustments do not cross a meaningful security boundary for these periods. | Accepted. Reassess if short time windows or exact timestamps become part of the business rules. |
| `costly-loop` | Array `mintBatch` | A batch necessarily performs one mint and storage updates per NFT. A batch that is too large can exceed the network transaction gas limit. | Accepted constraint. Keep operational batches within the tested gas limit; add a maximum batch size if needed. |

The previous `incorrect-equality` and `boolean-equal` findings were resolved by changing the warranty guard to `!watchData[tokenId].warrantyActive`.

## Access-control review

The current implementation was also covered by Hardhat tests in `test/VeraCruzNFT.test.js`:

- `mintBatch`, `mintWatch`, `sellWatch`, `startWarranty`, `pause`, `unpause` and `setBaseURI` require `onlyOwner`.
- `transferOwnership` and `renounceOwnership` retain OpenZeppelin `onlyOwner` protection.
- There is no public or external `burn` function in the contract.
- NFT transfers retain ERC-721 authorization: only the token owner or an approved operator can transfer.
- `setOwnerNickname` changes only the caller's profile and transfer-history nickname; it does not change warranty, ownership, metadata URI or minting state.
- `setOwnerNicknameFor` is restricted to the contract owner and exists to register a buyer's nickname when the buyer cannot operate the blockchain. It does not grant the buyer or the administrator any additional NFT transfer or warranty capability.

## Validation performed

- `npm test`: **16 passing**
- `npm run compile`: successful
- `npm run slither`: 4 documented findings, no access-control finding
- `git diff --check`: clean

## Operational security requirement

`onlyOwner` protects the contract owner address, not the private key itself. The deployer must protect that key, preferably with a hardware wallet or multisig. No smart-contract code can prevent an attacker who has obtained the owner's signing key from calling owner-only functions.
