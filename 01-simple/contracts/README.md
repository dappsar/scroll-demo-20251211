# AA Demo on Scroll - Contracts

This folder contains the smart contracts for the AA demo:

- A minimal smart account (ERC-4337 style)
- A simple demo logic contract used by the smart account (e.g. a counter)
- Deployment scripts using Foundry

The idea is to keep the on-chain part small and focused, so the flow is easy to explain in a live demo.


## Tech stack

This package uses [Foundry](https://book.getfoundry.sh/), a fast toolkit for Ethereum development:

- **Forge** · build, test and deploy contracts
- **Cast** · interact with contracts and chain data from the CLI
- **Anvil** · local EVM node for development


## Project structure

Typical layout:

```text
contracts/
├─ src/              # Smart account + demo logic contracts
│  └─ ...
├─ script/           # Deployment scripts (Deploy.s.sol, etc.)
├─ test/             # Unit tests (optional but recommended)
├─ broadcast/        # Deployment logs (keeps real networks, ignores local)
├─ foundry.toml      # Foundry config
└─ .env              # Local env vars (ignored by git)
```


## Requirements

* Foundry installed (`forge`, `cast`)
* Access to a Scroll RPC endpoint (testnet or mainnet)
* An EOA with ETH on Scroll to pay for deployment


## Environment variables

Create a `.env` file in this folder based on the provided `example_env` template.

Load it in your shell before deploying:

```bash
source .env
```

## Common commands

### Build

Compile all contracts:

```bash
forge build
```

### Format

Format Solidity files:

```bash
forge fmt
```

### Local node (optional)

Run a local Anvil node:

```bash
anvil
```


## Deploy to Scroll

Use the deployment script (for example `script/Deploy.s.sol`):

```bash
# Deploy
make deploy

# Deploy and verify
make deploy_and_verify
```

The script should:

* Deploy the smart account (if applicable)
* Deploy the demo logic contract
* Print the deployed addresses (to be used by the `client/` package)

You can pass those addresses into the `client/.env` to wire the end-to-end demo.


## Next steps

Once the contracts are deployed and you have the addresses:

1. Copy the smart account and demo logic addresses into `client/.env`.
2. Use the TypeScript client to build and send a UserOperation that calls the demo contract through the smart account.
3. Show the full AA flow on Scroll in your demo.
