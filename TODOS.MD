
# TODOS:
     1- Siempre tiene que llevarte al timeline, incluso cuando se hace f5. ademas deberia haber como un botoncito para ir al time line si es que quedo mas arriba o mas abajo.
     2-no funciona el cobrar o sin cobrar del detalle de la reserva.
     3-no me deberia dejar estirar es decir extender la reserva hasta mas del horario limite de reservas, si el horario de cierre es a las 22:00 entonces, no deberia dejarme reservar un turno a las 22:00, tampoco clickearlo para reservarlo.
     4-cuando arrastro una reserva, no deberia tener el hover qeu hace mas claro el cuadrado de fondo, se solapan y no queda bien.
     5- habria que unificar los toast de creacion modificacion eliminacion de reservas para que aparezcan en un unico lugar, o a la derecha arriba o a la derecha abajo. yo prefiero derecha abajo.
     6- eliminar agendaview de /admin/reservas, solo va a quedar en hoy.
     7-sacar boton del sidebar de modo jugador.
     6- unificar /admin/canchas y /admin/horarios, tienen casi la misma interfaz, genera una buena interfaz bien estructurada y reorganizalo mejor para configurar los parametros que contiene cada uno adentro
     7-generar una planificacion y analisis de viabilidad impacto y mejora de las sigueintes posibles funcionalidades. en el archivo TODOS.MD, # Posibles features y consideraciones. A-Matchmaking / "Partidos Abiertos" (El problema del 4to jugador)
El mayor cuello de botella en el pádel es conseguir que los 4 jugadores coincidan. Muchas canchas quedan vacías porque "se bajó uno a último momento".

Funcionalidad: Permitir que un jugador (o el club) reserve una cancha como "Partido Abierto", especificando el nivel/categoría (ej. 5ta, 6ta, 7ma). Los demás usuarios de la app ven un lobby de partidos incompletos y hacen clic en "Me Anoto".

Valor de producto: El club llena horas muertas, y los jugadores que no tienen grupo armado empiezan a usar tu app a diario como si fuera una red social de pádel.

B- Punto de Venta Integrado (Bar, Paletas y Pelotas)
El negocio del pádel no es solo la cancha. Gran parte de la facturación diaria (hasta un 30%) viene del bar y la tienda.

Funcionalidad: En la vista de recepción, al hacer clic en la reserva, no solo cobras la cancha. Debes tener una opción rápida para agregar: +2 Aguas, +1 Gatorade, +Alquiler de 2 paletas, +1 Tubo de pelotas.

Valor de producto: Todo se suma a una sola cuenta vinculada a la cancha. A las 20:00 hs, cuando los jugadores salen sudados, el recepcionista les cobra un total unificado en lugar de cobrar la bebida por un lado y la cancha por otro.

C- Billetera Virtual y Sistema de Créditos (Fidelización)
Manejar efectivo o hacer transferencias por cada reserva de $12.000 es tedioso y genera errores administrativos.

Funcionalidad: Una billetera recargable en la app del jugador. El club puede ofrecer promociones: "Carga $50.000 y te acreditamos $60.000". Las reservas y el bar se descuentan automáticamente de ahí.

Valor de producto: Asegura flujo de caja adelantado para el dueño del club y agiliza brutalmente la recepción (el usuario entra, juega y se va sin pasar por caja).

D- Motor de Precios Dinámicos e Iluminación
El costo de una cancha a las 10:00 AM un martes no puede ser el mismo que a las 19:00 PM un jueves.

Funcionalidad: Un módulo en la configuración donde el dueño dibuja "zonas de precios" en un mini-calendario. Además, el sistema debe saber automáticamente en qué horario anochece para agregar el recargo de "Luz Artificial" al precio total.

Valor de producto: Maximiza la rentabilidad del club de forma automatizada.

F-Alertas de "No-Show" y Gestión de Señas Estricta
Las reservas fantasma (gente que reserva y no va) son la peor pesadilla financiera de un club.

Funcionalidad: Si una reserva online se hace sin pago completo, el sistema exige una seña. Si faltan 4 horas para el turno y la seña no está pagada (o el usuario no hizo el check-in digital), la cancha se libera automáticamente y pasa a color rojo en el panel.

Valor de producto: Protege el inventario del dueño. Al liberar la cancha automáticamente, se la puede ofrecer a los que están en la Lista de Espera del horario Prime Time.

---

# Posibles features y consideraciones

## A — Matchmaking / "Partidos Abiertos"

**Viabilidad:** Alta. La base ya existe: hay un modelo `OpenMatch` en el schema y una sección `/admin/open-matches` y `/(auth)/open-match`. La infraestructura de jugadores, reservas y notificaciones está lista.

**Impacto:** Muy alto. Es la funcionalidad con mayor potencial de retención de usuarios (sticky feature). Convierte la app de una herramienta de reservas en una red social de pádel. Los jugadores que usan matchmaking vuelven todos los días aunque no reserven.

**Esfuerzo:** Medio-alto. Requiere:
- UI de lobby en tiempo real (polling o WebSocket) — el polling ya existe en el grid, se puede reusar.
- Sistema de notificaciones push o email cuando alguien se anota.
- Manejo de estado: partido completo → reserva confirmada automáticamente.
- Moderación: reglas de nivel/categoría para evitar desbalances.

