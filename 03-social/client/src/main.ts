// src/main.ts

import {
  createPublicClient,
  encodeFunctionData,
  encodePacked,
  http,
  keccak256,
  stringToBytes
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { scrollSepolia } from "viem/chains"

import { extractPkFromGoogleRedirect, startGoogleLogin } from "./google"
import {
  $,
  log,
  makeLogPanelDraggable,
  setCount,
  setStatus,
  showLoggedInUI,
  showLoggedOutUI
} from "./ui"

type Address = `0x${string}`
type Hex = `0x${string}`

// ============================================================================
// USER OPERATION TYPES
// ============================================================================

/**
 * UserOperation formatted for bundler RPC (numeric values as hex).
 */
type SimpleUserOperation = {
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

/**
 * UserOperation formatted for EntryPoint.getUserOpHash (numeric values bigint).
 */
type EntryPointUserOperation = {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymasterAndData: Hex
  signature: Hex
}

function toEntryPointUserOp(op: SimpleUserOperation): EntryPointUserOperation {
  return {
    sender: op.sender,
    nonce: BigInt(op.nonce),
    initCode: op.initCode,
    callData: op.callData,
    callGasLimit: BigInt(op.callGasLimit),
    verificationGasLimit: BigInt(op.verificationGasLimit),
    preVerificationGas: BigInt(op.preVerificationGas),
    maxFeePerGas: BigInt(op.maxFeePerGas),
    maxPriorityFeePerGas: BigInt(op.maxPriorityFeePerGas),
    paymasterAndData: op.paymasterAndData,
    signature: op.signature
  }
}

// ============================================================================
// ENV + RPC CLIENT
// ============================================================================

const entryPointAddress = import.meta.env.VITE_SC_ENTRYPOINT_ADDRESS as Address
const logicAddress = import.meta.env.VITE_SC_DEMOLOGIC_ADDRESS as Address
const factoryAddress = import.meta.env.VITE_SC_ACCOUNT_FACTORY_ADDRESS as Address
const paymasterAddress = import.meta.env.VITE_SC_PAYMASTER_ADDRESS as Address

// VITE_BACKEND_SALT puede ser cualquier string.
// Lo convertimos a bytes32 con keccak256 para cumplir el ABI.
const backendSaltEnv = import.meta.env.VITE_BACKEND_SALT
if (!backendSaltEnv) {
  throw new Error("Missing VITE_BACKEND_SALT")
}
const backendSalt = keccak256(stringToBytes(backendSaltEnv)) as Hex

const publicClient = createPublicClient({
  chain: scrollSepolia,
  transport: http(import.meta.env.VITE_SCROLL_RPC)
})

// ============================================================================
// CONTRACT ABIs
// ============================================================================

const demoLogicAbi = [
  {
    name: "increment",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: []
  },
  {
    name: "getCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  }
] as const

const demoAccountAbi = [
  {
    name: "execute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" }
    ],
    outputs: []
  }
] as const

const factoryAbi = [
  {
    name: "createAccount",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "uuidString", type: "string" },
      { name: "backendSalt", type: "bytes32" },
      { name: "entryPoint", type: "address" },
      { name: "initialOwner", type: "address" }
    ],
    outputs: [{ type: "address" }]
  },
  {
    name: "getAddress",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "uuidString", type: "string" },
      { name: "backendSalt", type: "bytes32" },
      { name: "entryPoint", type: "address" }
    ],
    outputs: [{ type: "address" }]
  }
] as const

const entryPointAbi = [
  {
    name: "getUserOpHash",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "userOp",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "callGasLimit", type: "uint256" },
          { name: "verificationGasLimit", type: "uint256" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "maxFeePerGas", type: "uint256" },
          { name: "maxPriorityFeePerGas", type: "uint256" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" }
        ]
      }
    ],
    outputs: [{ type: "bytes32" }]
  }
] as const

// ABI to read nonce correctly
const entryPointNonceAbi = [
  {
    name: "getNonce",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "sender", type: "address" },
      { name: "key", type: "uint192" }
    ],
    outputs: [{ type: "uint256" }]
  }
] as const

// ============================================================================
// GLOBAL STATE
// ============================================================================

let ownerPk: Hex | null = null
let smartAccountAddress: Address | null = null
let uuidString: string | null = null

// ============================================================================
// SMART ACCOUNT HELPERS
// ============================================================================

/**
 * Returns true if a smart account already exists on-chain.
 */
