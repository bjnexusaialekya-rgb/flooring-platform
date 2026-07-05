#!/bin/bash
set -e
echo "=== 1. Adding GET /units/properties endpoint ==="
node <<'JSEOF'
const fs = require('fs');
const path = '/workspaces/flooring-platform/backend/src/routes/unitRoutes.js';
let content = fs.readFileSync(path, 'utf8');

const oldTop = `const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);`;
const newTop = `const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /units/properties
 * Simple id+name list for populating dropdowns (e.g. the Billing page
 * property selector), instead of admin needing to know a raw UUID.
 */
router.get('/properties', requireRole('staff', 'admin'), async (req, res) => {
  try {
    const { pool } = require('../db/pool');
    const result = await pool.query('SELECT id, name FROM properties ORDER BY name');
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List properties error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});`;

if (!content.includes(oldTop)) {
  console.log('FAIL: unitRoutes.js top block not matched');
  process.exit(1);
}
content = content.replace(oldTop, newTop);
fs.writeFileSync(path, content);
console.log('OK: /units/properties endpoint added');
JSEOF

echo "=== 2. Replacing Billing page Property ID field with a dropdown ==="
node <<'JSEOF'
const fs = require('fs');
const path = '/workspaces/flooring-platform/frontend/src/pages/BillingPage.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldImport = `import { api } from '../lib/api';`;
const newImport = `import { useEffect as useEffectAlias } from 'react';
import { api } from '../lib/api';`;
// (import already has useEffect from react in the existing file; no duplicate needed)

const oldState = `  const [propertyId, setPropertyId] = useState('');`;
const newState = `  const [propertyId, setPropertyId] = useState('');
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);`;

const oldEffect = `  useEffect(() => {
    api.get<SyncFailure[]>('/qbo/sync-failures').then(setFailures).catch(() => {});
    api.get<BillingBatch[]>('/billing/batches').then(setBatches).catch(() => {});
  }, []);`;
const newEffect = `  useEffect(() => {
    api.get<SyncFailure[]>('/qbo/sync-failures').then(setFailures).catch(() => {});
    api.get<BillingBatch[]>('/billing/batches').then(setBatches).catch(() => {});
    api.get<{ id: string; name: string }[]>('/units/properties').then(setProperties).catch(() => {});
  }, []);`;

const oldInput = `        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Property ID</label>
          <input
            required
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm font-mono"
            placeholder="uuid"
          />
        </div>`;
const newInput = `        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Property</label>
          <select
            required
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm"
          >
            <option value="">Select a property…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>`;

let ok = true;
if (!content.includes(oldState)) { console.log('FAIL: state block not found'); ok = false; }
if (!content.includes(oldEffect)) { console.log('FAIL: effect block not found'); ok = false; }
if (!content.includes(oldInput)) { console.log('FAIL: input block not found'); ok = false; }

if (ok) {
  content = content.replace(oldState, newState);
  content = content.replace(oldEffect, newEffect);
  content = content.replace(oldInput, newInput);
  fs.writeFileSync(path, content);
  console.log('OK: Property ID field replaced with dropdown');
} else {
  process.exit(1);
}
JSEOF

echo "=== 3. Creating AddClientPage.tsx ==="
cat > /workspaces/flooring-platform/frontend/src/pages/AddClientPage.tsx << 'TSXEOF'
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

