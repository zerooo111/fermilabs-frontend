/**
 * Keeps `gateScopeAtom` on the current route. Mounted inside the router (the
 * gate provider sits above it), so the scope changes with the URL, before a
 * lazy page has loaded.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { gateScopeAtom, gateScopeOf } from '../model/accessAtoms';

export function GateScopeSync() {
  const { pathname } = useLocation();
  const setScope = useSetAtom(gateScopeAtom);
  useEffect(() => setScope(gateScopeOf(pathname)), [pathname, setScope]);
  return null;
}
