// Minimal EntryPoint ABI (only getNonce)
export const ENTRYPOINT_ABI = [
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

// DemoLogic ABI (only getCount)
export const DEMOLOGIC_ABI = [
  {
    name: "getCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  }
] as const

// Increment ABI (used to encode DemoLogic.increment)
export const INCREMENT_ABI = [
  {
    name: "increment",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  }
] as const

// SmartAccount.execute ABI
export const EXECUTE_ABI = [
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
] as const
