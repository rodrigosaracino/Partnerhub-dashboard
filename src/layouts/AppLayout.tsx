// layout
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="app-container bg-[var(--bg-primary)] text-white min-h-screen flex">
      <Sidebar />
      <main className="main-content flex-1 p-6 lg:ml-[260px]">
        <div className="max-w-6xl mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
