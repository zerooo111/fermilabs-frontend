import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-canvas text-fg-primary">
      <Header />
      <Outlet />
    </div>
  );
}
