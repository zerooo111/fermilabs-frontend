/**
 * Mount this once inside WalletContextProvider. It runs the access-gate
 * lifecycle hook (status → silent re-sign or modal) and renders the
 * InviteCodeModal whenever a non-whitelisted wallet is connected.
 *
 * Holds no DOM by itself — modal mounts only when needed.
 */
import { ReactNode } from 'react';
import { useAccessGate } from '../model/useAccessGate';
import { InviteCodeModal } from './InviteCodeModal';

export function AccessGateProvider({ children }: { children: ReactNode }) {
  useAccessGate();
  return (
    <>
      {children}
      <InviteCodeModal />
    </>
  );
}
