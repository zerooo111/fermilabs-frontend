/**
 * PostHogProvider.tsx
 * PostHog analytics provider for application-wide analytics tracking
 */
import { useEffect } from 'react';
import posthog from 'posthog-js';

const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_API_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

interface PostHogProviderProps {
  children: React.ReactNode;
}

export const PostHogProvider = ({ children }: PostHogProviderProps) => {
  useEffect(() => {
    // Only initialize if API key is provided
    if (POSTHOG_API_KEY) {
      posthog.init(POSTHOG_API_KEY, {
        api_host: POSTHOG_HOST,
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        loaded: posthog => {
          if (import.meta.env.DEV) {
            posthog.debug();
          }
        },
      });

      // Register environment as a super property on all events
      const environment =
        import.meta.env.VITE_ENVIRONMENT || (import.meta.env.DEV ? 'development' : 'production');
      posthog.register({ environment });
    }

    return () => {
      if (POSTHOG_API_KEY) {
        posthog.reset();
      }
    };
  }, []);

  return <>{children}</>;
};
