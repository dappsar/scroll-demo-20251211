# AA Demo with Paymaster and Social Login

This repository contains two packages:

- `contracts/` → Foundry project with a minimal AA setup (AccountFactory, Smart Account, Demo Logic, Paymaster)
- `client/` → TypeScript client using viem to build and send UserOperations to Scroll. The client uses **Google OAuth social login** to derive a deterministic EOA and generate the smart account address.

## Contracts

```bash
cd contracts
cp example_env .env   # create .env based on example_env and complete required variables
forge build
make deploy_and_verify
````

## Client

```bash
cd client
cp example_env .env   # create .env based on example_env and complete required variables
yarn install
yarn dev
```
