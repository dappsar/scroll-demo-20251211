import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  encodePacked,
  http,
  isAddress,
  keccak256,
  parseEther
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { scrollSepolia } from "viem/chains"

import type { Address, GasPrices, Hex, ReceiptResponse, UserOperationReceipt } from "./types"

// Colors
export const CYAN = "\x1b[36m"
export const GREEN = "\x1b[32m"
export const YELLOW = "\x1b[33m"
export const MAGENTA = "\x1b[35m"
export const RESET = "\x1b[0m"

// UserOperation type local to utils
interface UserOperation {
  sender: Address
  nonce: Hex
  initCode: Hex
  callData: Hex
  callGasLimit: Hex
  verificationGasLimit: Hex
  preVerificationGas: Hex
  maxFeePerGas: Hex
  maxPriorityFeePerGas: Hex
  paymasterAndData: Hex
  signature: Hex
}

// ---------------------- ENV HELPERS ----------------------
export function envAddress(v: string | undefined, name: string): Address {
  if (!v) throw new Error(`Missing env var: ${name}`)
  if (!isAddress(v)) throw new Error(`Invalid address in ${name}: ${v}`)
  return v as Address
}

export function envHex(v: string | undefined, name: string): Hex {
  if (!v) throw new Error(`Missing env var: ${name}`)
  if (!v.startsWith("0x")) throw new Error(`${name} must start with 0x`)
  return v as Hex
}

export function envValue(v: string | undefined, name: string): string {
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

// ---------------------- RPC CLIENTS ----------------------
export function createRpcClient(rpcUrl: string) {
  return createPublicClient({
    chain: scrollSepolia,
    transport: http(rpcUrl)
  })
}

export function createOwnerWallet(rpcUrl: string, ownerPk: Hex) {
  const account = privateKeyToAccount(ownerPk)
  return {
    account,
    wallet: createWalletClient({
      chain: scrollSepolia,
      transport: http(rpcUrl),
      account
    })
  }
}

// Types for rpc and wallet arguments
export type RpcClient = ReturnType<typeof createRpcClient>
export type WalletClient = ReturnType<typeof createOwnerWallet>["wallet"]
export type OwnerAccount = ReturnType<typeof createOwnerWallet>["account"]

// ---------------------- ENCODING HELPERS ----------------------
export function toHex(v: bigint | number): Hex {
  return `0x${BigInt(v).toString(16)}` as Hex
}

export function encodeIncrementCall(): Hex {
  return encodeFunctionData({
    abi: [
      {
        name: "increment",
        type: "function",
        inputs: [],
        outputs: [],
        stateMutability: "nonpayable"
      }
    ] as const,
    functionName: "increment"
  })
}

export function encodeExecute(target: Address, value: bigint, data: Hex): Hex {
  return encodeFunctionData({
    abi: [
      {
        name: "execute",
        type: "function",
        inputs: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" }
        ],
        outputs: [],
        stateMutability: "nonpayable"
      }
    ] as const,
    functionName: "execute",
    args: [target, value, data]
  })
}

// ---------------------- PREFUND (NO PAYMASTER) ----------------------
const MIN_AA_BALANCE = parseEther("0.005")

export async function ensureAaFunded(
  rpc: RpcClient,
  wallet: WalletClient,
  owner: OwnerAccount,
  smartAccount: Address
) {
  console.log(`
${YELLOW}[PREFUND CHECK — NO PAYMASTER]${RESET}
This demo has NO paymaster, so the Smart Account must prepay gas.
Checking Smart Account balance…
`)

  const aaBalance = await rpc.getBalance({ address: smartAccount })
  console.log(`Current Smart Account balance: ${aaBalance} wei`)

  if (aaBalance >= MIN_AA_BALANCE) {
    console.log(`${GREEN}Smart Account has enough funds. No top-up needed.${RESET}`)
    return
  }

  const needed = MIN_AA_BALANCE - aaBalance

  console.log(`
Smart Account requires additional ETH:
  Missing: ${needed.toString()} wei
Will top-up from Owner EOA…
`)

  const ownerBalance = await rpc.getBalance({ address: owner.address })
  console.log(`Owner EOA balance: ${ownerBalance} wei`)

  if (ownerBalance <= needed) {
    console.error("Owner does NOT have enough balance to fund the Smart Account.")
    process.exit(1)
  }

  const txHash = await wallet.sendTransaction({
    to: smartAccount,
    value: needed
  })

  console.log(`Top-up transaction sent: ${txHash}`)

  const receipt = await rpc.waitForTransactionReceipt({ hash: txHash })
  console.log(`Top-up confirmed in block ${receipt.blockNumber}\n`)
}

// ---------------------- GAS PRICES ----------------------
type BundlerGasPriceResponse = {
  result?: {
    standard?: {
      maxFeePerGas: bigint | string | number
      maxPriorityFeePerGas: bigint | string | number
    }
    fast?: {
      maxFeePerGas: bigint | string | number
      maxPriorityFeePerGas: bigint | string | number
    }
    slow?: {
      maxFeePerGas: bigint | string | number
      maxPriorityFeePerGas: bigint | string | number
    }
    maxFeePerGas?: bigint | string | number
    maxPriorityFeePerGas?: bigint | string | number
  }
}

