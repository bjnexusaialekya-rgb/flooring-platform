import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../lib/api';
import { Building2, MapPin, Check, ImagePlus } from 'lucide-react';
import { Button } from '../components/Button';

type ClientOption = { id: string; corporate_name: string };

export function AddCompanyPage() {
  const [corporateName, setCorporateName] = useState('');
  const [paymentTerms, setPaymentTerms] = useState<'full_only' | 'deposit_required'>('full_only');
  const [depositType, setDepositType] = useState<'percent' | 'fixed'>('percent');
  const [depositValue, setDepositValue] = useState('');
  const [agreementSigned, setAgreementSigned] = useState<'yes' | 'no'>('no');
  const [agreementDate, setAgreementDate] = useState('');
  const [advanceAgreed, setAdvanceAgreed] = useState<'yes' | 'no'>('no');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [companyResult, setCompanyResult] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [creatingCompany, setCreatingCompany] = useState(false);

  // Logo upload is UI-only for now — no backend endpoint exists yet to
  // store/serve a company logo, so this stays local state and is not sent
  // in handleCreateCompany's POST body. Wire this up once a
  // POST /admin-setup/clients/:id/logo (or similar) route exists.
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [propertyResult, setPropertyResult] = useState<string | null>(null);
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [addingProperty, setAddingProperty] = useState(false);

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

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleCreateCompany(e: FormEvent) {
    e.preventDefault();
    setCompanyError(null);
    setCompanyResult(null);
    setCreatingCompany(true);
    try {
      const created = await api.post<{ corporate_name: string }>('/admin-setup/clients', {
        corporateName,
        paymentTerms,
        depositType: paymentTerms === 'deposit_required' ? depositType : undefined,
        depositValue: paymentTerms === 'deposit_required' ? Number(depositValue) : undefined,
        agreementSigned: agreementSigned === 'yes',
        agreementDate: agreementSigned === 'yes' ? agreementDate : undefined,
        advanceAgreed: advanceAgreed === 'yes',
        advanceAmount: advanceAgreed === 'yes' ? Number(advanceAmount) : undefined,
      });
      setCompanyResult(`Company "${created.corporate_name}" created.`);
      setCorporateName('');
      setPaymentTerms('full_only');
      setDepositValue('');
      setAgreementSigned('no');
      setAgreementDate('');
      setAdvanceAgreed('no');
      setAdvanceAmount('');
      await loadClients();
    } catch (err) {
      setCompanyError(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setCreatingCompany(false);
    }
  }

  async function handleAddProperty(e: FormEvent) {
    e.preventDefault();
    setPropertyError(null);
    setPropertyResult(null);
    setAddingProperty(true);
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
    } finally {
      setAddingProperty(false);
    }
  }

  const inputClass =
    'w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm ' +
    'transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]';
  const labelClass = 'block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5';

  const step1Done = companyResult !== null;

  return (
    <div className="max-w-lg">
      {/* Wizard progress: a connecting line between the two step circles,
          filling in green once step 1 completes, plus a checkmark
          replacing the "1" glyph — makes this read as a real multi-step
          flow instead of two independently-numbered section headers. */}
      <div className="relative mb-8">
        <div className="flex items-center">
          <span
            className={[
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 transition-colors',
              step1Done
                ? 'bg-[var(--color-success)] text-white'
                : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
            ].join(' ')}
          >
            {step1Done ? <Check size={13} /> : '1'}
          </span>
          <div className="flex-1 mx-2 h-0.5 rounded-full bg-[var(--color-concrete-light)] overflow-hidden">
            <div
              className={[
                'h-full bg-[var(--color-success)] transition-all duration-500',
                step1Done ? 'w-full' : 'w-0',
              ].join(' ')}
            />
          </div>
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-semibold shrink-0">
            2
          </span>
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] uppercase tracking-wide text-[var(--color-concrete)]">
          <span>Company</span>
          <span>Property</span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Add Company
          </h1>
        </div>
        <p className="text-sm text-[var(--color-concrete)] mb-6">
          Onboard a new corporate client before creating logins or properties for them.
        </p>
        <form
          onSubmit={handleCreateCompany}
          className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6 space-y-4"
        >
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-[var(--color-concrete-light)]">
            <Building2 size={16} className="text-[var(--color-primary)]" />
            <span className="text-sm font-medium text-[var(--color-ink)]">Company Details</span>
          </div>

          <div>
            <label className={labelClass}>Company Logo <span className="text-[var(--color-concrete)] font-normal">(optional)</span></label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg border border-dashed border-[var(--color-concrete-light)] bg-[var(--color-paper)] flex items-center justify-center shrink-0 overflow-hidden">
                {logoPreview ? (
                  <img src={logoPreview} alt="Company logo preview" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus size={18} className="text-[var(--color-concrete)]" />
                )}
              </div>
              <label className="text-xs font-medium text-[var(--color-link)] hover:underline cursor-pointer">
                {logoPreview ? 'Change logo' : 'Upload logo'}
                <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
              </label>
            </div>
          </div>

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

          <div>
            <label className={labelClass}>Payment Terms</label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value as 'full_only' | 'deposit_required')}
              className={inputClass}
            >
              <option value="full_only">Full payment only</option>
              <option value="deposit_required">Deposit required</option>
            </select>
          </div>
          {paymentTerms === 'deposit_required' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Deposit Type</label>
                <select
                  value={depositType}
                  onChange={(e) => setDepositType(e.target.value as 'percent' | 'fixed')}
                  className={inputClass}
                >
                  <option value="percent">% of total</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{depositType === 'percent' ? 'Percent' : 'Amount ($)'}</label>
                <input
                  required
                  type="number"
                  value={depositValue}
                  onChange={(e) => setDepositValue(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Agreement Signed?</label>
            <select
              value={agreementSigned}
              onChange={(e) => setAgreementSigned(e.target.value as 'yes' | 'no')}
              className={inputClass}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {agreementSigned === 'yes' && (
            <div>
              <label className={labelClass}>Agreement Date</label>
              <input
                required
                type="date"
                value={agreementDate}
                onChange={(e) => setAgreementDate(e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-[var(--color-concrete)] mt-1">
                PDF upload available after company creation (separate step).
              </p>
            </div>
          )}

          <div>
            <label className={labelClass}>Advance Amount Agreed?</label>
            <select
              value={advanceAgreed}
              onChange={(e) => setAdvanceAgreed(e.target.value as 'yes' | 'no')}
              className={inputClass}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {advanceAgreed === 'yes' && (
            <div>
              <label className={labelClass}>Advance Amount ($)</label>
              <input
                required
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

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
          <Button type="submit" isLoading={creatingCompany} className="w-full">
            Create Company
          </Button>
        </form>
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-[var(--font-display)] text-xl font-semibold text-[var(--color-ink)]">
            Add Property
          </h2>
        </div>
        <p className="text-sm text-[var(--color-concrete)] mb-6">
          Add a property under an existing company. Required before floor-plan templates,
          buildings, or units can be created for it.
        </p>
        <form
          onSubmit={handleAddProperty}
          className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6 space-y-4"
        >
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-[var(--color-concrete-light)]">
            <MapPin size={16} className="text-[var(--color-primary)]" />
            <span className="text-sm font-medium text-[var(--color-ink)]">Property Location</span>
          </div>

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
            <input value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} className={inputClass} />
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
          <Button type="submit" isLoading={addingProperty} className="w-full">
            Add Property
          </Button>
        </form>
      </div>
    </div>
  );
}
