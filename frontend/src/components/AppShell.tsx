import { NavLink, Outlet } from 'react-router-dom';
import {
  ClipboardList,
  PlusCircle,
  Boxes,
  Receipt,
  LayoutDashboard,
  FolderKanban,
  LogOut,
  UploadCloud,
  UserPlus,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_BY_ROLE: Record<string, { to: string; label: string; icon: typeof ClipboardList }[]> = {
  client: [
    { to: '/work-orders', label: 'Work Orders', icon: ClipboardList },
    { to: '/work-orders/new', label: 'Submit New Order', icon: PlusCircle },
    { to: '/my-billing', label: 'Billing', icon: Receipt },
  ],
  staff: [
    { to: '/work-orders', label: 'Work Order Queue', icon: ClipboardList },
    { to: '/project-trackers', label: 'Project Trackers', icon: FolderKanban },
    { to: '/inventory', label: 'Inventory', icon: Boxes },
    { to: '/templates/import', label: 'Import Templates', icon: UploadCloud },
  ],
  admin: [
    { to: '/reports', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/work-orders', label: 'Work Order Queue', icon: ClipboardList },
    { to: '/project-trackers', label: 'Project Trackers', icon: FolderKanban },
    { to: '/inventory', label: 'Inventory', icon: Boxes },
    { to: '/billing', label: 'Billing', icon: Receipt },
    { to: '/templates/import', label: 'Import Templates', icon: UploadCloud },
    { to: '/add-client', label: 'Add Client', icon: UserPlus },
    { to: '/add-company', label: 'Add Company', icon: Building2 },
  ],
};

export function AppShell() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const navItems = NAV_BY_ROLE[user.role] ?? [];

  return (
    <div className="min-h-screen flex bg-[var(--color-paper)]">
      <aside className="w-60 flex-shrink-0 bg-[var(--color-ink)] text-white flex flex-col">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="font-[var(--font-display)] font-semibold text-lg leading-tight">
            Oakridge<span className="text-[var(--color-amber)]">.</span>
          </div>
          <div className="text-xs text-white/50 mt-0.5 uppercase tracking-wide">
            {user.role} portal
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/work-orders'}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
                  ].join(' ')
                }
              >
                <Icon size={16} strokeWidth={2} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <div className="text-sm font-medium truncate">{user.displayName}</div>
          <div className="text-xs text-white/50 truncate mb-3">{user.email}</div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