**Recomendación:** Prioridad 1. Ya hay código base. El MVP es: el dueño crea el partido abierto desde el detalle de una reserva existente (botón "Abrir partido"), los jugadores se anotan desde la app. No requiere sistema de pago adicional porque la reserva ya existe.

---

## B — Punto de Venta Integrado (Bar, Paletas y Pelotas)

**Viabilidad:** Media. Hay una sección `/admin/bar` ya existente. El modelo de datos necesita una entidad `SaleItem` (producto) y `Sale` (venta vinculada a una reserva o cancha).

**Impacto:** Alto en facturación. Un 20-30% de la facturación de un club viene de consumibles. Unificar el cobro reduce fricción y errores de caja.

**Esfuerzo:** Alto. Requiere:
- CRUD de productos (nombre, precio, stock).
- Pantalla de venta rápida desde el detalle de reserva (selector de productos + cantidad).
- Integración con MercadoPago (o registro de cobro manual) por el total combinado (cancha + consumibles).
- Historial de ventas y reporte diario.

**Recomendación:** Prioridad 2. El MVP es sin pago digital: el recepcionista registra los consumibles y el sistema calcula el total. El cobro sigue siendo efectivo/transferencia, pero el registro es digital. Versión avanzada integra MP.

---

## C — Billetera Virtual y Sistema de Créditos

**Viabilidad:** Media-baja sin integración de pagos robusta. Requiere MercadoPago (recargas) + modelo `Wallet` con `balance` y `transactions`.

**Impacto:** Muy alto en fidelización y flujo de caja. Asegura ingresos adelantados al club. Los bonos de recarga (cargás $50k, te acreditamos $60k) crean lock-in fuerte.

**Esfuerzo:** Muy alto. Requiere:
- Integración completa con MP (checkout, webhooks, reembolsos).
- Modelo de wallet con transacciones auditables.
- UI en la app del jugador (saldo, historial, recarga).
- Lógica de descuento automático en reservas y bar.
- Compliance fiscal (los créditos son dinero).

**Recomendación:** Prioridad 3. No atacar sin tener el POS integrado (B) primero. El orden correcto: A → B → C. La billetera sin POS no genera el loop de uso diario necesario para que sea rentable.

---

## D — Motor de Precios Dinámicos e Iluminación

**Viabilidad:** Alta. El campo `pricePerHour` ya existe en `CourtAvailability` por día. Extenderlo a franjas horarias dentro del día es un cambio de schema relativamente acotado.

**Impacto:** Medio-alto. Optimiza revenue automáticamente. El recargo de luz artificial (sunset API) es un diferenciador único.

**Esfuerzo:** Medio. Requiere:
- Cambio de schema: en lugar de un precio por día, una tabla de franjas horarias con precio (ej: 06-12 → precio bajo, 12-19 → precio medio, 19-00 → precio alto).
- Integración con API de sunset/sunrise por geolocalización del club (gratuita, ej: api.sunrisesunset.io).
- UI para que el dueño configure las franjas (similar al grid de horarios actual).
- Recálculo del precio en el wizard de nueva reserva.

**Recomendación:** Prioridad 2 (junto a B, son independientes). El MVP es solo por franja horaria manual (sin API de luz). La API de sunset se agrega como mejora posterior.

---

## F — Alertas de "No-Show" y Gestión de Señas

**Viabilidad:** Alta. El modelo de reservas ya tiene `paymentStatus`. Un cron job (ya existe `app/api/cron/`) puede revisar reservas próximas con seña impaga.

**Impacto:** Alto en reducción de pérdidas. Los no-shows en prime time son el principal dolor del dueño. Automatizar la liberación elimina el problema sin requerir atención manual.

**Esfuerzo:** Bajo-Medio. Requiere:
- Campo `depositAmount` o lógica de "seña mínima" por reserva online.
- Cron job (cada 30 min): si faltan < 4h y no hay pago → cancelar automáticamente y notificar al jugador.
- Push notification o email de aviso al jugador 4h antes ("tu turno se libera en X si no pagás la seña").
- UI para que el dueño configure el porcentaje de seña requerida.

**Recomendación:** Prioridad 1 junto a A. Es la feature con mejor ratio impacto/esfuerzo para el dueño. El cron de recordatorios ya existe, solo hay que agregarle la lógica de cancelación automática.

---

## Resumen de priorización

| Feature | Impacto | Esfuerzo | Prioridad |
|---------|---------|----------|-----------|
| A — Matchmaking | Muy alto | Medio | **1** — MVP ya tiene base |
| F — No-Show/Señas | Alto | Bajo | **1** — cron ya existe |
| D — Precios dinámicos | Medio-alto | Medio | **2** — independiente |
| B — POS Bar | Alto | Alto | **2** — /admin/bar existe |
| C — Billetera | Muy alto | Muy alto | **3** — requiere B primero |





cuando actualizas el nombre de una cancha no refresca la cache en reservas.
esta mal aplicado el scroll horizontal.
en el popover de cuando estas en editar cuando tocas cancelar te lleva al detalle, ese cancelar es cancelar edicion.


OJO HAY UN PARCHE ACA
      <CanchasClient
        clubId={id}
        clubName={club.name}
        courts={courts}
        createCourtAction={createCourt}
        updateCourtAction={updateCourt}
        toggleCourtAction={toggleCourt}
        updateAvailabilityAction={updateAvailabilityBatch}
      /> EN ../app/(superadmin)/superadmin/clubs/[id]/canchas/page.tsx:45:8