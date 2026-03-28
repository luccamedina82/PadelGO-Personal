# RESERVAS_CONTEXT.md — Módulo de Reservas

> Última actualización: 2026-03-28
> Propósito: Memoria arquitectónica del módulo. Leer antes de modificar cualquier archivo bajo `features/reservas/`.

---

## 1. Glosario de Estados (Enums de la DB)

### `BookingStatus`
| Valor | Significado | Visible en grilla |
|---|---|---|
| `PENDING` | Reserva creada, no confirmada | ✅ |
| `CONFIRMED` | Confirmada por el club | ✅ |
| `CANCELLED` | Cancelada (por owner, staff o sistema) | ❌ (filtrada en DAL) |
| `COMPLETED` | Partido jugado (futuro use) | ❌ (filtrada en DAL) |

> **REGLA CRÍTICA:** `getAdminBookingsByDate` filtra `status: { in: ['PENDING', 'CONFIRMED'] }`. Las reservas CANCELLED/COMPLETED nunca llegan al cliente. Al cancelar, `patchBookingsCache` en `useBookings.ts` la elimina optimistamente del array local.

### `PaymentStatus`
| Valor | Significado |
|---|---|
| `UNPAID` | Sin pago registrado |
| `PAID` | Pagado online (MercadoPago) |
| `MANUAL` | Marcado como pagado manualmente por el club |
| `REFUNDED` | Reembolsado (solo flujo online) |

### `BookingSource`
| Valor | Es bloqueo | Tiene nombre de cliente | Tiene precio |
|---|---|---|---|
| `ONLINE` | ❌ | User.name | ✅ |
| `MANUAL_OWNER` | ❌ | manualName | ✅ |
| `MANUAL_SUPPORT` | ❌ | manualName | ✅ |
| `BLOCK` | ✅ | manualName = razón | ❌ (0) |
| `ENTRENAMIENTO` | ✅ | — | ❌ |
| `TORNEO` | ✅ | — | ❌ |
| `EVENTO` | ✅ | — | ❌ |
| `MANTENIMIENTO` | ✅ | — | ❌ |

> **PATRÓN TURNO FIJO:** Los turnos fijos (RecurringBooking) generan bookings con `source: 'BLOCK'` **y** `recurringBookingId != null`. En la grilla se detectan con `source === 'BLOCK' && recurringBookingId`. No existe un `BookingSource.RECURRING`.

---

## 2. Reglas de Negocio Críticas

### Precios (centavos)
- Todos los precios se almacenan en **centavos de ARS** (entero). Nunca pesos.
- Fórmula: `totalPrice = Math.round((pricePerHour / 60) * durationMinutes)`
- Helper canónico: `calcBookingPrice()` en `lib/availability.ts`
- Display: `formatPrice(centavos)` divide por 100 y formatea con `Intl.NumberFormat es-AR`

### Zona Horaria (UTC-3)
- `Booking.date` se almacena como **medianoche UTC** (`2025-03-28T00:00:00.000Z`)
- **Nunca usar** `new Date().getDate()` o `.setHours(0,0,0,0)` — rompen cerca de medianoche ARG
- Helpers canónicos de `lib/date.ts`:
  - `argTodayStr()` → string YYYY-MM-DD en timezone ARG
  - `argToday()` → Date en timezone ARG
  - `toUtcDateStr(date)` → convierte fecha de DB a string display

### Duraciones permitidas
- Global: `VALID_DURATIONS = [60, 90, 120]` en `lib/availability.ts`
- Per-club: `Club.allowedDurations` (subset de VALID_DURATIONS)
- **Las actions validan contra ambas**: primero `VALID_DURATIONS`, luego `club.allowedDurations` dentro de la transacción

### Anticipación mínima
- `MIN_ADVANCE_MINUTES = 60` (global en `lib/availability.ts`)
- Los admins bypassean esta regla pasando `0` a `calcAvailableSlots` en `wizardData.ts`
- Los jugadores online respetan el mínimo

### Conflicto de slots
- Lógica canónica: `bStart < newEndMin && bEnd > newStartMin`
- Implementada en `createManualBooking` y `updateBooking` dentro de transacciones Prisma
- Solo bookings `PENDING` y `CONFIRMED` bloquean slots

---

## 3. Arquitectura de Componentes

### Jerarquía y Dueño de Estado

```
ReservasPage (Server Component)
│  Estado: URL como SSOT para fecha seleccionada (?date=YYYY-MM-DD)
│  Datos: getCourtsByClubId + getAdminBookingsByDate (cached DAL)
│
└─ BookingsClient (Client Component)
   │  Estado: React Query ['bookings', clubId, date] con refetchInterval: 30s
   │  Estado: isNavigating (spinner de transición de fecha)
   │  Estado: eventHighlightBookingId (scroll al nuevo booking)
   │
   └─ ReservasShell → BookingGrid / WeeklyBookingGrid
```

