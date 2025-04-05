/**
 * App entry point
 * Exports the main App component and providers
 */
import { AppProviders } from './providers';
import { AppRouter } from './router';

export const App = () => {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
};

export default App;
