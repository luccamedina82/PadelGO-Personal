# Plan de Impacto — UX Polish & Refactor de Módulos
**Fecha:** 2026-04-02  
**Alcance:** 3 Épicas de pulido UX/UI sin nuevas features de dominio

---

## Estado del Arte (hallazgos del análisis)

Antes de listar el trabajo, es importante saber qué ya existe para no re-inventar:

| Capacidad | Estado |
|---|---|
| `BookingBlockCell.isConflict` prop + badge ámbar | ✅ YA EXISTE |
| `Court.hideFromGrid` en schema | ✅ YA EXISTE |
| `toggleCourtGridVisibility()` action | ✅ YA EXISTE |
| `Court.isActive` + `deactivateCourtAction()` / `activateCourtAction()` | ✅ YA EXISTE |
| `Booking.outOfHoursWarning` + `exceptionApprovedAt` en schema | ✅ YA EXISTE |
| `approveExceptionAction()` en ConflictosClient | ✅ YA EXISTE |
| `scrollAnchorRef` / `prevGridStartRef` en BookingGrid (scroll preservation) | ✅ YA EXISTE (parcial) |
| Tipo `OUT_OF_HOURS` en `conflicts.ts` DAL | ✅ YA EXISTE |

Esto reduce el trabajo estimado significativamente. El plan aprovecha lo existente.

---

## Épica 1: Grilla de Reservas — Polishing Visual y UX

### 1.1 Transición suave del Toggle 24hs

**Problema:** Al cambiar `show24Hours`, el grid salta bruscamente porque la altura total cambia instantáneamente y el scroll se recalcula de forma abrupta.

**Análisis del código actual:**
- `BookingGrid.tsx` ya tiene `scrollAnchorRef` y `prevGridStartRef` para intentar preservar scroll
- La altura del grid body (`gridRows * SLOT_HEIGHT`) cambia sin transición CSS
- El problema es doble: (a) el scroll jump y (b) la expansión/contracción brusca del contenedor

**Archivos a modificar:**
- `features/reservas/components/booking-grid/BookingGrid.tsx`

**Cambios:**
1. En el `useEffect` que detecta cambio de `gridStart`/`gridEnd`, calcular el pixel absoluto del "anchor visual" (hora actual visible en pantalla) **antes** del re-render, guardar en ref.
2. En el `useEffect` que dispara después del cambio (en el siguiente frame), restaurar `scrollTop` al pixel calculado.
3. Agregar `transition: height 250ms ease` al `gridBodyRef` div, o alternativamente usar `transition-all duration-200` en Tailwind en el contenedor externo para suavizar la expansión.
4. El toggle button ya existe en `BookingGridFilterBar` — no requiere cambios de UI.

**Complejidad:** Baja-media. El mecanismo de scroll anchor ya existe, solo necesita refinamiento de timing (usar `requestAnimationFrame` en el restore) y la transición CSS.

---

### 1.2 Icono de Conflicto en Tarjetas

**Problema:** Las tarjetas de bookings con conflictos deben mostrar un indicador visual.

**Hallazgo clave:** `BookingBlockCell` **ya tiene** `isConflict` prop y ya renderiza un badge ámbar en la esquina superior derecha. La cadena de props `conflictIds → BookingGrid → BookingBlockCell` ya está implementada.

**Acción requerida:** Verificar si el badge está siendo ocultado por z-index o clipping del contenedor. Si el badge ámbar ya funciona correctamente, esta sub-tarea es un 5-minute check. Si hay un bug visual, se corrige en `BookingBlockCell.tsx`.

**Archivos a revisar:**
- `features/reservas/components/booking-grid/BookingBlockCell/BookingBlockCell.tsx` (líneas 111-122)

**Cambios potenciales:** Ajuste de posición (top-left vs top-right según preferencia del admin) y tamaño del ícono. El ícono actual es un triángulo de advertencia SVG — considerar moverlo a `top-left` para que no solape con el indicador de pago (top-right).

---

### 1.3 Banner de Conflictos Contextual

**Problema:** El badge en `BookingGridFilterBar` muestra solo el total histórico de conflictos, lo cual es abrumador.

**Estado actual** (`BookingGridFilterBar.tsx` líneas 281-297): Renderiza un `<a>` con el count. La prop `todayConflictCount` ya existe y se pasa. El texto actual muestra `todayConflictCount > 0 ? todayConflictCount : totalConflictCount`.

