# AA Demo with paymater

This repository contains two packages:

- `contracts/` → Foundry project with a basic AA wallet and Paymaster
- `client/` → TypeScript client using viem to build and send UserOps to Scroll

## Contracts

```bash
cd contracts
cp example_env .env # Complete .env with some PRIVATE_KEY
forge build
make deploy_and_verify
```

## Client

```bash
cd client
cp example_env .env
yarn install
yarn dev
```
