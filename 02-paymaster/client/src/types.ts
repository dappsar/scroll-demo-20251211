export type Address = `0x${string}`
export type Hex = `0x${string}`

// Bundler gas price result
export interface GasPrices {
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

// Bundler sendUserOperation response
export interface BundlerSendUoResponse {
  result?: string
  error?: unknown
  [key: string]: unknown
}

// UserOperation Receipt
export interface UserOperationReceipt {
  userOpHash: string
  sender?: string
  nonce?: string
  actualGasCost?: string
  actualGasUsed?: string
  success?: boolean
  paymaster?: string | null
  logs?: unknown[]
  receipt?: {
    transactionHash?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface ReceiptResponse {
  result?: UserOperationReceipt | null
  error?: unknown
  [key: string]: unknown
}
