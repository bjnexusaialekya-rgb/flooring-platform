import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
  CreditCard,
  Truck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type NavItem = { to: string; label: string; icon: typeof ClipboardList };
type NavGroup = { group: string | null; items: NavItem[] };

const NAV_BY_ROLE: Record<string, NavGroup[]> = {
  client: [
    {
      group: null,
      items: [
        { to: '/work-orders', label: 'Work Orders', icon: ClipboardList },
        { to: '/work-orders/new', label: 'Submit New Order', icon: PlusCircle },
        { to: '/my-billing', label: 'Billing', icon: Receipt },
      ],
    },
  ],
  staff: [
    {
      group: 'Operations',
      items: [
        { to: '/work-orders', label: 'Work Order Queue', icon: ClipboardList },
        { to: '/project-trackers', label: 'Project Trackers', icon: FolderKanban },
        { to: '/inventory', label: 'Inventory', icon: Boxes },
        { to: '/purchase-orders', label: 'Purchase Orders', icon: Truck },
        { to: '/templates/import', label: 'Import Templates', icon: UploadCloud },
      ],
    },
  ],
  admin: [
    {
      group: 'Overview',
      items: [{ to: '/reports', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      group: 'Operations',
      items: [
        { to: '/work-orders', label: 'Work Order Queue', icon: ClipboardList },
        { to: '/project-trackers', label: 'Project Trackers', icon: FolderKanban },
        { to: '/inventory', label: 'Inventory', icon: Boxes },
        { to: '/purchase-orders', label: 'Purchase Orders', icon: Truck },
        { to: '/templates/import', label: 'Import Templates', icon: UploadCloud },
      ],
    },
    {
      group: 'Finance',
      items: [
        { to: '/billing', label: 'Billing', icon: Receipt },
        { to: '/admin-payments', label: 'Payments', icon: CreditCard },
      ],
    },
    {
      group: 'Admin',
      items: [
        { to: '/add-client', label: 'Add Login', icon: UserPlus },
        { to: '/add-company', label: 'Add Company', icon: Building2 },
      ],
    },
  ],
};

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  if (!user) return null;

  const navGroups = NAV_BY_ROLE[user.role] ?? [];

  return (
    <div className="min-h-screen flex bg-[var(--color-paper)]">
      <aside className="w-60 flex-shrink-0 bg-[var(--color-ink)] text-white flex flex-col">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="font-[var(--font-display)] font-semibold text-lg leading-tight">
            Trestle<span className="text-[var(--color-amber)]">.</span>
          </div>
          <div className="text-xs text-white/50 mt-0.5 uppercase tracking-wide">
            {user.role} portal
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {navGroups.map((section, gi) => (
            <div key={section.group ?? gi}>
              {section.group && (
                <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  {section.group}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/work-orders'}
                      className={({ isActive }) =>
                        [
                          'relative flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-md text-sm transition-colors',
                          isActive
                            ? 'bg-white/[0.08] text-white font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-[var(--color-amber)]'
                            : 'text-white/60 font-medium hover:bg-white/5 hover:text-white/90',
                        ].join(' ')
                      }
                    >
                      <Icon size={16} strokeWidth={2} />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
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
          {/* Keying on pathname re-triggers the CSS animation on every route
              change, giving navigation a soft fade+rise instead of an
              instant content swap. */}
          <div key={location.pathname} className="animate-page-in">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
