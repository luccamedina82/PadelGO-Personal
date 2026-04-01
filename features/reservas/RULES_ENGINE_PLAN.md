# Motor de Reglas Dinámico — Plan de Refactorización

> Documento vivo para la feature de disponibilidad y precios por reglas.
> Última actualización: 2026-03-31

---

## Contexto

El sistema actual define disponibilidad y precios mediante `CourtAvailability` (una fila por cancha × día de semana), con un precio único (`pricePerHour`) y slots generados en intervalos fijos de 30 min en `lib/availability.ts`. No existe soporte para precios diferenciados por horario (ej. "Noche"), intervalos configurables (ej. 60 min para jugadores), ni jerarquía de reglas que permita distintos precios por cancha o franja horaria.

Este plan introduce un **motor de cascada por prioridad** que resuelve la regla ganadora para cada slot, sin romper la lógica existente del sistema de disponibilidad.

---

## Fase 1: Schema Prisma ✅ COMPLETADA

**Archivo:** `prisma/schema.prisma`

### Modelo `BookingRule` rediseñado

```prisma
model BookingRule {
  id               String   @id @default(cuid())
  clubId           String
  club             Club     @relation("ClubBookingRules", fields: [clubId], references: [id], onDelete: Cascade)
  courtId          String?  // null = aplica a todas las canchas del club
  court            Court?   @relation(fields: [courtId], references: [id], onDelete: SetNull)
  name             String   // "Default Club", "Horario Noche", "Cancha B Especial"
  priority         Int      @default(0) // 0=default club, 1=por cancha, 2+=bloque horario
  daysOfWeek       Int[]    // [0..6], 0=Domingo
  startTime        String   // "08:00"
  endTime          String   // "22:00"
  price            Int?     // centavos ARS; null = hereda de pricePerHour de CourtAvailability
  intervalMinutes  Int      @default(30) // granularidad de slots: 30 o 60
  allowedDurations Int[]    @default([60, 90, 120])
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())

  @@index([clubId])
  @@index([courtId])
}
```

### Cambios respecto al modelo anterior

| Campo anterior | Campo nuevo | Cambio |
|---|---|---|
| `courtId @unique` | `courtId` (sin unique) | Bug fix: permite múltiples reglas por cancha |
| `pricePerRule Int` | `price Int?` | Opcional para herencia de cascada |
| `slotIntervalMinutes Int` | `intervalMinutes Int` | Renombrado |
| `start String` | `startTime String` | Renombrado |
| `end String` | `endTime String` | Renombrado |
| — | `name String` | NUEVO |
| — | `priority Int @default(0)` | NUEVO |
| — | `daysOfWeek Int[]` | NUEVO |
| — | `createdAt DateTime` | NUEVO |
| `onDelete: Cascade` (court) | `onDelete: SetNull` (court) | Fix: regla club-wide si se borra cancha |

---

## Fase 2: `lib/availability.ts` — Algoritmo de Cascada

**Archivos afectados:** `lib/availability.ts`, `types/index.ts`

### Nueva función `resolveBookingRule()`

```
Entrada: rules[], dayOfWeek, slotStartMinutes, fallbackPricePerHour
Algoritmo:
  1. Filtrar reglas donde:
     - daysOfWeek incluye dayOfWeek
     - slotStartMinutes >= timeToMinutes(rule.startTime)
     - slotStartMinutes <  timeToMinutes(rule.endTime)
  2. Ordenar por priority DESC
  3. Tomar la primera regla como base (mayor prioridad)
  4. price: primera regla con price !== null; si ninguna → fallbackPricePerHour
  5. intervalMinutes: de la regla de mayor prioridad
  6. allowedDurations: de la regla de mayor prioridad
  7. Retornar { ruleName, price, intervalMinutes, allowedDurations }
```

### Actualizar `AvailabilityConfig`

```typescript
export interface AvailabilityConfig {
  openTime: string
  closeTime: string
  pricePerHour: number       // fallback si ninguna regla define precio
  rules?: BookingRuleInput[] // reglas combinadas (club-wide + cancha)
}
```

### Actualizar `calcAvailableSlots()`

Añadir parámetro `mode: 'admin' | 'player' = 'player'`:
- **Player**: solo incluir slot si `start % resolved.intervalMinutes === 0`
- **Admin**: mantener incremento base 30 min (ignora intervalMinutes para la grilla)
- Ambos: usar `resolved.allowedDurations` y `resolved.price`

### Extender `TimeSlot` en `types/index.ts`

