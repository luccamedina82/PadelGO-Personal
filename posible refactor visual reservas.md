# Posible Refactor Visual — admin/reservas

## Diagnóstico del estado actual

La pantalla tiene tres zonas mezcladas sin jerarquía clara:
- La fecha y filtros están **todos en el topbar**, compitiendo en importancia
- El calendario solo aparece como popover temporal (no anclado)
- No hay espacio dedicado para filtros — quedarían flotando o en dropdowns
- Al hacer click en una reserva, el modal bloquea la grilla

---

## Propuesta: Layout tri-zona

```
┌──────────────┬─────────────────────────────────┐
│  LEFT PANEL  │  TOPBAR (fino)                  │
│  ~220px      ├─────────────────────────────────┤
│              │                                 │
│  Calendario  │         BOOKING GRID            │
│  (fijo)      │         (flex-1)                │
│              │                                 │
│  ─────────── │                                 │
│  Filtros de  │                                 │
│  canchas     │                                 │
│              │                                 │
│  ─────────── │                                 │
│  Stats rápidos│                                │
└──────────────┴─────────────────────────────────┘
```

---

## Recomendaciones concretas

**1. Left panel fijo (siempre visible)**
- El calendario vive aquí **embebido**, no como popover. La navegación de fechas es el gesto más frecuente del admin — no debería requerir abrir/cerrar nada.
- Debajo del calendario: checkboxes para mostrar/ocultar canchas específicas (útil cuando hay 6+)
- Mini stats: "X reservas hoy · Y canchas libres"

**2. Topbar ultra simplificado**
Solo: `[← hoy →]  [Día | Semana]  ──────────────  [+ Nueva reserva]`  
Sacar fecha del topbar (ya está en el panel) y sacar filtros de ahí.

**3. Panel derecho deslizable al seleccionar reserva**
En lugar de modal bloqueante → un drawer lateral de ~320px que se abre mostrando el detalle/edición de la reserva. La grilla sigue visible detrás. Esto es el cambio de mayor impacto en fluidez.

**4. Indicador de hora actual**
Una línea horizontal en la grilla marcando la hora actual mejora enormemente la orientación espacial.

---

## Prioridad de implementación

| Impacto | Item |
|---|---|
| Alto | Left panel con calendario embebido + filtro de canchas |
| Alto | Drawer lateral para detalle de reserva |
| Medio | Topbar simplificado |
| Medio | Línea de hora actual |

---

## Archivos relevantes

- `app/(owner)/admin/reservas/` — página principal (Server Component + parallel routes)
- `features/reservas/components/booking-grid/` — BookingGrid y sub-componentes
- `features/reservas/components/weekly-booking-grid/` — WeeklyBookingGrid
- `features/reservas/components/ui/CalendarPopover.tsx` — calendario actual (convertir a embebido)
- `features/reservas/components/manual-booking-wizard/` — wizard de nueva reserva
