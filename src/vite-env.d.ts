/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_COMMITMENT?: string;
  readonly VITE_MARKET_ID?: string;
  readonly VITE_DEFAULT_MARKET_ADDRESS?: string;
  readonly VITE_BASE_MINT?: string;
  readonly VITE_QUOTE_MINT?: string;
  readonly VITE_VAULT_PROGRAM_ID?: string;
  readonly VITE_FERMI_AUTHORITY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
