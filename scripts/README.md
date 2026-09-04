# Operational scripts

All write operations load secrets from the root `.env`. The environment-specific private keys and contract addresses are intentionally separate.

## Configuration

```env
AMOY_URL=https://polygon-amoy.drpc.org
AMOY_PRIVATE_KEY=
AMOY_CONTRACT_ADDRESS=
POLYGON_URL=
POLYGON_PRIVATE_KEY=
POLYGON_CONTRACT_ADDRESS=
```

`AMOY_CONTRACT_ADDRESS` should contain the Amoy deployment. `POLYGON_CONTRACT_ADDRESS` should contain the Polygon mainnet deployment after it is deployed.

## Sell by SKU

Standard warranty on Amoy:

```powershell
npm run sell:amoy -- --sku VR-AL-AA-01001 --buyer 0x... --warranty standard --confirm
```

Extended warranty on Amoy:

```powershell
npm run sell:amoy -- --sku VR-AL-PR-01001 --buyer 0x... --warranty extended --confirm
```

Mainnet uses the same arguments with `sell:polygon`:

```powershell
npm run sell:polygon -- --sku VR-AL-AA-01001 --buyer 0x... --warranty standard --confirm
```

The script validates the chain ID, signer, contract owner, SKU uniqueness, token ownership by the treasury, warranty status and gas estimate before sending. Without `--confirm`, it refuses to submit a transaction.

## Token status report

The read-only status report does not require a private key:

```powershell
npm run status:amoy
npm run status:polygon
```

It creates `output/token-status-amoy.json` and `output/token-status-amoy.csv` (or `polygon`) with the SKU, current owner, buyer nickname, warranty type, warranty state, start, expiry, final expiry date and metadata URI. The `warrantyStatus` field is `Vigente`, `Expirada` or `Não iniciada`, calculated against the timestamp of the latest blockchain block.
