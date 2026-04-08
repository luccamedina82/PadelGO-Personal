# Plan: Tarifas, Reglas y Definition of Done — /admin/reservas

> Fecha de planificación: 2026-04-07
> Rama de trabajo sugerida: `owner/tarifas-v2`

---

## Contexto y decisiones de diseño

### Modelo mental definitivo

La `BookingRule` tiene dos "audiencias": el **admin** (staff/owner creando reservas manuales) y el **jugador online** (booking desde la app del jugador). Cada campo aplica distinto según la audiencia:

| Campo | Admin | Jugador Online |
|---|---|---|
| `startTime` / `endTime` | Horario operativo del club | Horario base (puede ser recortado por overrides) |
| `onlineStartTime` / `onlineEndTime` | Ignorado | Recorta el horario visible para el jugador |
| `price` (base) | Precio default si no hay regla de mayor prioridad | Ídem |
| `price` (prioridad > 0) | Aplica (el precio es el precio) | Aplica |
| `allowedDurations` (base) | **Paleta del admin** — siempre disponible, mín. 2 | Default online si no hay regla de mayor prioridad |
| `allowedDurations` (prioridad > 0) | Ignorado — admin usa siempre la paleta de la base | Restringe las opciones del jugador en ese bloque |
| `intervalMinutes` | Ignorado — el grid admin siempre es de 30 min | Granularidad de slots visibles |

### Invariantes que el sistema debe garantizar

1. Siempre debe existir exactamente una regla base activa (`priority=0, courtIds=[]`) por club.
2. Las `allowedDurations` de reglas de prioridad > 0 deben ser subconjunto de las de la regla base activa.
3. La regla base siempre debe tener mínimo 2 duraciones seleccionadas.
4. Todo club nuevo se crea con una regla base default.

---

## 1. Schema (Prisma)

- [x] Agregar `onlineStartTime String?` a `BookingRule`
- [x] Agregar `onlineEndTime String?` a `BookingRule`
- [x] Correr `pnpm prisma migrate dev --name add-online-time-overrides`
- [x] Correr `pnpm prisma generate` y reiniciar dev server

> Los campos son nullable con default null → sin breaking changes en datos existentes.
> `allowedDurations` ya existe — no requiere cambio en schema, solo cambia la semántica de uso.

---

## 2. DAL — `features/tarifas/dal/rules.ts`

- [x] Agregar `onlineStartTime` y `onlineEndTime` al `select` de `getRulesByClubId`
- [x] Agregar ambos campos a la interfaz `BookingRuleRow`

---

## 3. Actions — `features/tarifas/actions/rules.ts`

- [x] Agregar `onlineStartTime: string | null` y `onlineEndTime: string | null` a `RuleInput`
- [x] Incluir ambos campos en el `prisma.bookingRule.create` (tanto base como no-base)
- [x] Incluir ambos campos en el `prisma.bookingRule.updateMany`
- [x] Agregar validación en `createRule` / `updateRule` vía helper `validateNonBaseRule`:
  - #1 Rango horario dentro del horario operativo de la base
  - #5 Días son subconjunto de los días de la base
  - #6 Duraciones son subconjunto de las duraciones de la base
  - #7 No hay otra regla activa con misma prioridad + días solapados + franja solapada

---

## 4. Motor de disponibilidad — `lib/availability.ts`

- [x] Agregar `onlineStartTime?: string | null` y `onlineEndTime?: string | null` a `AvailabilityConfig`
- [x] Agregar `onlineStartTime?` / `onlineEndTime?` a `BookingRuleInput`
- [x] En `calcAvailableSlots`, cuando `mode === 'player'`: usar overrides de horario online
- [x] En `calcAvailableSlots`, cuando `mode === 'admin'`: `effectiveDurations` usa siempre la regla base (priority=0), no la cascade

---

## 5. Fix: desacoplar `allowedDurations` del contexto admin

- [x] **`app/(owner)/admin/page.tsx`**: `allowedDurations` del admin solo viene de la regla base activa
- [x] **`features/reservas/actions/floatingFormData.ts`**: `globalDurations` solo desde regla base (priority=0)
- [x] **`features/reservas/actions/bookings.ts`**: validación de duración en move/resize usa solo la regla base
- [x] **`features/reservas/dal/courts.ts`**: `RULE_SELECT` actualizado con los nuevos campos

---

## 6. UI — `RuleFormModal`

- [x] Rediseño con secciones explícitas: "Admin y Online" / "Solo Admin" / "Solo Online"
- [x] **Para regla base**: validar mínimo 2 duraciones seleccionadas
- [x] **Para regla base**: `onlineStartTime`/`onlineEndTime` en sección "Solo Online" (no colapsable)
- [x] **Para regla base**: validaciones de coherencia de horario online vs. horario del club
- [x] **Para reglas de prioridad > 0**: checkboxes de duraciones dinámicos desde la base activa
- [x] **Para reglas de prioridad > 0**: aviso si no hay base activa
- [x] **Para reglas de prioridad > 0**: warning cuando `activeFrom` es fecha pasada
- [x] `intervalMinutes` etiquetado como "Slots cada (booking online)" con descripción contextual
- [x] `onlineStartTime`/`onlineEndTime` no se muestran en formularios de reglas no-base

## 7. UI — `TarifasClient` / `BaseRuleCard`

- [x] `BaseRuleCard`: muestra "Online: HH:MM – HH:MM" cuando hay overrides configurados
- [x] `TarifasClient`: pasa `baseDurations` al `RuleFormModal`
- [x] Optimistic update en `handleFormSubmit` incluye los nuevos campos
- [x] Banner amarillo cuando la tarifa base activa tiene `price === null`
- [x] Warning cuando hay más de un borrador sin fecha de activación en paralelo

---

