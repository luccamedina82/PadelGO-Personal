# Spec: UX Polishing & Refactor de Módulos

**Fecha:** 2026-04-02  
**Estado:** Aprobado  
**Orden de implementación:** Épica 1 → Épica 2 → Épica 3

---

## Épica 1: Grilla de Reservas — Polishing Visual y UX

### 1.1 Transición Suave del Toggle 24hs

**Objetivo:** Al activar/desactivar "Ver 24 horas", la grilla no debe saltar bruscamente. Se preserva la posición de scroll relativa y se aplica una transición CSS suave.

**Archivos a modificar:**
- `app/(owner)/admin/reservas/BookingsClient.tsx`
- `features/reservas/components/booking-grid/BookingGrid.tsx`

**Implementación:**
1. En `BookingGrid.tsx`, usar `useLayoutEffect` para capturar `scrollTop` y `scrollHeight` antes del re-render causado por el cambio de `gridStart`/`gridEnd`.
2. Después del render, calcular el nuevo `scrollTop` proporcional: `newScrollTop = (prevScrollTop / prevScrollHeight) * newScrollHeight`.
3. Aplicar el scroll corregido sin animación (instantáneo) para que el contenido no salte visualmente.
4. Agregar `transition: height 300ms ease` al wrapper del contenedor del grid para que el cambio de dimensiones sea visualmente gradual.

**No requiere:** framer-motion, librerías externas.

---

### 1.2 Icono de Conflicto en Tarjetas

**Objetivo:** Las tarjetas en la grilla que corresponden a reservas con conflicto activo muestran un ícono ⚠️ en la esquina superior izquierda.

**Archivos a modificar:**
- `app/(owner)/admin/reservas/page.tsx`
- `app/(owner)/admin/reservas/BookingsClient.tsx`
- `app/(owner)/admin/reservas/ReservasShell.tsx`
- `features/reservas/components/booking-grid/BookingGrid.tsx`
- `features/reservas/components/booking-grid/BookingBlockCell/BookingBlockCell.tsx`
- `features/reservas/components/booking-grid/types/bookingGrid.types.ts`

**Implementación:**
1. En `page.tsx` (servidor): llamar `getConflictBookings(clubId)` y construir `conflictIds: Set<string>` con los IDs.
2. Pasar `conflictIds` como prop a través de la cadena: `page → BookingsClient → ReservasShell → BookingGrid → BookingBlockCell`.
3. Agregar `conflictIds?: Set<string>` a las interfaces de props en `bookingGrid.types.ts`.
4. En `BookingBlockCell`: si `conflictIds?.has(booking.id)`, renderizar un badge `absolute top-1 left-1 z-10` con ícono ⚠️ (14px, fondo ámbar semitransparente, bordes redondeados).

---

### 1.3 Banner de Conflictos Contextual

**Objetivo:** El banner superior muestra "⚠️ X reservas de hoy requieren tu atención (de Y en total)" usando la fecha seleccionada como filtro.

**Archivos a modificar:**
- `app/(owner)/admin/reservas/page.tsx`
- `app/(owner)/admin/reservas/BookingsClient.tsx`

**Implementación:**
1. En `page.tsx`: pasar el array `ConflictBooking[]` completo (o solo `{ id, dateStr }[]`) en lugar del count.
2. En `BookingsClient`: calcular:
   - `todayCount = conflicts.filter(c => c.dateStr === dateParam).length`
   - `totalCount = conflicts.length`
3. Si `todayCount > 0`: banner ámbar con texto completo.
4. Si `todayCount === 0` y `totalCount > 0`: banner gris/neutro "Sin conflictos hoy. Hay Y conflictos en otras fechas."
5. Si `totalCount === 0`: no mostrar banner.

---

## Épica 2: Gestión de Canchas (`/admin/canchas`)

### 2.1 Visibilidad en Grilla (Campo Persistente `hideFromGrid`)