**Cambio de lógica de display:**
```
Antes: muestra un número (X conflictos)
Después: muestra "X hoy (Y total)" cuando todayConflictCount > 0
         muestra "Y historial" cuando todayConflictCount === 0
```

**Archivos a modificar:**
- `features/reservas/components/booking-grid/BookingGridFilterBar/BookingGridFilterBar.tsx` (bloque `{totalConflictCount > 0 && ...}`)

**Cambios:**
1. Modificar el texto del badge para mostrar formato `"X hoy"` con sub-texto `"(Y en total)"` o un tooltip con el total.
2. El `title` del `<a>` ya tiene lógica contextual — expandirlo al texto visible también.
3. No requiere cambios de backend: `todayConflictCount` y `totalConflictCount` ya se calculan correctamente en `BookingsClient.tsx`.

**Archivos a modificar:** 1 archivo, ~10 líneas.

---

## Épica 2: Gestión de Canchas (`/admin/canchas`)

### 2.1 Visibilidad en Grilla — Mover el Toggle

**Problema:** El toggle "Ocultar mantenimiento" en la grilla debe ser una configuración persistente por cancha en `/admin/canchas`.

**Hallazgo clave:**
- `Court.hideFromGrid` ya existe en el schema Prisma.
- `toggleCourtGridVisibility()` action ya existe.
- El campo ya se consume en `CourtColumn.hideFromGrid` que filtra canchas del grid.

**Lo que falta:** Exponer este toggle en la UI de `/admin/canchas` (`CanchasClient.tsx`).

**Archivos a modificar:**
- `app/(owner)/admin/canchas/CanchasClient.tsx`

**Cambios:**
1. En la tarjeta de cada cancha, agregar un toggle/switch para `hideFromGrid`, visible solo cuando `isUnderMaintenance === true` (o siempre, según UX preferida).
2. Llamar a `toggleCourtGridVisibility(courtId)` al cambiar.
3. Actualizar estado local optimísticamente.
4. **Eliminar** cualquier botón "Ocultar mantenimiento" del `BookingGridFilterBar` si existe actualmente (verificar en el componente).

**Archivos a revisar/modificar:** `CanchasClient.tsx`, y revisar `BookingGridFilterBar.tsx` para remover toggle si existe.

---

### 2.2 Activar/Desactivar Canchas

**Hallazgo clave:** `Court.isActive`, `deactivateCourtAction()` y `activateCourtAction()` ya existen. `getCourtPendingCountAction()` ya verifica reservas pendientes.

**Lo que falta:** Verificar que la validación backend en `deactivateCourtAction()` efectivamente bloquea si hay reservas futuras CONFIRMED o PENDING, y exponer el toggle en la UI con feedback de error.

**Archivos a revisar:**
- `actions/owner/courts.ts` (o path equivalente donde viva `deactivateCourtAction`) — verificar query de bloqueo.

**Archivos a modificar:**
- `app/(owner)/admin/canchas/CanchasClient.tsx`

**Cambios:**
1. Agregar botón "Desactivar cancha" / "Activar cancha" en la tarjeta de cada cancha.
2. Al desactivar: llamar `getCourtPendingCountAction()` primero. Si count > 0, mostrar modal de confirmación con "Esta cancha tiene X reservas futuras. Reubícalas antes de desactivarla."
3. Al confirmar (0 reservas futuras): llamar `deactivateCourtAction()`.
4. Manejar error del backend con toast en bottom-right.
5. UI visual: cancha inactiva muestra badge "Inactiva" + estilo grisado en la tarjeta.

**Validación backend a confirmar:** La acción debe hacer un `prisma.booking.count({ where: { courtId, date: { gte: today }, status: { in: ['CONFIRMED', 'PENDING'] } } })` y retornar error si > 0.

---

## Épica 3: Centro de Resolución y Conflictos (`/admin/conflictos`)

### 3.1 Retorno de Reservas 'Warning' (Soft Constraints)

**Hallazgo clave:** Esta funcionalidad **ya está implementada**.
- `Booking.outOfHoursWarning` y `Booking.exceptionApprovedAt` existen en schema.
- El tipo `OUT_OF_HOURS` en `conflicts.ts` DAL ya detecta bookings con `outOfHoursWarning=true` y `exceptionApprovedAt=null`.
- `approveExceptionAction()` en `ConflictosClient` ya aprueba la excepción.

**Acción requerida:** Verificar que la query en `features/reservas/dal/conflicts.ts` efectivamente incluye estas reservas en la lista de conflictos. Si no aparecen, es un bug en el filtro del DAL.

