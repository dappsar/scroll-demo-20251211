# AA Demo on Scroll with Paymaster - Contracts

This folder contains the smart contracts for the AA demo:

- A minimal smart account (ERC-4337 style)
- A simple demo logic contract used by the smart account (e.g. a counter)
- A simple Paymaster contract
- A factory to deploy deterministic smart accounts
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

* Deploy the AccountFactory
* Deploy the demo logic contract
* Deploy the Paymaster
* Print the deployed addresses (to be used by the client/ package)

## Funding Paymaster

### Stake Balance 
```sh 
# Add balance al Paymaster en el stakeManager usando el entryPoint y pasando eth desde el signer de backend
# 10000 = time-to-unstake, aprox 25 horas (es el mínimo)
cast send $PAYMASTER_ADDRESS "addStake(uint32)" 100000 --value 0.1ether --from $SIGNER_ADDRESS --rpc-url $SCROLL_RPC --private-key $PRIVATE_KEY

# Add balance al Paymaster en el deposit del entrypoint, pasando eth desde el signer de backend
cast send $ENTRYPOINT_ADDRESS "depositTo(address)" $PAYMASTER_ADDRESS --value 0.1ether --from $SIGNER_ADDRESS --rpc-url $SCROLL_RPC --private-key $PRIVATE_KEY
```

### Verify Balance
```sh
# Check balance del Paymaster en stakeManager usando el entryPoint (mínimo tiene que tener 0.1 eth)
# Result: uint112 deposit; bool staked; uint112 stake; uint32 unstakeDelaySec; uint48 withdrawTime;
cast call $ENTRYPOINT_ADDRESS "getDepositInfo(address)(uint112,bool,uint112,uint32,uint48)" $PAYMASTER_ADDRESS --rpc-url $SCROLL_RPC

# Check balance del Paymaster en entrypoint storage (mínimo seteado en backend: 0.15 eth)
cast call $ENTRYPOINT_ADDRESS "balanceOf(address)(uint256)" $PAYMASTER_ADDRESS --rpc-url $SCROLL_RPC
```

### Recovery balance

```sh
# Sacar todos los fondos del paymaster: unlock-stake
cast send $PAYMASTER_ADDRESS "unlockStake()" --from $SIGNER_ADDRESS --rpc-url $SCROLL_RPC --private-key $PRIVATE_KEY

# Sacar todos los fondos del paymaster: withdraw-stake to signer
# tiene que pasar el tiempo de unstake! (aprox 25 horas).
cast send $PAYMASTER_ADDRESS "withdrawStake(address)" $SIGNER_ADDRESS --from $SIGNER_ADDRESS --rpc-url $SCROLL_RPC --private-key $PRIVATE_KEY

# Sacar todos los fondos del paymaster: withdraw-deposit to signer
# cambia monto !!!  => 0.1ethers
cast send $PAYMASTER_ADDRESS "withdrawTo(address, uint256)" $SIGNER_ADDRESS 10000000000000000 --from $SIGNER_ADDRESS --rpc-url $SCROLL_RPC --private-key $PRIVATE_KEY

# Sacar todos los fondos del paymaster: withdraw all paymaster funds to signer (si tiene algo en el value del address)
cast send $PAYMASTER_ADDRESS "withdraw()" --from $SIGNER_ADDRESS --rpc-url $SCROLL_RPC --private-key $PRIVATE_KEY
```

## Next steps

Once the contracts are deployed and you have the addresses:

1. Copy the factory, demo logic and paymaster addresses into `client/.env`.
2. Use the TypeScript client to build and send a UserOperation that calls the demo contract through the smart account.
3. Show the full AA flow on Scroll in your demo.