**Objetivo:** El dueño decide permanentemente si una cancha aparece en la grilla diaria. El toggle efímero "Ocultar mantenimiento" en la grilla desaparece.

**Migración de DB:**
```
pnpm prisma migrate dev --name add-court-hide-from-grid
```
Campo a agregar en `Court`:
```prisma
hideFromGrid Boolean @default(false)
```

**Archivos a modificar:**
- `prisma/schema.prisma`
- `actions/owner/courts.ts` — agregar `toggleCourtGridVisibility(courtId, clubId)` que actualiza `hideFromGrid` y llama `revalidateTag('courts-${clubId}')` + `revalidateTag('bookings-${clubId}')`
- `app/(owner)/admin/canchas/CanchasClient.tsx` — agregar toggle "Mostrar en grilla / Ocultar de grilla" por cancha
- `app/(owner)/admin/reservas/BookingsClient.tsx` — eliminar estado `hideMaintenance` y el botón "Ocultar mantenimiento"
- `features/reservas/components/booking-grid/BookingGrid.tsx` — filtrar columnas: `courts.filter(c => !c.hideFromGrid)`
- `features/reservas/components/booking-grid/types/bookingGrid.types.ts` — agregar `hideFromGrid?: boolean` a `CourtColumn`

**Regla de negocio:** `hideFromGrid` es independiente de `isUnderMaintenance`. Cualquier cancha (activa o en mantenimiento) puede ocultarse del grid.

---

### 2.2 Activar/Desactivar Canchas (Soft Delete)

**Objetivo:** El dueño puede desactivar una cancha desde `/admin/canchas`. El backend bloquea la desactivación si hay reservas futuras confirmadas o pendientes.

**Archivos a modificar:**
- `actions/owner/courts.ts` — reforzar `toggleCourt` (o crear `deactivateCourtAction`) con el guard:
  1. Consultar `Booking WHERE courtId = X AND status IN [PENDING, CONFIRMED] AND date >= hoy`.
  2. Si existen, retornar `{ success: false, error: 'Esta cancha tiene N reservas futuras. Reubícalas antes de desactivarla.' }`.
  3. Si no existen, actualizar `isActive: false`.
  4. Llamar `revalidateTag('courts-${clubId}')` + `revalidateTag('bookings-${clubId}')`.
- `app/(owner)/admin/canchas/CanchasClient.tsx` — botón "Desactivar" (rojo suave) en canchas activas, botón "Activar" en canchas inactivas. Modal de confirmación con el mensaje de error si el backend lo rechaza.

**Efecto colateral:** Las reservas de canchas desactivadas (`isActive: false`) ya son detectadas por el DAL de conflictos como `conflictType: 'ARCHIVED'` — aparecerán automáticamente en `/admin/conflictos` sin cambios adicionales.

---

## Épica 3: Centro de Resolución y Conflictos (`/admin/conflictos`)

### 3.1 Retorno de Reservas 'Warning' + Botón Ignorar/Aprobar Excepción

**Objetivo:** Las reservas creadas manualmente fuera del horario operativo (soft warning aceptado) aparecen en `/admin/conflictos`. El admin puede aprobar la excepción con un botón, removiéndolas del centro de resolución.

**Decisión de DB:** Dos campos nuevos en `Booking` (no tabla separada).

**Migración de DB:**
```
pnpm prisma migrate dev --name add-booking-out-of-hours-warning
```
Campos a agregar en `Booking`:
```prisma
outOfHoursWarning    Boolean   @default(false)
exceptionApprovedAt  DateTime?
```