async function smartAccountExists(addr: Address): Promise<boolean> {
  const code = await publicClient.getCode({ address: addr })

  // Debug crudo para ver qué devuelve realmente el RPC
  log(`EVM code at ${addr}: ${String(code)}`)

  // Sin código: undefined / null
  if (!code) return false

  const normalized = code.toLowerCase()

  // Sin código: "0x" o "0x0" o variantes mínimas
  if (normalized === "0x" || normalized === "0x0") return false

  // Con código real: algo más que solo "0x"
  return normalized.length > 2
}

/**
 * Shows the first 5 characters and replaces the rest with '*'.
 * Example: "1234567890" => "12345*****"
 */
export function maskAfterFive(input: string): string {
  if (input.length <= 5) return input
  const firstFive = input.slice(0, 5)
  const masked = "*".repeat(input.length - 5)
  return firstFive + masked
}

/**
 * Computes deterministic AA address using AccountFactory.getAddress(),
 * and logs whether it's already deployed.
 */
async function ensureSmartAccount(): Promise<Address> {
  if (!ownerPk) throw new Error("Missing owner PK")
  if (!uuidString) throw new Error("Missing uuidString")

  log(`uuidString: ${maskAfterFive(uuidString)}`)
  log(`backendSalt (hex): ${backendSalt}`)

  const computed = (await publicClient.readContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "getAddress",
    args: [uuidString, backendSalt, entryPointAddress]
  })) as Address

  log(`Computed smart account: ${computed}`)

  const exists = await smartAccountExists(computed)
  log(`smartAccountExists? (${computed}) = ${exists}`)

  smartAccountAddress = computed
  return computed
}

// ============================================================================
// PAYMASTER SIGNATURE
// ============================================================================

function getPaymasterSignerPk(): Hex | null {
  const pk = import.meta.env.VITE_PAYMASTER_SIGNER_PK
  if (!pk || pk.trim() === "") return null
  return pk as Hex
}

/**
 * Signs digest = keccak(sender, callData, nonce).
 */
async function signPaymaster(userOp: SimpleUserOperation): Promise<Hex | null> {
  const pk = getPaymasterSignerPk()
  if (!pk) return null

  const acc = privateKeyToAccount(pk)

  const digest = keccak256(
    encodePacked(
      ["address", "bytes", "uint256"],
      [userOp.sender, userOp.callData, BigInt(userOp.nonce)]
    )
  )

  log(`Paymaster:${paymasterAddress}`)

  const sig = await acc.signMessage({ message: { raw: digest } })
  log("Paymaster signature created.")
  return sig as Hex
}

// ============================================================================
// SEND USER OPERATION
// ============================================================================

async function sendUserOp() {
  if (!ownerPk) {
    log("Cannot send UserOperation: not logged in.")
    return
  }
  if (!uuidString) {
    throw new Error("Missing uuidString (expected from Google sub / aa-uuid)")
  }

  setStatus("Preparing UserOperation...")
  log("Preparing UserOperation...")

  const owner = privateKeyToAccount(ownerPk)

  // 1) Compute deterministic smart account address
  const sender = await ensureSmartAccount()
  const exists = await smartAccountExists(sender)

  // 2) Fetch correct nonce from EntryPoint
  const epNonce = (await publicClient.readContract({
    address: entryPointAddress,
    abi: entryPointNonceAbi,
    functionName: "getNonce",
    args: [sender, 0n]
  })) as bigint

  log(`EntryPoint nonce: ${epNonce}`)

  // 3) Prepare DemoLogic.increment call
  const logicCall = encodeFunctionData({
    abi: demoLogicAbi,
    functionName: "increment",
    args: []
  })

  // 4) Wrap in DemoAccount.execute()
  const callData = encodeFunctionData({
    abi: demoAccountAbi,
    functionName: "execute",
    args: [logicAddress, 0n, logicCall]
  })

  // 5) initCode:
  //    - si la cuenta NO existe => factory.createAccount(...)
  //    - si la cuenta YA existe => initCode = "0x" (obligatorio, sino AA10)
  let initCode: Hex
  if (exists) {
    log(
      `Smart account is already deployed: ${sender}. Using empty initCode (required by EntryPoint).`
    )
    initCode = "0x" as Hex
  } else {
    log(
      `Smart account NOT deployed on-chain yet: ${sender}. Adding factory.createAccount to initCode.`
    )

    const initCallData = encodeFunctionData({
      abi: factoryAbi,
      functionName: "createAccount",
      args: [uuidString, backendSalt, entryPointAddress, owner.address as Address]
    })

    initCode = (factoryAddress + initCallData.slice(2)) as Hex
  }

  // 6) Build UserOperation
  const userOp: SimpleUserOperation = {
    sender,
    nonce: `0x${epNonce.toString(16)}` as Hex,
    initCode,
    callData,
    callGasLimit: "0x350000",
    verificationGasLimit: "0x150000",
    preVerificationGas: "0x40000",
    maxFeePerGas: "0x2540be400",
    maxPriorityFeePerGas: "0x2540be400",
    paymasterAndData: "0x",
    signature: "0x"
  }

  // 7) Paymaster signing
  const pmSig = await signPaymaster(userOp)
  if (pmSig) {
    userOp.paymasterAndData = (paymasterAddress + pmSig.slice(2)) as Hex
  }

  // 8) Compute userOpHash
  const opForHash = toEntryPointUserOp(userOp)

  const userOpHash = (await publicClient.readContract({
    address: entryPointAddress,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [opForHash]
  })) as Hex

  log(`UserOp hash: ${userOpHash}`)

  // 9) Owner signature
  const ownerSig = await owner.signMessage({
    message: { raw: userOpHash }
  })
  userOp.signature = ownerSig as Hex

  // 10) Send to bundler
  const res = await fetch(import.meta.env.VITE_BUNDLER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_sendUserOperation",
      params: [userOp, entryPointAddress]
    })
  })

  const json = await res.json()
  log("Bundler response:")
  log(JSON.stringify(json, null, 2))

  setStatus("UserOperation sent.")
}

