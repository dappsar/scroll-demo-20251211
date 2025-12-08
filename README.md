# AA Demo

This repository contains **three independent Account Abstraction (ERC-4337) examples**, each increasing in complexity and realism:

1. `01-simple/` → Minimal smart account example
2. `02-paymaster/` → Gas sponsored via Paymaster
3. `03-social/` → Social login + factory + paymaster + web UI

---

## Overview of the 3 Examples

| Example        | 01-simple                            | 02-paymaster                                  | 03-social                                                          |
|----------------|--------------------------------------|-----------------------------------------------|--------------------------------------------------------------------|
| Goal           | Minimal AA flow                      | Add gas sponsorship                           | Realistic UX with social login                                    |
| Gas payment    | Smart account pays from its deposit  | Paymaster pays from its own deposit           | Paymaster pays, user never needs ETH                              |
| Signatures     | 1 signature (owner EOA)              | 2 signatures (owner + paymaster signer)       | 2 signatures (owner from social login + paymaster signer)         |
| UX             | Script / CLI                         | Script, still dev-oriented                    | Web app with Google login                                         |
| Key concepts   | Smart Account, UserOp, EntryPoint    | `paymasterAndData`, `validatePaymasterUserOp` | Social login, factory + CREATE2, `initCode`, deterministic address |

---

## 01-simple/

A minimal AA demo showing:

- A **basic smart account** contract.
- A **demo logic contract** (simple counter).
- A small **TypeScript client** that builds and sends a **UserOperation without a Paymaster**.

Conceptually, this example focuses on:

- How a **Smart Account** replaces a traditional EOA as the transaction sender.
- How `validateUserOp` checks the owner’s signature.
- How the **EntryPoint** orchestrates validation, gas accounting and execution.
- How a UserOperation is constructed and sent to a **bundler**.

Useful as an introductory example of **ERC-4337 basics**:
Smart Account → UserOperation → EntryPoint → external logic contract.

---

## 02-paymaster/

A more advanced demo that adds **gas sponsorship via Paymaster**:

- Reuses the same **Smart Account** and **logic (counter) contract**.
- Adds a **custom Paymaster** contract that:
  - Holds a deposit in the EntryPoint.
  - Validates UserOperations via `validatePaymasterUserOp`.
  - Pays gas on behalf of the user if the Paymaster’s signature is valid.
- A client that:
  - Builds the UserOperation.
  - Computes a **Paymaster hash** and **signs it with a paymaster signer**.
  - Fills the `paymasterAndData` field with the Paymaster address + signature.
  - Sends a **sponsored UserOperation** to the bundler.

Conceptually, this example highlights:

- **`paymasterAndData`** structure.
- **Two signatures** per UserOperation:
  - Owner signature (`userOp.signature`) → authorizes the action.
  - Paymaster signature (`paymasterAndData`) → authorizes paying gas.
- How a user can interact **without having ETH in the Smart Account**.

Useful for understanding how **Paymasters plug into the AA flow**.

---

## 03-social/

A complete, more realistic demo combining:

- A **Smart Account** deployed via an **AccountFactory** using deterministic salts (CREATE2).
- A **demo logic contract** (counter).
- A **custom Paymaster** that sponsors gas.
- A **TypeScript + web client** that:

  - Uses **Google OAuth (social login)** to obtain an `id_token`.
  - Extracts the `sub` field and derives a **deterministic EOA** (for demo purposes only).
  - Computes the **Smart Account address** via the factory.
  - Detects whether the account already exists on-chain.
  - Builds UserOperations with:
    - Correct nonce.
    - Conditional `initCode` when the account does not exist yet.
  - Requests **Paymaster sponsorship**.
  - Sends the UserOperation to a bundler from a **web UI**.

This example demonstrates a **production-style flow**:

> social login → EOA derivation → deterministic smart account → initCode on first use → paymaster sponsorship → send UserOperation → increment counter

Conceptually, it ties together:

- **Social login** as identity / UX layer.
- **AccountFactory + CREATE2** for deterministic deployment.
- **`initCode`** for just-in-time account creation.
- **Paymaster** so the user never has to manage ETH directly.
- A **Web2-like UX** on top of AA primitives.
