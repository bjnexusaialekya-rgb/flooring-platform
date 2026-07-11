import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  HardHat,
  Store,
  Menu,
  Search,
  Bell,
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
        { to: '/installers', label: 'Installers', icon: HardHat },
        { to: '/vendors', label: 'Vendors', icon: Store },
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
        { to: '/installers', label: 'Installers', icon: HardHat },
        { to: '/vendors', label: 'Vendors', icon: Store },
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

// Per-route topbar title + optional primary CTA. Matched by longest
// prefix so "/work-orders/new" doesn't fall back to the parent's config.
// Not every page needs a CTA (e.g. Reports, Billing) — omit actionTo/actionLabel
// for those and the button simply won't render.
// `searchable` gates the search box itself — only render it on pages that
// actually consume the query. Showing it everywhere but only wiring it up
// on one page is exactly the "looks broken" problem we already hit once;
// don't repeat it on the other 8 routes.
type TopbarConfig = { title: string; actionLabel?: string; actionTo?: string; searchable?: boolean };

const TOPBAR_ROUTES: [string, TopbarConfig][] = [
  ['/work-orders/new', { title: 'Submit New Order' }],
  [
    '/work-orders',
    { title: 'Work Orders', actionLabel: 'New Work Order', actionTo: '/work-orders/new', searchable: true },
  ],
  ['/project-trackers', { title: 'Project Trackers' }],
  ['/inventory', { title: 'Inventory' }],
  ['/purchase-orders', { title: 'Purchase Orders' }],
  ['/installers', { title: 'Installers' }],
  ['/vendors', { title: 'Vendors' }],
  ['/templates/import', { title: 'Import Templates' }],
  ['/my-billing', { title: 'Billing' }],
  ['/billing', { title: 'Billing' }],
  ['/reports', { title: 'Dashboard' }],
  ['/add-client', { title: 'Add Login' }],
  ['/add-company', { title: 'Add Company' }],
  ['/admin-payments', { title: 'Payments' }],
];

function getTopbarConfig(pathname: string, role: string): TopbarConfig {
  const match = TOPBAR_ROUTES
    .filter(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'))
    .sort((a, b) => b[0].length - a[0].length)[0];
  const config = match ? match[1] : { title: 'Trestle' };
  // Clients get their own inline "Submit Work Order" button (with
  // role-specific copy) directly on the page, so the topbar shouldn't
  // duplicate it — only staff/admin see the topbar CTA.
  if (role === 'client') return { title: config.title };
  return config;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // Reset the query on navigation — otherwise a search typed on Work
  // Orders would silently carry over and look like it's filtering
  // whatever page you land on next, which it isn't.
  useEffect(() => {
    setSearchQuery('');
  }, [location.pathname]);

  if (!user) return null;

  const navGroups = NAV_BY_ROLE[user.role] ?? [];
  const topbar = getTopbarConfig(location.pathname, user.role);

  return (
    // h-screen + overflow-hidden on the outer row (not min-h-screen) is the
    // scroll-bug fix: previously, tall content on a short viewport scrolled
    // the WHOLE page (sidebar included), pushing "Sign out" off-screen.
    // Now only <main> scrolls; the sidebar is pinned full-height.
    <div className="h-screen flex bg-[var(--color-canvas)] overflow-hidden">
      <aside className="w-60 flex-shrink-0 app-sidebar text-white flex flex-col h-full">
        <div className="px-5 py-6 border-b border-white/10 flex-shrink-0">
          <div className="font-[var(--font-display)] font-semibold text-lg leading-tight">
            {/* Amber-leak fix: this dot was on --color-amber, which is
                reserved exclusively for the pricing-blind boundary
                (WorkOrderDetailPage's staff-only cost table). Branding
                marks use --color-accent-on-dark instead. */}
            Trestle<span className="text-[var(--color-accent-on-dark)]">.</span>
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
                            ? 'bg-white/[0.08] text-white font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-[var(--color-accent-on-dark)]'
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

        <div className="px-5 py-4 border-t border-white/10 flex-shrink-0">
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

      <main className="flex-1 overflow-y-auto h-full flex flex-col">
        {/* Topbar: hamburger is decorative for now (no collapse behavior
            wired yet — sidebar isn't collapsible). Search only renders on
            routes marked searchable in TOPBAR_ROUTES, and is wired to the
            actual page via Outlet context — see WorkOrdersListPage for the
            consumer side. Bell has no live notification source in the
            backend, so no badge count is shown until one exists. */}
        <div className="flex-shrink-0 border-b border-[var(--color-concrete-light)] bg-[var(--color-panel)] px-8 py-4 flex items-center gap-4">
          <button
            type="button"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-ink)] hover:bg-[var(--color-paper)] shrink-0"
            aria-label="Toggle menu"
          >
            <Menu size={18} />
          </button>
          <h1 className="font-[var(--font-display)] font-semibold text-xl text-[var(--color-ink)] shrink-0">
            {topbar.title}
          </h1>
          {topbar.searchable && (
            <div className="flex-1 flex items-center gap-2 max-w-md ml-4">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-concrete)]"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search PO number, customer, address, installer..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--color-concrete-light)] bg-[var(--color-paper)] text-[var(--color-ink)] placeholder:text-[var(--color-concrete)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                />
              </div>
            </div>
          )}
          <button
            type="button"
            className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-ink)] hover:bg-[var(--color-paper)] shrink-0 ml-auto"
            aria-label="Notifications"
          >
            <Bell size={18} />
          </button>
          {topbar.actionTo && topbar.actionLabel && (
            <button
              type="button"
              onClick={() => navigate(topbar.actionTo!)}
              className="btn-cta-gradient text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              <PlusCircle size={16} />
              {topbar.actionLabel}
            </button>
          )}
        </div>

        <div className="max-w-6xl mx-auto px-8 py-8 w-full">
          {/* Keying on pathname re-triggers the CSS animation on every route
              change, giving navigation a soft fade+rise instead of an
              instant content swap. */}
          <div key={location.pathname} className="animate-page-in">
            <Outlet context={{ searchQuery }} />
          </div>
        </div>
      </main>
    </div>
  );
}