**Si hay bug:** Corregir el `where` clause en el query de `OUT_OF_HOURS` para que incluya bookings con `outOfHoursWarning: true, exceptionApprovedAt: null`.

**No se necesita nueva tabla ni nuevo campo de BD** — la infraestructura ya existe. Solo verificar que el DAL los expone correctamente.

**Archivos a revisar:**
- `features/reservas/dal/conflicts.ts` — verificar el query de OUT_OF_HOURS

---

### 3.2 Reubicación con WizardBooking

**Problema:** El flujo de reubicación actual usa inputs básicos (fecha/hora/cancha) en un panel lateral, sin la experiencia completa del wizard.

**Propuesta:** Reemplazar el panel de reubicación por el `ManualBookingWizard` pre-poblado con los datos del booking en conflicto.

**Análisis de impacto:**
- `ManualBookingWizard` acepta `defaultCourtId`, `defaultDate`, `defaultTime` para pre-poblar.
- El wizard crea una **nueva** reserva — para reubicación, necesitamos: (1) crear la nueva reserva, (2) cancelar la original.
- El wizard no tiene modo "relocation" nativo — necesita un modo especial o un wrapper.

**Opciones de implementación:**

**Opción A — Wrapper de reubicación (Recomendada):**
Crear un componente `RelocateBookingWizard` que wrappea `ManualBookingWizard` con:
- Pre-población de `defaultDate`, `defaultTime`, `defaultCourtId` del booking conflictivo.
- Un header contextual: "Reubicar reserva de [Nombre]".
- Al `onBookingCreated`: ejecutar también `cancelBooking(originalId)`.
- No modifica el wizard original — aislado.

**Opción B — Prop `mode='relocation'` en ManualBookingWizard:**
Agregar lógica de relocation directamente al wizard con una prop `relocatingBookingId`. Más integrado pero ensucia el componente principal.

**Recomendación:** Opción A — wrapper limpio sin tocar el wizard.

**Archivos a modificar:**
- Crear `app/(owner)/admin/conflictos/RelocateBookingWizard.tsx` (wrapper, ~80 líneas)
- `app/(owner)/admin/conflictos/ConflictosClient.tsx` — reemplazar panel de reubicación básico por `<RelocateBookingWizard>`

**Datos a pasar al wizard desde el conflicto:**
```typescript
defaultDate: conflict.booking.date
defaultTime: conflict.booking.startTime
defaultCourtId: conflict.booking.courtId
// context header
relocatingBookingId: conflict.booking.id
relocatingName: conflict.booking.displayName
```

**Flujo de la acción `onBookingCreated`:**
```
1. Nueva reserva creada por el wizard → onBookingCreated(newBookingId)
2. Llamar cancelBooking(conflict.booking.id) 
3. Toast: "Reserva reubicada correctamente"
4. Refrescar lista de conflictos
```

---

## Resumen de Archivos por Épica

### Épica 1 — Grilla (3-4 archivos)
| Archivo | Tipo de cambio |
|---|---|
| `features/.../BookingGrid.tsx` | scroll anchor + CSS transition |
| `features/.../BookingBlockCell/BookingBlockCell.tsx` | verificar/mover badge conflicto |
| `features/.../BookingGridFilterBar/BookingGridFilterBar.tsx` | texto del badge contextual |

### Épica 2 — Canchas (1-2 archivos)
| Archivo | Tipo de cambio |
|---|---|
| `app/(owner)/admin/canchas/CanchasClient.tsx` | toggles hideFromGrid + isActive |
| `actions/owner/courts.ts` (o equivalente) | verificar/agregar validación de reservas futuras |

### Épica 3 — Conflictos (2-3 archivos)
| Archivo | Tipo de cambio |
|---|---|
| `features/reservas/dal/conflicts.ts` | verificar query OUT_OF_HOURS |
| `app/(owner)/admin/conflictos/ConflictosClient.tsx` | integrar RelocateBookingWizard |
| `app/(owner)/admin/conflictos/RelocateBookingWizard.tsx` | NUEVO — wrapper ~80 líneas |

**Total estimado:** 6-9 archivos modificados, 1 archivo nuevo.

---

## Orden de Implementación Recomendado

1. **Épica 1** primero — son cambios puramente de UI, alto impacto visual, bajo riesgo.
2. **Épica 2** segundo — verifica lógica existente, agrega UI en un solo componente.
3. **Épica 3** último — requiere integración entre componentes y verificación de DAL.

---

¿Estás de acuerdo con este plan de impacto para proceder con la implementación Épica por Épica?
