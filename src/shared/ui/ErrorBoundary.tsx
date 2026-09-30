/**
 * ErrorBoundary.tsx
 * React error boundary component for graceful error handling
 */
import { Component, ReactNode, ErrorInfo } from 'react';
import { toast } from 'sonner';
import posthog from 'posthog-js';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo);
    toast.error('Something went wrong. Please try again later.');
    posthog.capture('error_boundary_triggered', {
      error_message: error.message,
      error_name: error.name,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 border border-negative-line bg-negative-muted">
          <h2 className="text-lg font-semibold mb-2 text-negative-fg">Something went wrong</h2>
          <p className="text-sm mb-4 text-fg-secondary">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            className="px-4 py-2 border border-line bg-surface-raised text-fg-primary hover:bg-state-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
