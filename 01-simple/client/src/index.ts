import * as dotenv from "dotenv"

dotenv.config()

import { encodePacked, keccak256 } from "viem"
import { DEMOLOGIC_ABI, ENTRYPOINT_ABI } from "./abi"
import type { Address, BundlerSendUoResponse, Hex, UserOperationReceipt } from "./types"
import {
  buildUserOperation,
  CYAN,
  createRpcClient,
  encodeExecute,
  encodeIncrementCall,
  ensureAaFunded,
  envAddress,
  envHex,
  envValue,
  GREEN,
  getBundlerGasPrices,
  getOwnerWallet,
  MAGENTA,
  RESET,
  readDemoCount,
  signUserOperationHash,
  waitForReceipt,
  YELLOW
} from "./utils"

// ============================================================================
// ENV VARS & ACCOUNTS
// ============================================================================
// Here we load the three addresses involved in the demo:
// 1) the EntryPoint
// 2) the Smart Account itself
// 3) the DemoLogic contract (external app contract)
//
// This ties back to the workshop explanation: the Smart Account is NOT where
// business logic lives. It is only the "controller" that validates and proxies calls.
const RPC_URL: string = envValue(process.env.SCROLL_RPC, "SCROLL_RPC")
const BUNDLER_URL: string = envValue(process.env.BUNDLER_URL, "BUNDLER_URL")

const SC_ENTRYPOINT_ADDRESS: Address = envAddress(
  process.env.SC_ENTRYPOINT_ADDRESS,
  "SC_ENTRYPOINT_ADDRESS"
)
const SC_SMART_ACCOUNT_ADDRESS: Address = envAddress(
  process.env.SC_ACCOUNT_ADDRESS,
  "SC_ACCOUNT_ADDRESS"
)
const SC_DEMO_LOGIC_ADDRESS: Address = envAddress(
  process.env.SC_DEMOLOGIC_ADDRESS,
  "SC_DEMOLOGIC_ADDRESS"
)

// The owner PK represents the "owner" of the smart account.
// In the workshop: this is the one who signs the UserOperation, NOT transactions.
// This is Step 1 in AA: removing dependency on native tx signatures.
const OWNER_PK: Hex = envHex(process.env.PRIVATE_KEY, "PRIVATE_KEY")
const { account: owner, wallet } = getOwnerWallet(RPC_URL, OWNER_PK)

// ============================================================================
// RPC & WALLET CLIENTS
// ============================================================================
// Public client: used for read calls.
// Wallet client: used only for funding the Smart Account (prefund step),
// NOT for executing the actual logic. The Smart Account executes logic via UserOps.
const rpc = createRpcClient(RPC_URL)

// ============================================================================
// DISPLAY
// ============================================================================
console.log(`
${CYAN}===============================================================
ACCOUNT ABSTRACTION DEMO (NO PAYMASTER)
Smart Account + UserOperation + Bundler + External Logic
===============================================================${RESET}

Using Owner EOA for signing the UserOperation:
  → ${owner.address}


Smart Account:
  → ${SC_SMART_ACCOUNT_ADDRESS}

DemoLogic contract (simple counter external logic):
  → ${SC_DEMO_LOGIC_ADDRESS}

EntryPoint (ERC-4337 coordinator):
  → ${SC_ENTRYPOINT_ADDRESS}
`)

