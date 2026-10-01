/**
 * One-click trading feature
 * Delegates the Fermi account to a browser session key so orders sign without wallet prompts
 */
export { useOneClick, type OneClickStatus, type IntentSigner } from './model/useOneClick';
export { OneClickToggle } from './ui/OneClickToggle';
export { deleteSessionKey as forgetOneClickKey } from './lib/sessionKey';
