/// <reference types="vite/client" />

/** Unique per build; matches /version.json of the deploy that served this bundle. */
declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_COMMITMENT?: string;
  readonly VITE_MANGO_PROGRAM_ID?: string;
  readonly VITE_MANGO_GROUP_PK?: string;
  readonly VITE_MANGO_DEPOSIT_UI_AMOUNT?: string;
  readonly VITE_MARKET_ID?: string;
  readonly VITE_DEFAULT_MARKET_ADDRESS?: string;
  readonly VITE_BASE_MINT?: string;
  readonly VITE_QUOTE_MINT?: string;
  readonly VITE_VAULT_PROGRAM_ID?: string;
  readonly VITE_FERMI_AUTHORITY?: string;
  readonly VITE_FLP_RPC_URL?: string;
  readonly VITE_FLP_API_URL?: string;
  /** Gateway with the vault sync (/v2/vaults); unset means FLP vaults only. */
  readonly VITE_VAULTS_GATEWAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