// ============================================================================
// COUNTER HELPERS
// ============================================================================

async function refreshCount() {
  const count = await publicClient.readContract({
    address: logicAddress,
    abi: demoLogicAbi,
    functionName: "getCount"
  })

  const value = count.toString()
  setCount(value)
  log(`Counter value: ${value}`)
}

// ============================================================================
// LOGIN / LOGOUT
// ============================================================================

function logout() {
  ownerPk = null
  smartAccountAddress = null
  uuidString = null
  localStorage.removeItem("aa-owner-pk")
  localStorage.removeItem("aa-smart-account")
  localStorage.removeItem("aa-uuid")
  showLoggedOutUI()
  setStatus("Logged out.")
  setCount("-")
}

async function restoreSession() {
  const savedPk = localStorage.getItem("aa-owner-pk")
  const savedUuid = localStorage.getItem("aa-uuid")
  if (!savedPk || !savedUuid) return false

  ownerPk = savedPk as Hex
  uuidString = savedUuid

  const owner = privateKeyToAccount(ownerPk)

  const savedSa = localStorage.getItem("aa-smart-account")
  if (savedSa) {
    smartAccountAddress = savedSa as Address
    log(`Restored smart account from storage: ${smartAccountAddress}`)
  } else {
    await ensureSmartAccount()
  }

  showLoggedInUI(owner.address, smartAccountAddress as Address)
  setStatus("Session restored.")

  return true
}

async function handleGoogleRedirect() {
  const pk = extractPkFromGoogleRedirect()
  if (!pk) return false

  ownerPk = pk
  localStorage.setItem("aa-owner-pk", pk)

  const storedUuid = localStorage.getItem("aa-uuid")
  if (!storedUuid) {
    throw new Error("Missing aa-uuid from Google redirect")
  }

  const versionedUuid = `${storedUuid}:V2`
  uuidString = versionedUuid
  localStorage.setItem("aa-uuid", versionedUuid)

  const owner = privateKeyToAccount(pk)
  const sa = await ensureSmartAccount()

  localStorage.setItem("aa-smart-account", sa)

  showLoggedInUI(owner.address, sa)
  setStatus("Logged in with Google.")

  return true
}

// ============================================================================
// INIT
// ============================================================================

async function init() {
  makeLogPanelDraggable()
  showLoggedOutUI()
  setStatus("Idle.")

  const handled = await handleGoogleRedirect()
  if (!handled) await restoreSession()

  $("googleLogin").onclick = () => startGoogleLogin()
  $("logoutBtn").onclick = () => logout()

  $("sendOp").onclick = () =>
    void sendUserOp().catch((err) => {
      console.error(err)
      log(`Error sending UserOperation: ${String(err)}`)
      setStatus("Error")
    })

  $("refreshCount").onclick = () =>
    void refreshCount().catch((err) => {
      console.error(err)
      log(`Error refreshing counter: ${String(err)}`)
    })
}

init()
