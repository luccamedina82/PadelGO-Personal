import PrintButton from '@/components/ui/PrintButton'

interface activeBookings {
    id: string;
    courtId: string;
    startTime: string;
    durationMinutes: number;
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
    source: "ONLINE" | "MANUAL_OWNER" | "MANUAL_SUPPORT" | "BLOCK";
    displayName: string;
    totalPrice: number;
    paymentStatus: "UNPAID" | "PAID" | "REFUNDED" | "MANUAL";
    manualPhone: string | null;
    user: {
        name: string;
    };
    court: {
        id: string;
    };
    manualName: string | null;
    recurringBookingId: string | null;
    playerDetails: {
        id: string;
        name: string;
    }[];
    paidPlayerIds: string[];
    date: string;
}

export default function Legend({activeBookings}: { activeBookings: activeBookings[] }) {
  return (
    <div className="px-5 py-2.5 flex items-center gap-5 border-t border-border/60 print:hidden">
      {[
        { label: 'Online', cssVar: 'var(--booking-online-bar)' },
        { label: 'Manual', cssVar: 'var(--booking-manual-bar)' },
        { label: 'Bloqueo', cssVar: 'var(--booking-block-bar)' },
        { label: 'Turno Fijo', cssVar: 'var(--booking-recurring-bar)' },
      ].map(({ label, cssVar }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-sm"
            style={{
              background: `color-mix(in srgb, ${cssVar} 18%, transparent)`,
              border: `1px solid color-mix(in srgb, ${cssVar} 45%, transparent)`,
              borderLeft: `2px solid ${cssVar}`,
            }}
          />
          <span className="text-[10px] text-muted">{label}</span>
        </div>
      ))}

      <div className="ml-auto flex items-center gap-2">
        {/* Print button */}
        <PrintButton />
        <span
          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full
                         bg-tag text-tag-text border border-tag-border"
        >
          {activeBookings.length} {activeBookings.length === 1 ? 'reserva' : 'reservas'}
        </span>
      </div>
    </div>
  )
}
