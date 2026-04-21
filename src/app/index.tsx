/**
 * App entry point
 * Exports the main App component and providers
 */
import { AppProviders } from './providers';
import { AppRouter } from './router';
import { V2ReadLayerToggle } from '@/shared/ui/V2ReadLayerToggle';

export const App = () => {
  return (
    <div className="bg-background text-zinc-100">
      <AppProviders>
        <AppRouter />
        <V2ReadLayerToggle />
      </AppProviders>
    </div>
  );
};

export default App;