### Flujo de Nueva Reserva (Modal Interceptado)
```
NuevaReservaButton → /admin/reservas/nueva?date=&courtId=&time=
  │
  ├─ @modal/(.)nueva/  ← intercepta si viene de /admin/reservas
  │    └─ ModalBookingWizardClient → ManualBookingWizard
  │
  └─ nueva/page.tsx    ← ruta directa (navegación directa / refresh)
       └─ ModalBookingWizardClient → ManualBookingWizard

ManualBookingWizard llama createManualBooking (Server Action)
  → revalidateTag('bookings-${clubId}')
  → window.dispatchEvent(new CustomEvent('reservas:refresh', { detail: { date, bookingId } }))
  → BookingsClient re-fetcha y resalta el nuevo booking
```

### Protocolo del DOM Event `'reservas:refresh'`
El evento es el mecanismo de comunicación cross-component. Su `detail` puede tener:
- `{ bookingId?: string }` — para refetch + scroll al booking en la fecha actual
- `{ date: string, bookingId?: string }` — para refetch + navegación a otra fecha

**IMPORTANTE:** Solo uno de los dos patrones debe usarse por dispatch. Ver BUG conocido en sección 5.

---

## 4. Capas y sus Responsabilidades

| Capa | Ruta | Responsabilidad | Cache |
|---|---|---|---|
| DAL | `features/reservas/dal/` | Queries de lectura a Prisma | `'use cache'` + `cacheTag` |
| Actions | `features/reservas/actions/bookings.ts` | Mutaciones + validaciones de negocio | `revalidateTag` + `revalidatePath` |
| Hooks | `features/reservas/hooks/useBookings.ts` | React Query mutations + optimistic updates | React Query cache |
| Helpers | `features/reservas/components/*/helpers/` | Lógica de UI pura (no DB, no fetch) | N/A |
| Types | `features/reservas/components/*/types/` | Contratos de props de componentes | N/A |

### Regla de Importación
- DAL → solo lo pueden llamar: Server Components, Server Actions, otras DAL functions
- Actions → solo lo pueden llamar: Client Components (a través de hooks), Server Components
- Hooks → solo Client Components

---

## 5. Bugs Conocidos y Deuda Técnica

### BUG-01 — Doble listener `'reservas:refresh'` (ACTIVO)
**Archivo:** `app/(owner)/admin/reservas/BookingsClient.tsx`
Dos `useEffect` suscriben al mismo evento (`handleReservasRefresh` + `handleRelayNav`). El primero hace refetch+scroll; el segundo navega con `router.push()`. Si el evento incluye `detail.date`, ambos handlers disparan y la navegación interrumpe el scroll.

### DEBT-01 — Helpers duplicados
`timeToMinutes`, `minutesToTime`, `formatPrice` existen en `lib/availability.ts` y en `bookingGrid.helpers.ts`. Los componentes de grilla deben importar desde `lib/availability.ts`.

### DEBT-02 — `BLOCK_SOURCES` disperso
La lógica "qué fuentes son bloques" está en `bookingGrid.helpers.ts` (Set) y duplicada como array literal en `actions/bookings.ts` (línea 489). Debe centralizarse en `features/reservas/constants/bookingSources.ts`.

### DEBT-03 — Tipos débiles en `BookingBlock`
`status`, `source`, `paymentStatus` son `string` en `bookingGrid.types.ts` en vez de los enums de Prisma (`BookingStatus`, `BookingSource`, `PaymentStatus`).

### DEBT-04 — Query Prisma sin cache en `wizardData.ts`
`prisma.club.findUnique` en `getWizardPageData` no tiene `'use cache'`. Cada apertura del wizard hace una consulta fresca para datos de configuración estáticos.

---

## 6. Protocolo de Modificación (para IAs futuras)

### Al agregar una nueva mutación (Server Action):
1. Llamar `revalidateTag(`bookings-${clubId}`)` Y `revalidatePath('/admin/reservas')`
2. Retornar `ActionResult<T>` (nunca lanzar al cliente)
3. Agregar el mutation en `useBookings.ts` con `patchBookingsCache` para optimistic update
4. Disparar `window.dispatchEvent(new CustomEvent('reservas:refresh', { detail: { bookingId } }))` desde el componente cliente tras éxito

### Al modificar el cálculo de slots o precios:
- El único source of truth es `lib/availability.ts`
- `calcAvailableSlots`, `calcBookingPrice`, `timeToMinutes` son las funciones canónicas
- **No reimplementar** estas funciones en helpers de componentes

### Al agregar un nuevo `BookingSource`:
1. Agregar al enum en `prisma/schema.prisma`
2. Correr `pnpm prisma migrate dev && pnpm prisma generate`
3. Actualizar `BLOCK_SOURCES` (cuando esté en `features/reservas/constants/`)
4. Actualizar `getBlockClass()` y `getSourceLabel()` en `bookingGrid.helpers.ts`
5. Actualizar `SOURCE_FILTERS` en `bookingGrid.helpers.ts` si debe aparecer en el filtro
