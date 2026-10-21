import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { StatusBar } from './StatusBar';

export function Layout() {
  return (
    <div className="flex flex-col min-h-[calc(100vh_-_var(--announce-h,0px))] pb-6">
      <Header />
      <Outlet />
      <StatusBar />
    </div>
  );
}
