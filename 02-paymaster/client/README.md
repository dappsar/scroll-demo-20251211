# AA Demo on Scroll - Client

This folder contains the TypeScript client for the Account Abstraction demo on Scroll.

The client is responsible for:

- Reading configuration from environment variables
- Connecting to Scroll via RPC and to an ERC-4337 bundler
- Building and signing a UserOperation
- Sending the UserOperation to the bundler
- Calling a demo contract (e.g. `increment()` on a counter) through the smart account

The goal is to keep the flow minimal and easy to follow for demos and workshops.


## Tech stack

- **TypeScript**
- **Node.js**
- **viem** for RPC & contract interactions
- HTTP bundler endpoint compatible with ERC-4337


## Project structure

Typical layout:

```text
client/
├─ src/
│  └─ index.ts        # Main entrypoint: builds and sends a UserOperation
├─ .env.example       # Example environment variables
├─ package.json
└─ tsconfig.json
```


## Requirements

* Node.js 18 or later
* `yarn` or `npm` installed
* Deployed contracts from the `contracts/` package:

  * Smart account address
  * Demo logic contract address (e.g. counter)
* Access to:

  * Scroll RPC URL
  * ERC-4337 bundler URL
  * EntryPoint address on Scroll


## Environment variables

Create a `.env` file in this folder based on `.env.example`.

## Install & run

### Install dependencies

```bash
yarn install
# (or `npm install` if you prefer)
```

### Run the demo

```bash
yarn dev
```

The script will:

1. Build a UserOperation targeting the demo logic contract via the smart account.
2. Sign the UserOperation with `PRIVATE_KEY`.
3. Send it to the bundler at `BUNDLER_URL`.
4. Wait for inclusion and log the result (e.g. updated counter value).


## Flow overview

End-to-end flow:

1. Deploy contracts using the `contracts/` package (smart account + demo contract).
2. Copy the deployed addresses into `client/.env`.
3. Run `yarn dev` to send a UserOperation on Scroll.
4. Use the logs to explain how Account Abstraction works in practice:

   * `sender` is the smart account
   * gas is paid by the account itself (no paymaster in this demo)
   * the call goes through EntryPoint to your demo contract
