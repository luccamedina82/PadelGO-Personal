# MEJORAS_PLAN — Dashboard Administrativo PadelGo

> Comparativa entre el estado actual del proyecto y la hoja de ruta de `posiblesmejoras.md`.
> Foco: dashboard admin (owner/staff). Solo mejoras funcionales y refinamiento de lo existente.


---

## Estado actual del dashboard

### Lo que YA existe y funciona

| Módulo                   | Páginas                 | Funcionalidades                                                                                                                |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Dashboard principal**  | `/admin`                | KPIs del día (reservas, canchas libres, ingresos, bar), estado de canchas en tiempo real, próximas reservas, resumen del día   |
| **Grilla de reservas**   | `/admin/reservas`       | Calendario visual por cancha, nav de 14 días, detalle de booking al click, confirmar/cancelar reservas, línea de "hora actual" |
| **Nueva reserva manual** | `/admin/reservas/nueva` | Wizard de 4 pasos (cancha, fecha/hora, tipo, datos), backdrop con grilla, detección de conflictos, bloqueo de cancha           |
| **Canchas**              | `/admin/canchas`        | CRUD de canchas (nombre, tipo, cubierta, posición SVG), activar/desactivar                                                     |
| **Horarios y precios**   | `/admin/horarios`       | Horarios de apertura por cancha por día, precio por hora                                                                       |
| **Turnos fijos**         | `/admin/turnos-fijos`   | CRUD recurrentes (jugador, cancha, día, hora), preview, cancelar                                                               |
| **Bar**                  | `/admin/bar`            | Productos CRUD, registro de ventas, asociar venta a booking, stock bajo, ventas del día                                        |
| **Equipo**               | `/admin/equipo`         | Invitar staff por email, ver invitaciones pendientes, eliminar staff                                                           |
| **Analytics**            | `/admin/analytics`      | Ingresos 30 días / mes, ocupación, horarios pico, ranking canchas, origen de reservas, gráfico semanal                         |
| **Configuración**        | `/admin/config`         | Editar nombre, descripción, vibe, dirección, teléfono, email, amenities, tags                                                  |
| **Roles**                | Sidebar                 | OWNER ve todo, STAFF ve solo: Hoy, Reservas, Bar, Horarios                                                                     |
| **Pagos**                | MP integration          | Mercado Pago Checkout Pro para reservas online                                                                                 |

---

## Checklist comparativo con `posiblesmejoras.md`

### Fase 1 — MVP (Sistema básico de reservas)

| #   | Feature                                            | Estado  | Notas                                                                                              |
| --- | -------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| 1   | Gestión de canchas (CRUD, tipo, estado)            | HECHO   | Falta: eliminar cancha (solo desactiva)                                                            |
| 2   | Calendario de reservas (vista día, crear/cancelar) | HECHO   | Falta: vista semanal, editar turno, drag & drop, mover turno                                       |
| 3   | Gestión de jugadores (buscar, historial)           | PARCIAL | Solo se ve nombre en booking. No hay listado/búsqueda de jugadores desde admin                     |
| 4   | Participantes del partido (1-4 jugadores, pagado)  | NO      | Solo se guarda `playerIds[]` pero no hay UI para gestionar participantes ni marcar pago individual |
| 5   | Gestión de precios (por cancha, por horario)       | HECHO   | Un precio por cancha por día de semana                                                             |
| 6   | Pagos simples (marcar pago, parcial, deuda)        | PARCIAL | Solo `paymentStatus` global (UNPAID/PAID/MANUAL). No hay pago parcial ni deuda por jugador         |

### Fase 2 — Operación real del club

| #   | Feature                                 | Estado  | Notas                                                                                                |
| --- | --------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| 7   | Partidos abiertos                       | PARCIAL | Existe en modelo (`isOpenMatch`, `spotsAvailable`) y en player view, pero no hay gestión desde admin |
| 8   | Bloqueos de cancha                      | HECHO   | Se puede crear bloqueo como reserva tipo BLOCK con motivo                                            |
| 9   | Notificaciones (email, whatsapp, push)  | MINIMO  | Solo email de confirmación. No hay recordatorios, ni whatsapp, ni push                               |
| 10  | Roles de usuario (admin, recepcionista) | HECHO   | OWNER y STAFF con permisos diferenciados                                                             |