export async function getBundlerGasPrices(bundlerUrl: string): Promise<GasPrices> {
  console.log(`
${CYAN}[BUNDLER GAS QUOTE]${RESET}
Requesting gas values from Pimlico bundler…
`)

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "pimlico_getUserOperationGasPrice",
    params: []
  }

  const res = await fetch(bundlerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then((r) => r.json() as Promise<BundlerGasPriceResponse>)

  const result = res.result
  if (!result) throw new Error("Bundler did not return gas price result")

  const gp = result.standard ?? result.fast ?? result.slow ?? result

  const maxFeePerGas = BigInt(gp.maxFeePerGas as bigint | number | string)
  const maxPriorityFeePerGas = BigInt(gp.maxPriorityFeePerGas as bigint | number | string)

  console.log(`
Bundler suggests:
  maxFeePerGas:        ${maxFeePerGas}
  maxPriorityFeePerGas:${maxPriorityFeePerGas}
`)

  return { maxFeePerGas, maxPriorityFeePerGas }
}

// ---------------------- COUNTER READ ----------------------
export async function readDemoCount(
  rpc: RpcClient,
  logic: Address,
  abi: readonly unknown[],
  label: string
) {
  console.log(`\n${MAGENTA}[COUNTER READ]${RESET} Reading DemoLogic count (${label})…`)

  const value = (await rpc.readContract({
    address: logic,
    abi,
    functionName: "getCount"
  })) as unknown as bigint

  console.log(`Counter value ${label}: ${value.toString()}\n`)
  return value
}

// ---------------------- SIGNATURE ----------------------
export async function signUserOperationHash(owner: OwnerAccount, rawHash: Hex): Promise<Hex> {
  console.log(`
${GREEN}[SIGNATURE]${RESET}
Owner EOA is signing the UserOperation hash.
`)

  const signature = (await owner.signMessage({
    message: { raw: rawHash }
  })) as Hex

  console.log(`Signature produced: ${signature}\n`)
  return signature
}

// ---------------------- WAIT RECEIPT ----------------------
export async function waitForReceipt(
  bundlerUrl: string,
  uoHash: string
): Promise<UserOperationReceipt> {
  console.log(`\n${CYAN}[RECEIPT CHECK]${RESET} Waiting for UserOperation receipt...`)

  while (true) {
    const req = {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getUserOperationReceipt",
      params: [uoHash]
    }

    const res = (await fetch(bundlerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req)
    }).then((r) => r.json())) as ReceiptResponse

    if (res.result) {
      console.log(`${GREEN}UserOperation RECEIPT FOUND:${RESET}`)
      console.log(JSON.stringify(res.result, null, 2))
      return res.result
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

// ---------------------- USEROP HELPERS ----------------------
export function buildUserOperation(params: {
  sender: Address
  nonce: bigint
  callData: Hex
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}): UserOperation {
  console.log(`
${CYAN}[BUILDING USER OPERATION]${RESET}
UserOp fields:
- sender: ${params.sender}
- nonce: ${params.nonce}
- gas: maxFeePerGas / maxPriorityFeePerGas from bundler
`)

  return {
    sender: params.sender,
    nonce: toHex(params.nonce),
    initCode: "0x",
    callData: params.callData,
    callGasLimit: toHex(250_000n),
    verificationGasLimit: toHex(250_000n),
    preVerificationGas: toHex(50_000n),
    maxFeePerGas: toHex(params.maxFeePerGas),
    maxPriorityFeePerGas: toHex(params.maxPriorityFeePerGas),
    paymasterAndData: "0x",
    signature: "0x"
  }
}

export function computeUserOpHash(sender: Address, nonce: bigint, callData: Hex): Hex {
  return keccak256(
    encodePacked(["address", "uint256", "bytes32"], [sender, nonce, keccak256(callData)])
  ) as Hex
}

// ---------------------- PAYMASTER SIGNATURE ----------------------
export async function buildPaymasterAndData(
  paymasterAddress: Address,
  paymasterPk: Hex,
  params: { sender: Address; callData: Hex; nonce: bigint }
): Promise<Hex> {
  console.log(`
${MAGENTA}[PAYMASTER SIGNATURE]${RESET}
Building paymaster hash for sponsorship:
- Covers sender, callData, nonce.
If signature is valid, Paymaster covers gas cost.
`)

  const account = privateKeyToAccount(paymasterPk)

  const pmHash = keccak256(
    encodePacked(["address", "bytes", "uint256"], [params.sender, params.callData, params.nonce])
  )

  console.log(`Paymaster hash:\n${pmHash}\nSigning with paymaster key…`)

  const signature = (await account.signMessage({
    message: { raw: pmHash }
  })) as Hex

  console.log(`Paymaster signature:\n${signature}\n`)

  return (paymasterAddress + signature.slice(2)) as Hex
}
