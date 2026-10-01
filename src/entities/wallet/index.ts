/**
 * Wallet entity
 * Exports wallet-related functionality
 */
export { WalletContextProvider } from './WalletProvider';
export {
  useWallet,
  useWalletWithErrorHandling,
  useWalletLogin,
  useActiveWalletInfo,
  useAccountIdentity,
  WalletModel,
  type AccountIdentity,
  type LoginMethod,
} from './model';
export { embeddedWalletsEnabled, solscanAccountUrl } from './privyConfig';
