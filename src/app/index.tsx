/**
 * App entry point
 * Exports the main App component and providers
 */
import { AppProviders } from './providers';
import { AppRouter } from './router';

export const App = () => {
  return (
    <div className="bg-background text-zinc-100">
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </div>
  );
};

export default App;
