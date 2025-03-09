import { Outlet } from 'react-router-dom';
import Header from '../shared/Header';

export function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <Outlet />
    </div>
  );
}