// ============================================================================
// MAIN DEMO FLOW
// ============================================================================
async function main(): Promise<void> {
  console.log(`${CYAN}Starting AA demo...\n${RESET}`)

  // Step 0
  const before = await readDemoCount(rpc, SC_DEMO_LOGIC_ADDRESS, DEMOLOGIC_ABI, "BEFORE")

  // Step 1
  await ensureAaFunded(rpc, wallet, owner, SC_SMART_ACCOUNT_ADDRESS)

  // Step 2 (nonce)
  console.log(`\n${CYAN}[NONCE READ]${RESET} Fetching Smart Account nonce from EntryPoint…`)
  const nonceBN = await rpc.readContract({
    address: SC_ENTRYPOINT_ADDRESS,
    abi: ENTRYPOINT_ABI,
    functionName: "getNonce",
    args: [SC_SMART_ACCOUNT_ADDRESS, 0n]
  })
  console.log(`Nonce retrieved: ${nonceBN}\n`)

  // Step 3 (Bundler gas values)
  const { maxFeePerGas, maxPriorityFeePerGas } = await getBundlerGasPrices(BUNDLER_URL)

  // Step 4 (calldata)
  console.log(`
${MAGENTA}[CALLDATA BUILD]${RESET}
Building calldata for:
SmartAccount.execute(
    target = DemoLogic,
    value = 0,
    data = DemoLogic.increment()
)
`)
  const incrementCall: Hex = encodeIncrementCall()
  const callData: Hex = encodeExecute(SC_DEMO_LOGIC_ADDRESS, 0n, incrementCall)

  // Step 5: Build userOp (without signature/paymaster)
  const userOp = buildUserOperation({
    sender: SC_SMART_ACCOUNT_ADDRESS,
    nonce: nonceBN,
    callData,
    maxFeePerGas,
    maxPriorityFeePerGas
  })

  // Step 6 (hash computation to signature)
  console.log(`
${YELLOW}[HASH COMPUTATION]${RESET}
Computing userOpHash exactly as Smart Account does in validateUserOp()...
`)
  const rawHash: Hex = keccak256(
    encodePacked(
      ["address", "uint256", "bytes32"],
      [SC_SMART_ACCOUNT_ADDRESS, nonceBN, keccak256(callData)]
    )
  ) as Hex
  console.log(`userOpHash:\n${rawHash}\n`)

  // Step 7 (user operation signature)
  const signature: Hex = await signUserOperationHash(owner, rawHash)
  userOp.signature = signature

  // Step 8 (bundler submission)
  console.log(`
${CYAN}[BUNDLER SUBMISSION]${RESET}
Sending UserOperation to bundler (eth_sendUserOperation)...
`)
  const sendReq = {
    jsonrpc: "2.0",
    method: "eth_sendUserOperation",
    params: [userOp, SC_ENTRYPOINT_ADDRESS],
    id: 1
  }

  const sendRes = await fetch(BUNDLER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sendReq)
  }).then((r) => r.json() as Promise<BundlerSendUoResponse>)

  console.log(`
Bundler response received:
${JSON.stringify(sendRes, null, 2)}

UserOperation tracking hash (bundler → EntryPoint):
→ ${sendRes.result}
`)

  if (!sendRes.result || typeof sendRes.result !== "string") {
    console.error("Invalid bundler response:", sendRes)
    throw new Error("Bundler did not return a valid operation hash")
  }

  // step: 9 (receipt wait)
  console.log(`\n${CYAN}[RECEIPT CHECK]${RESET} Waiting for UserOperation receipt...`)
  const receipt: UserOperationReceipt = await waitForReceipt(BUNDLER_URL, sendRes.result)

  // Step 10 (final read & display)
  const after = await readDemoCount(rpc, SC_DEMO_LOGIC_ADDRESS, DEMOLOGIC_ABI, "AFTER")

  // Final summary
  console.log(`
${GREEN}===================================================
AA DEMO COMPLETED
===================================================
Smart Account successfully executed DemoLogic.increment().

Counter moved:
  BEFORE → ${before}
  AFTER  → ${after}

This confirms:
- UserOperation was accepted by bundler
- EntryPoint validated signature
- Smart Account executed the external logic
- Trx  → ${receipt.receipt?.transactionHash ?? "N/A"}
===================================================${RESET}
`)
}

main().catch((err: unknown) => {
  console.error("Fatal error in client:")
  console.error(err)
})
