import { useRef, useState } from 'react';
import { UploadCloud, Download, CheckCircle2, XCircle } from 'lucide-react';
import { api, type TemplateImportResponse } from '../lib/api';
import { Button } from '../components/Button';

export function TemplateImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<TemplateImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(file: File) {
    setFileName(file.name);
    setError(null);
    setResult(null);
    setIsUploading(true);
    try {
      const csvText = await file.text();
      const response = await api.post<TemplateImportResponse>('/floor-plan-templates/import', {
        csv: csvText,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsUploading(false);
    }
  }

  function handleDownloadSample() {
    // The sample CSV is served by the backend so the column format
    // can never drift out of sync between the download and the
    // parser that actually validates uploads.
    const token = localStorage.getItem('flooring_jwt');
    fetch('/api/floor-plan-templates/import/sample-csv', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'floor-plan-template-sample.csv';
        link.click();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div>
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)] mb-1">
        Import Floor Plan Templates
      </h1>
      <p className="text-sm text-[var(--color-concrete)] mb-6 max-w-2xl">
        Upload a CSV to create or update multiple floor plan templates at once, instead of entering
        room manifests one by one. Each row is one room; rows sharing the same property and plan
        name are grouped into a single template.
      </p>

      <Button
        variant="ghost"
        onClick={handleDownloadSample}
        className="!px-0 !py-0 !text-[var(--color-primary)] !bg-transparent hover:!bg-transparent hover:!underline mb-6"
      >
        <Download size={14} />
        Download sample CSV
      </Button>

      <div
        className="bg-[var(--color-panel)] rounded-xl border surface-card-2 border-dashed border-[var(--color-concrete-light)] px-6 py-10 flex flex-col items-center text-center cursor-pointer hover:border-[var(--color-primary)] transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFileSelected(file);
        }}
      >
        <UploadCloud size={32} className="text-[var(--color-concrete)] mb-3" />
        <div className="text-sm font-medium text-[var(--color-ink)]">
          {fileName ?? 'Click to choose a CSV file, or drag one here'}
        </div>
        <div className="text-xs text-[var(--color-concrete)] mt-1">
          property_name, plan_name, room_name, material_sku, net_qty, waste_pct
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
          }}
        />
      </div>

      {isUploading && (
        <div className="text-sm text-[var(--color-concrete)] mt-4">Importing…</div>
      )}

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-4 py-3 mt-4">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="text-sm text-[var(--color-ink)]">
            Processed <strong>{result.templatesProcessed}</strong> template
            {result.templatesProcessed === 1 ? '' : 's'}.
          </div>

          <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-concrete-light)] text-left text-xs uppercase tracking-wide text-[var(--color-concrete)]">
                  <th className="px-5 py-3 font-medium">Property</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Rooms</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 border-[var(--color-concrete-light)]">
                    <td className="px-5 py-3.5">{row.propertyName}</td>
                    <td className="px-5 py-3.5">{row.planName}</td>
                    <td className="px-5 py-3.5 font-mono text-xs">{row.roomCount ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      {row.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1.5 text-[var(--color-danger)]">
                          <XCircle size={14} />
                          {row.error}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[var(--color-success)]">
                          <CheckCircle2 size={14} />
                          {row.status === 'created' ? 'Created' : 'Updated'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.rowErrors.length > 0 && (
            <div className="bg-[var(--color-amber-soft)] rounded-xl px-5 py-4">
              <div className="text-sm font-medium text-[var(--color-amber-dark)] mb-2">
                {result.rowErrors.length} row{result.rowErrors.length === 1 ? '' : 's'} skipped
              </div>
              <ul className="text-xs text-[var(--color-amber-dark)] space-y-1">
                {result.rowErrors.map((e, i) => (
                  <li key={i}>
                    Line {e.line}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
