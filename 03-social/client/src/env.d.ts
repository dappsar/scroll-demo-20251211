/// <reference types="vite/client" />

type Address = `0x${string}`
type Hex = `0x${string}`

interface ImportMetaEnv {
  readonly VITE_SCROLL_RPC: string
  readonly VITE_BUNDLER_URL: string
  readonly VITE_SC_ENTRYPOINT_ADDRESS: Address
  readonly VITE_SC_DEMOLOGIC_ADDRESS: Address
  readonly VITE_SC_ACCOUNT_FACTORY_ADDRESS: Address
  readonly VITE_SC_PAYMASTER_ADDRESS: Address
  readonly VITE_PAYMASTER_SIGNER_PK: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_BACKEND_SALT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
