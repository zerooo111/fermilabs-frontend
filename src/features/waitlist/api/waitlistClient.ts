import axios, { AxiosError } from 'axios';
import { config } from '@/shared/config/constants';

export interface WaitlistReq {
  email: string;
  twitter?: string;
  source?: string;
}

export class WaitlistError extends Error {
  constructor(
    public code: string,
    public httpStatus?: number
  ) {
    super(code);
    this.name = 'WaitlistError';
  }
}

export async function submitWaitlist(req: WaitlistReq): Promise<{ ok: true }> {
  try {
    const res = await axios.post<{ ok: true }>(
      `${config.devnet.gatewayUrl}/v1/access/waitlist`,
      req
    );
    return res.data;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const ax = e as AxiosError<{ error?: string }>;
      throw new WaitlistError(ax.response?.data?.error || 'network_error', ax.response?.status);
    }
    throw new WaitlistError('unknown_error');
  }
}