export function AddClientPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    try {
      await api.post('/auth/register', {
        displayName,
        email,
        password,
        role: 'client',
        clientId,
      });
      setResult(`Client login created for ${email}.`);
      setDisplayName('');
      setEmail('');
      setPassword('');
      setClientId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client login');
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)] mb-1">
        Add Client
      </h1>
      <p className="text-sm text-[var(--color-concrete)] mb-6">
        Create a login for a new property manager.
      </p>
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6 space-y-4"
      >
        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Display Name</label>
          <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Temporary Password</label>
          <input required type="text" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Client ID</label>
          <input required value={clientId} onChange={(e) => setClientId(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm font-mono"
            placeholder="uuid" />
        </div>
        {error && <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-3 py-2">{error}</div>}
        {result && <div className="text-sm text-[var(--color-success)] bg-[var(--color-success-soft)] rounded-md px-3 py-2">{result}</div>}
        <button type="submit" className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-medium text-sm rounded-md py-2.5 transition-colors">
          Create Client Login
        </button>
      </form>
    </div>
  );
}
TSXEOF
echo "OK: AddClientPage.tsx created"

echo "=== 4. Wiring App.tsx route ==="
node <<'JSEOF'
const fs = require('fs');
const path = '/workspaces/flooring-platform/frontend/src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldImport = `import { ClientBillingPage } from './pages/ClientBillingPage';`;
const newImport = oldImport + `
import { AddClientPage } from './pages/AddClientPage';`;

const oldRoute = `            <Route
              path="/reports"
              element={
                <RoleGuard roles={['admin']}>
                  <ReportsPage />
                </RoleGuard>
              }
            />`;
const newRoute = oldRoute + `
            <Route
              path="/add-client"
              element={
                <RoleGuard roles={['admin']}>
                  <AddClientPage />
                </RoleGuard>
              }
            />`;

let ok = true;
if (!content.includes(oldImport)) { console.log('FAIL: import not found'); ok = false; }
if (!content.includes(oldRoute)) { console.log('FAIL: route block not found'); ok = false; }

if (ok) {
  content = content.replace(oldImport, newImport);
  content = content.replace(oldRoute, newRoute);
  fs.writeFileSync(path, content);
  console.log('OK: /add-client route added');
} else {
  process.exit(1);
}
JSEOF

echo "=== 5. Adding admin nav link ==="
node <<'JSEOF'
const fs = require('fs');
const path = '/workspaces/flooring-platform/frontend/src/components/AppShell.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldImportLine = `  LogOut,
  UploadCloud,
} from 'lucide-react';`;
const newImportLine = `  LogOut,
  UploadCloud,
  UserPlus,
} from 'lucide-react';`;

const oldNav = `  admin: [
    { to: '/reports', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/work-orders', label: 'Work Order Queue', icon: ClipboardList },
    { to: '/project-trackers', label: 'Project Trackers', icon: FolderKanban },
    { to: '/inventory', label: 'Inventory', icon: Boxes },
    { to: '/billing', label: 'Billing', icon: Receipt },
    { to: '/templates/import', label: 'Import Templates', icon: UploadCloud },
  ],`;
const newNav = `  admin: [
    { to: '/reports', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/work-orders', label: 'Work Order Queue', icon: ClipboardList },
    { to: '/project-trackers', label: 'Project Trackers', icon: FolderKanban },
    { to: '/inventory', label: 'Inventory', icon: Boxes },
    { to: '/billing', label: 'Billing', icon: Receipt },
    { to: '/templates/import', label: 'Import Templates', icon: UploadCloud },
    { to: '/add-client', label: 'Add Client', icon: UserPlus },
  ],`;

let ok = true;
if (!content.includes(oldImportLine)) { console.log('FAIL: icon import block not found'); ok = false; }
if (!content.includes(oldNav)) { console.log('FAIL: admin nav block not found'); ok = false; }

if (ok) {
  content = content.replace(oldImportLine, newImportLine);
  content = content.replace(oldNav, newNav);
  fs.writeFileSync(path, content);
  console.log('OK: Add Client nav link added');
} else {
  process.exit(1);
}
JSEOF

echo "=== 6. Adding whitespace-trim middleware to server.js ==="
node <<'JSEOF'
const fs = require('fs');
const path = '/workspaces/flooring-platform/backend/src/server.js';
let content = fs.readFileSync(path, 'utf8');

const oldLine = `app.use(express.json());`;
const newLine = `app.use(express.json());

// Trim whitespace on all string body fields — catches accidental
// leading/trailing spaces from copy-paste (e.g. a UUID with a
// leading space failing validation further down the stack).
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
});`;

if (!content.includes(oldLine)) {
  console.log('FAIL: express.json() line not found');
  process.exit(1);
}
content = content.replace(oldLine, newLine);
fs.writeFileSync(path, content);
console.log('OK: whitespace-trim middleware added');
JSEOF

echo "=== ALL DONE ==="
