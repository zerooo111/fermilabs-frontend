/**
 * ErrorPage.tsx
 * Reusable error page component for displaying error states
 */

interface ErrorPageProps {
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

export function ErrorPage({
  title = 'Something went wrong',
  message = 'We encountered an unexpected error',
  actionText = 'Try Again',
  onAction,
}: ErrorPageProps) {
  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      // Default action: refresh the page
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="mb-6 text-red-500">
          <svg
            className="mx-auto h-16 w-16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error Content */}
        <h1 className="text-2xl font-bold text-white mb-3">{title}</h1>
        <p className="text-gray-400 mb-8">{message}</p>

        {/* Action Button */}
        <button
          onClick={handleAction}
          className="inline-flex items-center justify-center px-5 py-2 border border-transparent text-base font-medium rounded-md text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400 focus:ring-offset-gray-900"
        >
          {actionText}
        </button>
      </div>
    </div>
  );
}
