export { ReferralDashboard } from './ui/ReferralDashboard';
export { useReferrals } from './model/useReferrals';
export { ReferralsError } from './api/referralsClient';
export { REWARD_RATE_BPS, REWARD_RATE_LABEL, MAX_CODES_PER_WALLET } from './model/constants';
export type {
  ReferralMe,
  ReferralBinding,
  RefereeView,
  CreatedCode,
  BindResult,
  PayoutRequest,
  Payout,
  PayoutStatus,
} from './api/referralsClient';