## 7. UI — `TarifasClient` / `BaseRuleCard`

- [x] `BaseRuleCard`: muestra "Online: HH:MM – HH:MM" cuando hay overrides configurados
- [x] `TarifasClient`: pasa `baseDurations` al `RuleFormModal`
- [x] Optimistic update en `handleFormSubmit` incluye los nuevos campos

---

## 8. Creación de club con tarifa base obligatoria

> El módulo superadmin aún no existe en código. Cuando se construya:

- [ ] La server action `createClub` debe crear la regla base **en la misma transacción** (`prisma.$transaction`):
  ```
  name: "Tarifa Base"
  priority: 0, courtIds: [], daysOfWeek: [0..6]
  startTime: "08:00", endTime: "23:00"
  price: null  ← owner completa después
  intervalMinutes: 60
  allowedDurations: [60, 90, 120]
  isActive: true
  ```
- [x] En `/admin/tarifas`, si la regla base tiene `price === null`, mostrar banner de advertencia.

---

## 9. Definition of Done — `/admin/reservas`

Todo lo de abajo tiene que estar funcionando para dar por cerrada esta sección. Cualquier cosa que no esté en esta lista va al backlog como issue separado y no bloquea el cierre.

### Grid principal

- [ ] Drag para crear reserva (fantasma visual → popover de confirmación rápida)
- [ ] Drag para mover reserva existente entre horarios/canchas
- [ ] Resize de reserva para cambiar duración
- [ ] Reservas recurring visualmente distinguidas del resto
- [ ] Reservas de tipo `BLOCK` (cierre de cancha) con estilo propio
- [ ] Warning visual en reservas con `outOfHoursWarning = true`
- [ ] Warning visual en reservas con `exceptionApprovedAt = null` (excepción pendiente de revisión)
- [ ] Estados diferenciados por color: `PENDING` / `CONFIRMED` / `CANCELLED` / `COMPLETED`
- [ ] Navegación de fecha (anterior / siguiente / hoy) sin full-page reload
- [ ] Auto-refresh cada 30 segundos (React Query)
- [ ] El grid respeta `startTime`/`endTime` de la regla base activa — no muestra slots fuera
- [ ] El precio mostrado en wizard/popover usa la cascade de reglas correcta

### Booking Quick Popover

- [ ] Nombre del jugador, o "Manual" con nombre y teléfono si aplica
- [ ] Horario, cancha, duración, precio total
- [ ] Botones: Confirmar / Cancelar / Aprobar excepción (si `outOfHoursWarning && !exceptionApprovedAt`)
- [ ] Indicador de `paymentStatus` (Pendiente / Pagado / Manual)

### Reserva manual (wizard)

- [ ] Duraciones disponibles tomadas de la regla base (`allowedDurations`), no de reglas de prioridad
- [ ] Precio calculado con cascade de reglas según cancha + horario elegido
- [ ] Campos: cancha, fecha, hora inicio, duración, nombre jugador (o búsqueda de usuario), teléfono, precio override opcional

### Fuera de scope de `/admin/reservas` (no implementar aquí)

- Pagos / integración Mercado Pago
- Historial y filtros avanzados de reservas → eso es Analytics
- Chat o comunicación con jugadores
- Auto-completar reservas pasadas a `COMPLETED` → es un cron (ya en tech debt del CLAUDE.md)
- Booking online para jugadores → es la app del jugador, distinto route group

---

## SpecialHours — Decisión: diferir para `/admin/horarios`

**Workaround actual:** el admin puede crear una reserva tipo `BLOCK` en todas las canchas para el rango horario que quiere cerrar. Es manual pero funciona.

**Por qué no implementar ahora:** es una feature transversal que tocaría 4 capas en simultáneo:
1. UI nueva de gestión (página `/admin/horarios` o similar)
2. `calcAvailableSlots` + DAL — cada llamada al motor necesitaría consultar `SpecialHours` para la fecha y sobreescribir `openTime`/`closeTime` (o retornar vacío si `isClosed`)
3. Grid del admin — indicador visual de días con horario especial o cerrados (vista diaria y semanal)
4. Booking online — cuando exista, también deberá consultarlo

No bloquea ningún ítem del DoD de `/admin/reservas`. Implementar en el contexto de `/admin/horarios`, donde también irán los horarios habituales por día de la semana, feriados nacionales, etc. Todo junto tiene más sentido y menos fricción.

---

## Referencia: lo que implica en el lado del jugador (player app)

Cuando se construya el flow de booking online del jugador, estos son los cambios que ya deberían estar listos del lado del servidor para que funcionen:

- **Horario visible**: `calcAvailableSlots` en `mode: 'player'` ya usará `onlineStartTime`/`onlineEndTime` de la regla base. El jugador solo verá slots dentro de ese rango.
- **Slots disponibles**: respetará `intervalMinutes` de la regla activa para el bloque horario (ej: solo slots a las :00 si `intervalMinutes = 60`).
- **Duraciones por bloque**: el jugador verá solo las duraciones que define la regla de mayor prioridad para el horario elegido. Si no hay regla de prioridad, usa las de la base.
- **Precio**: ídem admin — cascade por prioridad. El precio que ve el jugador es el mismo que ve el admin.
- **Anticipación mínima**: `minAdvanceMinutes` del club se aplica en `calcAvailableSlots` bloqueando slots demasiado próximos a `now`.
- **Ventana de reserva**: `bookingWindowDays` del club limita hasta qué fecha hacia adelante puede reservar (ya en el modelo `Club`).

Lo que el player app necesitará implementar por su cuenta (no depende de este plan):
- UI de selección de cancha, fecha, horario, duración
- Confirmación y flujo de pago (Mercado Pago)
- Invitación de otros jugadores al partido
- Open match (partido abierto a desconocidos)