### Fase 3 — Crecimiento (engagement)

| #   | Feature     | Estado  | Notas                                                                     |
| --- | ----------- | ------- | ------------------------------------------------------------------------- |
| 11  | Matchmaking | NO      | —                                                                         |
| 12  | Torneos     | NO      | —                                                                         |
| 13  | Ranking     | PARCIAL | Modelo tiene `level`, `matchesPlayed`, `matchesWon`, pero no hay UI admin |

### Fase 4 — Analytics y optimización

| #   | Feature                                | Estado | Notas                                               |
| --- | -------------------------------------- | ------ | --------------------------------------------------- |
| 14  | Métricas (KPIs, ocupación, horas pico) | HECHO  | Ingresos, ocupación, horarios pico, ranking canchas |
| 15  | Reportes (exportar Excel/CSV)          | NO     | Solo visualización, sin exportación                 |

### Fase 5 — SaaS avanzado

| #   | Feature                     | Estado  | Notas                                                                   |
| --- | --------------------------- | ------- | ----------------------------------------------------------------------- |
| 16  | Multi club                  | PARCIAL | Modelo soporta multi-club pero UI solo muestra el primer club del owner |
| 17  | Pagos online (Mercado Pago) | HECHO   | Checkout Pro integrado                                                  |
| 18  | App jugadores               | HECHO   | Web app responsive con booking wizard, historial, open match            |

---

## Plan de mejoras priorizadas para el Dashboard Admin

### PRIORIDAD 1 — Mejoras críticas sobre lo que ya existe

#### M1.1 — Editar reserva existente

**Problema:** Actualmente solo se puede confirmar o cancelar una reserva. No se puede cambiar horario, cancha o duración.
**Solución:**

- Agregar botón "Editar" en el modal de detalle de booking (`BookingGrid.tsx`)
- Crear action `updateBooking` en `actions/owner/bookings.ts` que valide conflictos
- Permitir cambiar: cancha, fecha, hora, duración, nombre/teléfono
- Re-validar disponibilidad en la misma transacción

#### M1.2 — Gestión de pagos desde admin

**Problema:** El admin no puede marcar una reserva como pagada, registrar pago parcial o ver deudas.
**Solución:**

- Agregar botones "Marcar pagado" / "Marcar parcial" en el modal de booking
- Crear action `updatePaymentStatus` en `actions/owner/bookings.ts`
- Mostrar indicador visual de estado de pago en la grilla (icono/color en el bloque)
- En el resumen del día (`/admin`), mostrar total cobrado vs total pendiente

#### M1.3 — Gestión de participantes del partido

**Problema:** `playerIds[]` existe pero no hay forma de gestionar quién juega en cada turno.
**Solución:**

- En el modal de booking, agregar sección "Jugadores" (hasta 4)
- Buscar jugadores por nombre/email o agregar nombre manual
- Marcar pago individual por jugador (split de precio)
- Crear action `updateBookingPlayers`

#### M1.4 — Vista semanal en grilla de reservas

**Problema:** Solo existe vista de un día. Para club chicos con 2-3 canchas, ver la semana de un vistazo sería más útil.
**Solución:**

- Agregar toggle "Día / Semana" en header de `/admin/reservas`
- Vista semanal: eje X = días (Lun-Dom), eje Y = horarios, una tab por cancha
- Reutilizar la mecánica de `BookingGrid` pero con layout horizontal

### PRIORIDAD 2 — Funcionalidades nuevas para operación diaria

#### M2.1 — Listado y búsqueda de jugadores

**Problema:** El admin no tiene forma de ver sus clientes, buscar un jugador, o ver su historial.
**Solución:**

- Nueva página `/admin/jugadores`
- Listar todos los jugadores que han reservado en el club (query desde Booking → User)
- Búsqueda por nombre/email/teléfono
- Ver historial de reservas por jugador, total gastado, frecuencia
- Agregar a sidebar con ícono de persona

#### M2.2 — Gestionar partidos abiertos desde admin

**Problema:** Los partidos abiertos existen en el modelo pero no hay gestión desde el dashboard.
**Solución:**

