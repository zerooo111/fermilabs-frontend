/**
 * App.tsx
 * Main application component with wallet context integration
 */
import { useMarket } from '@/hooks/useMarket';
import { ErrorPage } from './components/ErrorPage';

const App = () => {
  const { marketAccount, marketAddress, error, isLoading } = useMarket();

  if (error) {
    return (
      <ErrorPage
        title="Invalid Market"
        message="The specified market address is not valid. Please check the URL and try again."
        actionText="Go to Default Market"
        onAction={() => {
          window.location.href = window.location.pathname;
        }}
      />
    );
  }

  if (isLoading || !marketAddress || !marketAccount) {
    return <div className="min-h-screen grid place-items-center">Loading market data...</div>;
  }

  return <div className="min-h-screen bg-zinc-50 p-4"></div>;
};

export default App;
