type RoomSpec = { material_sku: string; net_qty: number; waste_pct: number };
type RoomManifest = Record<string, RoomSpec>;

// Category read off the SKU prefix convention used in the seed data
// (LVP-, CPT-, TILE-, etc). Falls back to a neutral tone for
// anything unrecognized rather than guessing.
const CATEGORY_COLORS: Record<string, { fill: string; stroke: string }> = {
  LVP: { fill: 'var(--color-primary-soft)', stroke: 'var(--color-primary)' },
  CPT: { fill: 'var(--color-plum-soft)', stroke: 'var(--color-plum)' },
  TILE: { fill: 'var(--color-status-scheduled-soft)', stroke: 'var(--color-status-scheduled)' },
};

function categoryFromSku(sku: string): { fill: string; stroke: string } {
  const prefix = sku.split('-')[0];
  return CATEGORY_COLORS[prefix] ?? { fill: 'var(--color-concrete-light)', stroke: 'var(--color-concrete)' };
}

/**
 * Building Engines' actual named differentiator (per the competitor
 * research) is using digital floor plans to visually pinpoint where
 * work is needed, rather than a flat list of rooms. This renders the
 * room_manifest as a simple proportional room layout — not a CAD
 * drawing, but genuinely spatial rather than a plain <select> list.
 */
export function FloorPlanDiagram({ roomManifest }: { roomManifest: RoomManifest }) {
  const rooms = Object.entries(roomManifest);
  if (rooms.length === 0) return null;

  const totalArea = rooms.reduce((sum, [, spec]) => sum + spec.net_qty, 0);

  // Simple packed-row layout: widths proportional to each room's
  // share of total area, wrapping into rows of ~3.
  const perRow = 3;
  const rowGroups: [string, RoomSpec][][] = [];
  for (let i = 0; i < rooms.length; i += perRow) {
    rowGroups.push(rooms.slice(i, i + perRow));
  }

  return (
    <div className="border border-[var(--color-concrete-light)] rounded-lg p-4 bg-[var(--color-paper)]">
      <div className="space-y-2">
        {rowGroups.map((row, i) => (
          <div key={i} className="flex gap-2" style={{ height: '72px' }}>
            {row.map(([roomName, spec]) => {
              const share = spec.net_qty / totalArea;
              const colors = categoryFromSku(spec.material_sku);
              return (
                <div
                  key={roomName}
                  className="rounded-md border-2 flex flex-col items-center justify-center px-2 transition-transform hover:scale-[1.02]"
                  style={{
                    flexGrow: Math.max(share * 10, 1),
                    flexBasis: 0,
                    backgroundColor: colors.fill,
                    borderColor: colors.stroke,
                  }}
                  title={`${roomName}: ${spec.net_qty} sqft, ${spec.material_sku}`}
                >
                  <span className="text-xs font-medium text-[var(--color-ink)] truncate max-w-full">
                    {roomName}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--color-ink-soft)]">
                    {spec.net_qty} sqft
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--color-concrete-light)]">
        {Object.entries(CATEGORY_COLORS).map(([cat, colors]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full border"
              style={{ backgroundColor: colors.fill, borderColor: colors.stroke }}
            />
            <span className="text-[10px] text-[var(--color-concrete)] uppercase tracking-wide">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