- En el modal de booking, agregar opción "Convertir a partido abierto"
- Crear sección en `/admin` que muestre partidos abiertos activos con spots disponibles
- Poder cerrar un partido abierto manualmente
- Ver los jugadores que se anotaron

#### M2.3 — Exportar reportes (CSV)

**Problema:** Analytics solo muestra datos en pantalla, no se pueden exportar.
**Solución:**

- Agregar botón "Exportar CSV" en `/admin/analytics`
- Exportar: reservas del período, ingresos por día, ocupación por cancha
- Implementar API route `/api/export/bookings` que genera CSV
- Usar `Blob` en cliente para descarga directa

#### M2.4 — Notificaciones y recordatorios

**Problema:** Solo hay email de confirmación. Falta recordatorio previo al turno.
**Solución:**

- Email de recordatorio 2hs antes del turno (cron job o Vercel Cron)
- Notificación al admin cuando hay una reserva nueva online
- En el dashboard, sección "Actividad reciente" con feed de eventos

### PRIORIDAD 3 — Mejoras de UX del dashboard existente

#### M3.1 — Mejora del dashboard principal (`/admin`)

- Agregar gráfico mini de ocupación de la semana (sparkline)
- Mostrar comparación con semana anterior ("+15% reservas")
- Indicador de "reservas sin confirmar" más prominente
- Widget de "cobros pendientes del día" (suma de bookings UNPAID de hoy)

#### M3.2 — Mejoras en la grilla de reservas

- Indicador visual de pago en cada bloque (ícono $ verde=pagado, rojo=pendiente)
- Filtro por cancha (mostrar/ocultar columnas)
- Filtro por tipo de reserva (online, manual, bloqueo, turno fijo)
- Tooltip al hacer hover sobre un bloque (sin necesidad de abrir modal)
- Imprimir grilla del día (CSS print-friendly)

#### M3.3 — Mejoras en el módulo de Bar

- Historial de ventas con paginación (hoy solo muestra las ventas del día)
- Reporte de productos más vendidos
- Gestión de stock: registrar entrada de mercadería
- Alertas de stock bajo más visibles en el dashboard principal

#### M3.4 — Mejoras en Analytics

- Selector de período customizado (desde/hasta)
- Comparación entre períodos (este mes vs mes anterior)
- Tasa de cancelación
- Ingreso promedio por reserva
- Ocupación por día de la semana (heatmap)
- Top clientes (por cantidad de reservas y por gasto total)

#### M3.5 — Mejoras en configuración del club

- Subir fotos del club
- Configurar política de cancelación (horas antes, cargo)
- Configurar duración de turnos permitidas por cancha (ej: solo 90min)
- Horarios especiales (feriados, eventos)

---

## Orden sugerido de implementación

```
Sprint 1 (operación básica):
  M1.1 — Editar reserva existente
  M1.2 — Gestión de pagos desde admin
  M3.2 — Indicador de pago en grilla

Sprint 2 (gestión de clientes):
  M2.1 — Listado y búsqueda de jugadores
  M1.3 — Gestión de participantes del partido

Sprint 3 (mejora dashboard):
  M3.1 — Mejora del dashboard principal
  M1.4 — Vista semanal
  M3.2 — Filtros y tooltip en grilla

Sprint 4 (reportes y analytics):
  M2.3 — Exportar CSV
  M3.4 — Mejoras en analytics (período custom, comparación)

Sprint 5 (comunicación):
  M2.4 — Notificaciones y recordatorios
  M2.2 — Partidos abiertos desde admin

Sprint 6 (pulido):
  M3.3 — Mejoras en Bar
  M3.5 — Mejoras en configuración
```

---

## Notas técnicas

- **No se usan librerías de fecha** → todas las mejoras deben usar `lib/date.ts` en server y `new Date()` en client
- **Precios en centavos** → siempre usar `formatPrice()` de `lib/availability.ts`
- **Roles**: validar siempre con `requireRole()` — STAFF no debería acceder a jugadores ni analytics
- **Transacciones**: todo cambio de booking (editar, pago, participantes) debe usar `prisma.$transaction` para evitar race conditions
- **Revalidación**: después de cada mutación, llamar `revalidatePath` en las rutas afectadas