**Archivos a modificar:**
- `prisma/schema.prisma`
- `features/reservas/components/manual-booking-wizard/ManualBookingWizard.tsx` — cuando el usuario acepta crear con soft-warning, pasar flag `outOfHoursWarning: true` al action
- `features/reservas/actions/bookings.ts` — `createManualBooking` acepta y persiste `outOfHoursWarning`
- `features/reservas/dal/conflicts.ts` — extender `getConflictBookings` para incluir: `WHERE outOfHoursWarning = true AND exceptionApprovedAt IS NULL` con `conflictType: 'OUT_OF_HOURS'`
- `features/reservas/actions/conflicts.ts` — agregar `approveExceptionAction(bookingId, clubId)` que setea `exceptionApprovedAt = new Date()` y llama `revalidateTag`
- `app/(owner)/admin/conflictos/ConflictosClient.tsx` — mostrar botón "Aprobar excepción" en conflictos de tipo `OUT_OF_HOURS`, con optimistic removal de la lista

**Regla de negocio:** Un conflicto `OUT_OF_HOURS` desaparece del centro cuando `exceptionApprovedAt IS NOT NULL` (aprobado) o cuando la reserva es reubicada/cancelada.

---

### 3.2 Reubicación con ManualBookingWizard

**Objetivo:** Reemplazar el wizard de reubicación custom por `ManualBookingWizard` para consistencia de UX.

**Archivos a modificar:**
- `features/reservas/actions/conflicts.ts` — agregar `relocateBookingAction(originalBookingId, newPayload, clubId)` que:
  1. Cancela la reserva original (`status → CANCELLED`)
  2. Crea nueva reserva con datos del jugador original y nuevo court/date/time
  3. Llama `revalidateTag('bookings-${clubId}')` + `revalidateTag('conflictos-${clubId}')`
  4. Retorna `ActionResult<{ bookingId: string }>`
- `app/(owner)/admin/conflictos/page.tsx` — fetchear `courtSlotsByDate` y `availableDates` que `ManualBookingWizard` requiere (actualmente no se fetchean en esta página)
- `app/(owner)/admin/conflictos/ConflictosClient.tsx` — reemplazar ~120 líneas del wizard custom (`reloc`, `rDate`, `rCourt`, `rOccupied`, `rTime`, etc.) por `<ManualBookingWizard>` con:
  - `defaultCourtId={selected?.courtId}`
  - `defaultDate={selected?.dateStr}`
  - `defaultTime={selected?.startTime}`
  - `createManualBookingAction={relocateAction}` (wrapper de `relocateBookingAction` con `originalBookingId`)
  - `onBookingCreated` → remover conflicto de la lista y limpiar selección
  - `durationOptions={[selected?.durationMinutes]}` (solo la duración original como opción)

**Consideración de integración:** `ManualBookingWizard` se usa típicamente como modal. En `/conflictos` se renderiza inline en la columna derecha. Verificar si tiene un overlay interno que deba desactivarse. Si es así, exponer una prop `inline?: boolean` que suprima el backdrop/FocusTrap.

---

## Dependencias entre Épicas

| Ítem | Depende de |
|------|-----------|
| E1.2 (íconos en tarjetas) | E3 modifica `getConflictBookings` DAL — coordinar para que el Set de IDs incluya `OUT_OF_HOURS` |
| E2.2 (desactivar canchas) | Independiente |
| E3.2 (wizard de reubicación) | Funciona mejor con E3.1 implementado primero |

## Migraciones de DB Requeridas

| Migración | Campos | Épica |
|-----------|--------|-------|
| `add-court-hide-from-grid` | `Court.hideFromGrid Boolean` | E2.1 |
| `add-booking-out-of-hours-warning` | `Booking.outOfHoursWarning Boolean`, `Booking.exceptionApprovedAt DateTime?` | E3.1 |

## Nuevas Server Actions

| Action | Módulo | Épica |
|--------|--------|-------|
| `toggleCourtGridVisibility(courtId, clubId)` | `actions/owner/courts.ts` | E2.1 |
| `deactivateCourtAction(courtId, clubId)` | `actions/owner/courts.ts` | E2.2 |
| `approveExceptionAction(bookingId, clubId)` | `features/reservas/actions/conflicts.ts` | E3.1 |
| `relocateBookingAction(originalBookingId, newPayload, clubId)` | `features/reservas/actions/conflicts.ts` | E3.2 |
