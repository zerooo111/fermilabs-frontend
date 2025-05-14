/**
 * App entry point
 * Exports the main App component and providers
 */
import { AppProviders } from './providers';
import { AppRouter } from './router';
import styles from './styles.module.css';

export const App = () => {
  return (
    <AppProviders>
      <div className={styles.appContainer}>
        <AppRouter />
      </div>
    </AppProviders>
  );
};

export default App;