```typescript
export interface TimeSlot {
  // ...campos existentes...
  appliedRuleName?: string  // NUEVO: transparencia en wizard admin
}
```

### Escenarios de test del algoritmo

| Escenario | Input | Resultado esperado |
|---|---|---|
| A Default Club | Lunes 10:00, sin regla específica | int=30m, dur=[60,90], price=$12.000 |
| B Noche Cancha A | Lunes 20:00, Cancha A | priority=1 gana, dur=[90], price=$14.000 |
| B+A overlap | Lunes 18:00, Cancha A | Regla A (priority=0) aplica (B empieza 19:00) |
| C Cancha B player | Martes 09:00, Cancha B | int=60m, dur=[60,90,120] |
| C Cancha B admin | Martes 09:00, Cancha B | grilla 30m, pero prix y dur de regla C |

---

## Fase 3: DAL — Incorporar Reglas

**Archivos afectados:**
- `features/reservas/dal/courts.ts`
- `features/reservas/dal/wizardData.ts`
- `features/reservas/actions/bookings.ts`

### `features/reservas/dal/courts.ts`

- Añadir `bookingRule` al select de `getCourtsByClubId`
- Query paralela para reglas club-wide (`courtId: null`)
- Retornar `{ courts, clubRules }`
- Añadir `cacheTag('rules-${clubId}')`

### `features/reservas/dal/wizardData.ts`

- Combinar reglas: `[...clubRules, ...court.bookingRule]`
- Pasar `rules: combinedRules` a `AvailabilityConfig`
- Pasar `mode: 'admin'` para el wizard
- Propagar `appliedRuleName` al `CourtSlotsEntry`

### `features/reservas/actions/bookings.ts`

- En `createManualBooking()`: resolver precio via `resolveBookingRule()`
- Soportar `priceOverride?: number` en `CreateManualBookingInput`
- Lógica: `totalPrice = priceOverride ?? calcBookingPrice(resolved.price ?? avail.pricePerHour, durationMinutes)`
- Cache: `revalidateTag('rules-${clubId}')` al mutar reglas

---

## Fase 4: UI Admin — Wizard con Tarifa y Override

**Archivos afectados:**
- `features/reservas/components/manual-booking-wizard/ManualBookingWizard.tsx`
- `features/reservas/components/manual-booking-wizard/types/manualBookingWizard.types.ts`

### Nuevos estados en Wizard

```typescript
const [priceOverrideEnabled, setPriceOverrideEnabled] = useState(false)
const [priceOverride, setPriceOverride] = useState<number | ''>('')
```

### UI a añadir (sección de confirmación)

```
┌─────────────────────────────────────────┐
│ Tarifa: "Horario Noche"   $21.000       │
│ [Override] $_________ pesos             │
└─────────────────────────────────────────┘
```

- Badge de regla aplicada (muted color)
- Toggle override + input en pesos (×100 antes de enviar)
- Badge de override en color advertencia cuando activo
- Extraer a `PriceRuleDisplay.tsx` si ManualBookingWizard supera 200 líneas

---

## Fase 5: Adaptación del Panel de Jugadores

**Archivos afectados:** páginas en `app/(auth)/`

### Cambios

- Pasar `mode: 'player'` a `calcAvailableSlots()`
- Para Escenario C (Cancha B, intervalMinutes=60):
  - Player ve: 08:00, 09:00, 10:00...
  - Admin ve: 08:00, 08:30, 09:00, 09:30...

---

## Funciones Reutilizables (no recrear)

| Función | Archivo | Uso |
|---|---|---|
| `calcBookingPrice()` | `lib/availability.ts:147` | Precio final (precio × duración) |
| `formatPrice()` | `lib/availability.ts:152` | Display en wizard |
| `timeToMinutes()` | `lib/availability.ts:23` | Comparar rangos en resolveBookingRule |
| `getAdminContext()` | `lib/dal/admin.ts` | Auth en acciones de reglas |
| `cacheTag/cacheLife` | `next/cache` | Cache en DAL |
| `toUtcDateStr()` | `lib/date.ts` | Conversión de fechas |

---

## Archivos NO modificar en esta feature

- `features/reservas/components/booking-grid/BookingGrid.tsx` (grilla admin siempre 30 min)
- `features/reservas/components/booking-grid/helpers/bookingGrid.helpers.ts` (SLOT_HEIGHT fijo)
- `app/(owner)/admin/canchas/CanchasClient.tsx` (gestión de canchas, reglas tendrán su propia UI)
