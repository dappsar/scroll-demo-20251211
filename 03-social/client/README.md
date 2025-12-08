# **AA Demo on Scroll – Client with Social Login**

This folder contains the TypeScript client for the Account Abstraction demo on Scroll.

The client is responsible for:

* Handling UI interactions through `index.html`
* Logging in with **Google OAuth** to derive a deterministic owner private key
* Computing the smart account address via the on-chain factory
* Reading environment configuration
* Connecting to Scroll RPC and an ERC-4337 bundler
* Building, signing and sending UserOperations
* Conditionally deploying the smart account using `initCode`
* Optionally attaching Paymaster sponsorship
* Executing calls on the demo contract (e.g., `increment()`)

The goal is to keep the flow minimal and understandable for demos and workshops.


## **Tech stack**

* **TypeScript**
* **Vite** (dev server + env vars)
* **viem** for RPC & contract interactions
* **Google OAuth** for social login
* **ERC-4337 bundler** HTTP endpoint
* Browser UI (`index.html` + small helpers)


## **Project structure**

```text
client/
├─ src/
│  ├─ main.ts          # Full AA flow (UserOp building, nonce, initCode, sending)
│  ├─ google.ts        # Google login + PK derivation from ID token
│  ├─ ui.ts            # Small DOM helpers for demo UI
│  └─ ...
├─ index.html          # Basic UI for login + send operation
├─ .env.example        # Example env vars
├─ package.json
└─ tsconfig.json
```

## **Requirements**

* Node.js 18+
* `yarn` or `npm`
* Deployed contracts from `contracts/`:

  * AccountFactory
  * Smart account implementation
  * Demo logic contract
  * Paymaster
* Access to:

  * Scroll RPC URL
  * ERC-4337 bundler URL
  * EntryPoint address
  * Google OAuth client ID


## **Google OAuth configuration**

Before running the client, you must configure Google’s OAuth flow.

### **1. Create OAuth credentials**

Go to:
[https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)

Create:

* **OAuth 2.0 Client ID**
* Application type: **Web application**

Authorized JavaScript origins:

```
http://localhost:5173
```

Authorized redirect URIs:

```
http://localhost:5173/
```

Copy the generated **Client ID** into your `.env`:

```
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

### **2. Configure OAuth consent screen**

Go to:
**APIs & Services → OAuth consent screen**

* User type: External
* App name: anything
* Add **Test users** = the Google accounts you want to log in with
* Save

This allows the login popup and lets you switch between multiple Google accounts.


## **Environment variables**

Create a `.env` based on the _example_env_ file.
Fill in values using your contract deployments and OAuth configuration.

## **Install & run**

### Install dependencies

```bash
yarn install
```

### Run the demo

```bash
yarn dev
```


The UI will:

1. Show a Google login button.
2. Derive a deterministic owner private key from the Google `sub` field.
3. Compute the smart account address (AccountFactory.getAddress).
4. Detect if the smart account is already deployed.
5. Read the nonce from EntryPoint.
6. Build a UserOperation (with or without initCode).
7. Optionally attach Paymaster sponsorship.
8. Send the UserOperation to the bundler.
9. Display updated counter values.



## **Flow overview**

1. Deploy contracts using the `contracts/` package.
2. Copy deployed addresses into `client/.env`.
3. Run the client with `yarn dev`.
4. Log in with Google to generate the owner key.
5. Smart account is computed and deployed on first UserOperation.
6. Bundler executes the operation through EntryPoint.
7. Demo logic contract increments its counter.

This example demonstrates:

* Social login → deterministic EOA
* Smart account generation via factory
* Validating AA signatures on-chain
* Conditional deployment via initCode
* Paymaster sponsorship
* Full ERC-4337 UserOperation lifecycle
