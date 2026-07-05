import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../lib/api';

type ClientOption = { id: string; corporate_name: string };

export function AddCompanyPage() {
  // --- Create Company ---
  const [corporateName, setCorporateName] = useState('');
  const [companyResult, setCompanyResult] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);

  // --- Add Property ---
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [propertyResult, setPropertyResult] = useState<string | null>(null);
  const [propertyError, setPropertyError] = useState<string | null>(null);

  async function loadClients() {
    try {
      const data = await api.get<ClientOption[]>('/admin-setup/clients');
      setClients(data);
    } catch (err) {
      console.error('Failed to load companies', err);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function handleCreateCompany(e: FormEvent) {
    e.preventDefault();
    setCompanyError(null);
    setCompanyResult(null);
    try {
      const created = await api.post<ClientOption>('/admin-setup/clients', { corporateName });
      setCompanyResult(`Company "${created.corporate_name}" created.`);
      setCorporateName('');
      await loadClients();
    } catch (err) {
      setCompanyError(err instanceof Error ? err.message : 'Failed to create company');
    }
  }

  async function handleAddProperty(e: FormEvent) {
    e.preventDefault();
    setPropertyError(null);
    setPropertyResult(null);
    try {
      const created = await api.post<{ id: string; name: string }>('/admin-setup/properties', {
        clientId,
        name: propertyName,
        streetAddress: streetAddress || undefined,
        city: city || undefined,
        state: state || undefined,
        zipCode: zipCode || undefined,
      });
      setPropertyResult(`Property "${created.name}" added.`);
      setPropertyName('');
      setStreetAddress('');
      setCity('');
      setState('');
      setZipCode('');
    } catch (err) {
      setPropertyError(err instanceof Error ? err.message : 'Failed to add property');
    }
  }

  const inputClass =
    'w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm';
  const labelClass = 'block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5';

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)] mb-1">
          Add Company
        </h1>
        <p className="text-sm text-[var(--color-concrete)] mb-6">
          Onboard a new corporate client before creating logins or properties for them.
        </p>
        <form
          onSubmit={handleCreateCompany}
          className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6 space-y-4"
        >
          <div>
            <label className={labelClass}>Company Name</label>
            <input
              required
              value={corporateName}
              onChange={(e) => setCorporateName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Greystar Real Estate Partners"
            />
          </div>
          {companyError && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-3 py-2">
              {companyError}
            </div>
          )}
          {companyResult && (
            <div className="text-sm text-[var(--color-success)] bg-[var(--color-success-soft)] rounded-md px-3 py-2">
              {companyResult}
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-medium text-sm rounded-md py-2.5 transition-colors"
          >
            Create Company
          </button>
        </form>
      </div>

      <div>
        <h2 className="font-[var(--font-display)] text-xl font-semibold text-[var(--color-ink)] mb-1">
          Add Property
        </h2>
        <p className="text-sm text-[var(--color-concrete)] mb-6">
          Add a property under an existing company. Required before floor-plan templates,
          buildings, or units can be created for it.
        </p>
        <form
          onSubmit={handleAddProperty}
          className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6 space-y-4"
        >
          <div>
            <label className={labelClass}>Company</label>
            <select
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select a company…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.corporate_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Property Name</label>
            <input
              required
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Oakridge Apartments"
            />
          </div>
          <div>
            <label className={labelClass}>Street Address</label>
            <input
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input value={state} onChange={(e) => setState(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Zip</label>
              <input value={zipCode} onChange={(e) => setZipCode(e.target.value)} className={inputClass} />
            </div>
          </div>
          {propertyError && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-3 py-2">
              {propertyError}
            </div>
          )}
          {propertyResult && (
            <div className="text-sm text-[var(--color-success)] bg-[var(--color-success-soft)] rounded-md px-3 py-2">
              {propertyResult}
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-medium text-sm rounded-md py-2.5 transition-colors"
          >
            Add Property
          </button>
        </form>
      </div>
    </div>
  );
}
