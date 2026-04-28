/**
 * REST client for /v1/access/* endpoints.
 *
 * Errors are returned as `{ error: '<code>' }` from the backend; we surface
 * the raw code so the UI can map to friendly copy.
 */
import axios, { AxiosError } from 'axios';
import { config } from '@/shared/config/constants';

const baseUrl = (): string => config.devnet.gatewayUrl;

export interface StatusResp {
  whitelisted: boolean;
}

export interface ChallengeResp {
  nonce: string;
  message: string;
  issued_at: string;
  expires_at: string;
}

export interface AccessGrantedResp {
  ok: true;
  token: string;
  expires_at: number;
}

export class AccessGateError extends Error {
  constructor(
    public code: string,
    public httpStatus?: number
  ) {
    super(code);
    this.name = 'AccessGateError';
  }
}

function unwrapError(e: unknown): never {
  if (axios.isAxiosError(e)) {
    const ax = e as AxiosError<{ error?: string }>;
    const code = ax.response?.data?.error || 'network_error';
    throw new AccessGateError(code, ax.response?.status);
  }
  throw new AccessGateError('unknown_error');
}

export async function fetchStatus(wallet: string): Promise<StatusResp> {
  try {
    const res = await axios.get<StatusResp>(`${baseUrl()}/v1/access/status`, {
      params: { wallet },
    });
    return res.data;
  } catch (e) {
    unwrapError(e);
  }
}

export async function requestChallenge(
  wallet: string,
  purpose: 'redeem' | 'session'
): Promise<ChallengeResp> {
  try {
    const res = await axios.post<ChallengeResp>(`${baseUrl()}/v1/access/challenge`, {
      wallet,
      purpose,
    });
    return res.data;
  } catch (e) {
    unwrapError(e);
  }
}

export async function redeemInvite(args: {
  wallet: string;
  code: string;
  nonce: string;
  signature: string;
}): Promise<AccessGrantedResp> {
  try {
    const res = await axios.post<AccessGrantedResp>(`${baseUrl()}/v1/access/redeem`, args);
    return res.data;
  } catch (e) {
    unwrapError(e);
  }
}

export async function exchangeSession(args: {
  wallet: string;
  nonce: string;
  signature: string;
}): Promise<AccessGrantedResp> {
  try {
    const res = await axios.post<AccessGrantedResp>(`${baseUrl()}/v1/access/session`, args);
    return res.data;
  } catch (e) {
    unwrapError(e);
  }
}
