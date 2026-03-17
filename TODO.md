# PADELGO — Progreso de Implementacion

## Resumen ejecutivo

PadelGo: plataforma B2B2C de reserva de canchas de padel para Argentina.
Stack: Next.js 16.1.6 (App Router), TypeScript strict, Prisma v7, PostgreSQL, Vercel.

**Estado actual:** Sprint 8 completado. Flujo de invitados (guest flow), turnos fijos recurrentes, y migración de Sidebar a Navbar horizontal con menú desplegable.

---

## Sprint 1 — Setup & Base de datos ✅

- [x] `npm run dev` inicia sin errores en localhost:3000
- [x] `docker compose up -d` levanta PostgreSQL (puerto host 5433 → container 5432, ya que 5432 estaba ocupado en el host)
- [x] `npx prisma migrate dev` aplica migracion sin errores (14 modelos, 9 enums)
- [x] `npx prisma db seed` carga: 1 SUPERADMIN, 2 OWNERs, 2 clubs con canchas, CourtAvailability para los 7 dias, 12 achievements base, 5 PLAYERs, ~16 BarProducts por club
- [x] `.env.local` con todas las variables; `.env.example` sin secretos _(pendiente crear .env.example limpio, no bloquea)_
- [x] globals.css define CSS variables para Obsidian Dark (`:root`) y Obsidian Light (`[data-theme="light"]`) — usando Tailwind v4 con `@theme inline` (no tailwind.config.ts, eliminado en v4)
- [x] Fuentes Bebas Neue, DM Sans, DM Mono cargan via next/font/google
- [x] ThemeToggle alterna dark/light, persiste en localStorage via Zustand
- [x] ~~Sidebar visible en desktop (>=768px, 210px ancho), oculto en mobile~~ → **migrado a Navbar horizontal en Sprint 8**
- [x] BottomNav visible en mobile (<768px), oculto en desktop; orden: Inicio → Reservar → Ranking → Open → Perfil
- [x] types/index.ts exporta: UserPublic, ClubWithCourts, BookingWithDetails, TimeSlot, ActionResult, JwtSession, etc.
- [x] types/index.ts NO importa @prisma/client ni nada de Next.js (C-02)

**Notas de Prisma v7 (breaking changes resueltos):**

- Seed configurado en `prisma.config.ts` bajo `migrations.seed` (no en package.json)
- Cliente generado en `app/generated/prisma/client` (import path exacto con `/client`)
- Requiere driver adapter explícito: `new PrismaPg({ connectionString })` de `@prisma/adapter-pg`

---

## Sprint 2 — Autenticacion JWT ✅

- [x] lib/prisma.ts: singleton seguro para hot-reload con `globalForPrisma` pattern (completado en Sprint 1)
- [x] lib/auth.ts: funciones puras — `generateAccessToken`, `verifyAccessToken`, `verifyAccessTokenLenient`, `generateRefreshTokenRaw`, `hashToken`, `hashPassword`, `verifyPassword`, `generateAvatarColor`. **Zero imports de Next.js (C-01)**
- [x] lib/auth.edge.ts: subset Edge-safe — solo `verifyAccessTokenEdge` con jose (Web Crypto). Creado para resolver incompatibilidad de `crypto`/`bcryptjs` en Edge runtime
- [x] lib/cookies.ts: constantes — `COOKIE_ACCESS_TOKEN`, `COOKIE_REFRESH_TOKEN`, opciones httpOnly/Secure/SameSite. **Zero imports de Next.js (C-01)**
- [x] Access token: JWT firmado con HS256, expira en 15min
- [x] Refresh token: string opaco aleatorio (32 bytes hex), SHA-256 hasheado antes de almacenar en DB. Expira en 7 dias
- [x] actions/auth.ts: `getSession`, `requireAuth`, `requireRole`, `requireSuperAdmin` (con next/headers — boundary layer), `register`, `login`, `logout`
- [x] Registro: crea PLAYER con bcrypt cost 12, NO permite crear OWNER/STAFF/SUPERADMIN (C-09)
- [x] Login: valida activo/baneado, verifica password, crea RefreshToken en DB, setea cookies httpOnly, redirect por rol (SUPERADMIN→/superadmin, OWNER/STAFF→/admin, PLAYER→/)
- [x] Logout: revoca refresh token en DB, borra cookies, redirect a /login
- [x] proxy.ts: rutas publicas accesibles sin auth (/, /buscar, /club/\*, /login, /registro, etc.)
- [x] proxy.ts: rutas autenticadas requieren auth
- [x] proxy.ts: /admin/_ solo OWNER o STAFF; /superadmin/_ solo SUPERADMIN
- [x] proxy.ts: access token expirado + refresh presente → redirect a /api/auth/refresh?r=<path>
- [x] proxy.ts: usuario baneado (JWT claim `isBanned=true`) → redirect a /login?banned=true (C-07 — zero DB query)
- [x] proxy.ts: es el unico archivo de proxy (Next.js 16 no permite middleware.ts + proxy.ts juntos — middleware.ts eliminado)
- [x] api/auth/refresh/route.ts: rotacion de tokens (SHA-256 lookup → revoke old → create new → set cookies → redirect)
- [x] app/(auth)/layout.tsx: guard `requireAuth()`, layout con Navbar + BottomNav (migrado de Sidebar en Sprint 8)
- [x] app/(owner)/layout.tsx: guard `requireRole(["OWNER","STAFF"])`, layout con AdminSidebar
- [x] app/(superadmin)/layout.tsx: guard `requireSuperAdmin()`, layout con SuperadminSidebar
- [x] components/layout/AdminSidebar.tsx: OWNER ve 8 items, STAFF ve 4 items (C-11)
- [x] components/layout/SuperadminSidebar.tsx: 4 items, accent violeta (#a855f7)
- [x] app/login/page.tsx + LoginForm.tsx: useActionState con login Server Action, mensaje de ban si ?banned=true
- [x] app/registro/page.tsx + RegisterForm.tsx: useActionState con register Server Action, selector de zona de BsAs
- [x] `npx tsc --noEmit`: 0 errores
- [x] `next build`: compilacion exitosa, 7 paginas generadas

**Notas arquitectonicas Sprint 2:**

- `getSession`/`requireAuth`/`requireRole` viven en `actions/auth.ts` (NO en `lib/`) para preservar C-01 (lib/ framework-agnostic)
- Edge middleware solo puede importar `lib/auth.edge.ts` (jose puro) — no `lib/auth.ts` (usa Node.js crypto/bcrypt)
- Token rotation no puede ocurrir en proxy.ts (Edge + no Prisma) → redirect a `/api/auth/refresh` (Node.js runtime)

---

## Sprint 3 — Paginas publicas (Player App) ✅

- [x] Componentes UI: `Button` (4 variantes: accent/ghost/outline/surface, 3 tamaños), `Avatar` (color generativo por hash de nombre), `Tag`, `Badge` (6 variantes), `LevelBar` (1.0–10.0 con categorias), `Skeleton` + `SkeletonText` + `ClubCardSkeleton`
- [x] `components/ui/index.ts`: barrel exports de todos los componentes UI
- [x] `lib/availability.ts` (C-01 — zero Next.js imports): `calcAvailableSlots`, `calcBookingPrice`, `formatPrice`, `formatPricePerHour`, `timeToMinutes`, `minutesToTime`. Reglas C-12 aplicadas (durationOptions filtradas por closeTime, isTooSoon check, overlap check)
- [x] `components/layout/PublicLayout.tsx`: wrapper Server Component con Navbar + BottomNav sin requireAuth() (migrado de Sidebar en Sprint 8)
- [x] `components/club/ClubCard.tsx`: gradiente generativo RGB, StarRating, tags, precio desde, CTA a `/club/[id]`
- [x] `components/club/ClubGrid.tsx`: grid responsive 1→2→3 columnas, empty state
- [x] `components/club/MapView.tsx`: Client Component — mapa esquematico estatico de Buenos Aires (sin API key), pins con lat/lng proyectados en bounding box, tooltips hover
- [x] Landing `/`: datos reales de DB, Suspense con `ClubCardSkeleton` fallback, StatsSection (clubCount + totalBookings), FeaturedClubs (top 4 por rating), features strip
- [x] `app/buscar/SearchFilters.tsx`: Client Component — zona select, texto, toggles Techado/Premium, limpiar; usa `router.push` + `useCallback`
- [x] `app/buscar/page.tsx`: Server Component, `searchParams` como Promise (P6/Next.js 16). Filtros: zona, q (name insensitive), techado (courts.some covered), premium (tags.has). Layout split ClubGrid + MapView sticky xl+
- [x] `components/booking/CourtDiagram.tsx`: Client Component SVG — canchas como rectángulos en svgX/Y/W/H, stripes decorativos, seleccion interactiva con accent, lista de botones accesible
- [x] `components/booking/BookingWizard.tsx`: Client Component 3 pasos — (1) DatePicker 14 dias scroll horizontal, (2) CourtDiagram + slots por periodo Mañana/Tarde/Noche via `calcAvailableSlots`, (3) DurationSelector + precio en tiempo real + confirm. `useTransition` para submit async. **Sprint 8:** auth gate en Step 1 (invitado con nombre+email), `createGhostBookingAction` para no-autenticados, modal ACCOUNT_EXISTS
- [x] `actions/booking.ts`: `createBooking` Server Action — `requireAuth()`, validacion duracion (C-12), `$transaction` anti-double-booking C-05 (overlap: `bStart < newEnd && bEnd > newStart`), precio en centavos C-08, `source: ONLINE`, `revalidatePath`
- [x] `app/club/[id]/page.tsx`: Server Component, `params` como Promise (P6). Fetch club + courts + availabilities + bookings proximos 14 dias. Construye `CourtForWizard[]` con `availabilityByDay` y `BookingMap` (courtId → dateStr → ExistingBooking[]). Pasa `createBooking` como prop al wizard
- [x] `npx tsc --noEmit`: 0 errores
- [x] `next build`: compilacion exitosa, 7 rutas generadas

**Notas tecnicas Sprint 3:**

- `BookingWizard` recibe `createBookingAction: typeof createBooking` como prop — Server Action pasada explicitamente para cumplir con React/Next.js pattern (no import directo en Client Component desde Server Action en algunos casos)
- `MapView` no usa Mapbox ni API externa (riesgo del plan era el token) — implementado como mapa CSS/HTML con posicionamiento absoluto de pins por lat/lng dentro del bounding box de Buenos Aires. Cero dependencias externas
- Turbopack incompatible con Prisma v7 en dev: genera alias hasheado `@prisma/client-{hash}` que Node.js no puede resolver en runtime. Fix: `"dev": "next dev --webpack"` en package.json + `serverExternalPackages` en next.config.ts. Build de produccion (webpack) funciona sin cambios

---

## Sprint 4 — Paginas autenticadas del jugador ✅

- [x] `lib/level.ts`: Elo adaptado K=0.5, escala 4.0, rango 1.0–10.0. `calcNewLevel`, `getLevelCategory`, `formatLevel`, `levelProgress`, `calcRankingPoints`. C-01 cumplido (zero Next.js imports)
- [x] `lib/achievements.ts`: `evaluateAchievements` + `getNewUnlocks` para los 12 logros del seed. C-01 cumplido
- [x] `actions/openMatch.ts`: `createOpenMatch` (marca booking como abierto) + `joinOpenMatch` (nivel check, decrementa spots, cierra cuando spots=0). Pattern C-03 cumplido
- [x] `app/(auth)/confirmar/[id]/page.tsx`: detalles de reserva, badge de estado, precio, boton WhatsApp share con texto pre-formateado, CTA a /open-match y /historial
- [x] `components/profile/ProfileTabs.tsx`: Client Component, 3 tabs (overview/logros/racha). Overview: stats + ultimos logros. Logros: grid 12 achievements con barra de progreso. Racha: calendario 35 dias CSS grid + banner urgencia si +5 dias sin jugar
- [x] `app/(auth)/perfil/page.tsx`: Server Component, Promise.all para user + achievements + activity dates
- [x] `app/(auth)/historial/page.tsx`: URL tabs (partidos/estadisticas). Sugerencia proactiva (patron dia+hora en ultimas 20 reservas, minimo 2 ocurrencias). Stats: club favorito, horario pico, dia estrella, clubes visitados, gasto total
- [x] `app/(auth)/ranking/page.tsx`: URL tabs (zona/ciudad). Podium con orden 2°-1°-3°, columnas de alturas diferenciadas. Tabla con destacado usuario actual. Puntos: level*100 + played*10 + wins*5 + streak*2
- [x] `app/(auth)/open-match/page.tsx` + `JoinButton.tsx` + `PublishForm.tsx`: Feed de turnos abiertos con nivel de compatibilidad. JoinButton Client Component con useTransition. PublishForm expandible: seleccion de reserva, nivel requerido, cupos 1–3
- [x] `npx tsc --noEmit`: 0 errores (fix: `avatarColor` → `color` en ProfileTabs.tsx)
- [x] `next build`: 12 rutas compiladas exitosamente

**Nota:** `/match` (Quick Match wizard) y la post-match transaction (nivel+racha+achievements en 1 TX) quedan diferidos a Sprint 7 o post-MVP. El feed de open-match cubre el caso de uso principal de encontrar compañeros.

---

## Sprint 5 — Dashboard Owner/Staff + Bar ✅

- [x] `lib/analytics.ts`: `calcularIngresos`, `calcularOcupacion`, `calcularHorariosPico`, `calcularIngresosSemanales`, helpers de periodo. C-01 cumplido (zero Next.js imports)
- [x] `actions/owner/bookings.ts`: `createManualBooking` (C-05 anti-double-booking en `$transaction`, source MANUAL_OWNER o BLOCK), `cancelBooking`, `confirmBooking`. C-10 cumplido (STAFF solo su club)
- [x] `actions/owner/bar.ts`: `createBarSale` (TX unica: BarSale + items + stock.decrement, C-08 unitPrice inmutable), `createBarProduct` (OWNER only), `updateBarProduct`, `toggleBarProduct`
- [x] `actions/owner/courts.ts`: `createCourt`, `updateCourt`, `toggleCourt` — OWNER only
- [x] `actions/owner/availability.ts`: `updateAvailability` (findFirst + update/create, sin @@unique compuesto)
- [x] `actions/owner/staff.ts`: `inviteStaff` (SHA-256 token, 48h expiry, invitedBy), `removeStaff` (revoca refresh tokens), `acceptStaffInvitation` (TX: upsert user + marcar invitation)
- [x] `actions/owner/config.ts`: `updateClubConfig` — OWNER only
- [x] `/admin`: dashboard del dia — 4 KPI cards, estado de canchas ahora mismo, proximas reservas, lista del dia
- [x] `components/booking/BookingGrid.tsx`: grilla de reservas con ResizeObserver (columnas dinamicas), linea hora actual (auto-update 60s), bloques con colores por source, modal de detalle con cancel/confirm
- [x] `components/booking/ManualBookingWizard.tsx`: wizard 4 pasos — cancha → fecha+hora → cliente/tipo → confirmacion
- [x] `/admin/reservas`: navegacion por fecha (scroll horizontal), leyenda, ReservasShell como client shell para router.refresh post-mutacion
- [x] `/admin/reservas/nueva`: construye courtSlotsByDate con now=medianoche (sin restriccion de tiempo anticipado para admin)
- [x] `/admin/bar`: BarModule con 3 tabs — Caja (POS con ticket, selector metodo pago), Inventario (CRUD productos, STAFF solo stock), Historial (ventas del dia con total acumulado)
- [x] `/admin/canchas` + `CanchasClient`: crear/editar/activar canchas. C-14 cumplido (clubId como prop)
- [x] `/admin/horarios` + `HorariosClient`: grilla cancha × dia, toggles activo, selectores hora, precio por hora en pesos → centavos
- [x] `/admin/equipo` + `EquipoClient`: lista staff activo con avatar, invitaciones pendientes/vencidas, form invitacion por email — OWNER only
- [x] `/admin/analytics`: 4 KPIs, chart 7 dias apilado (reservas + bar), horarios pico horizontal, ranking canchas por revenue, breakdown por source
- [x] `/admin/config` + `ConfigClient`: nombre, tagline, descripcion, direccion, telefono, email, tags chips, amenities chips — OWNER only
- [x] `/invitacion/[token]`: pagina publica — valida token (invalido / ya usado / expirado / valido), muestra club, `InvitacionForm` para crear cuenta staff
- [x] `proxy.ts`: `/invitacion/` ya en PUBLIC_PREFIX (sin cambios necesarios)
- [x] `npx tsc --noEmit`: 0 errores
- [x] `next build`: compilacion exitosa, 21 rutas generadas

**Notas tecnicas Sprint 5:**

- `CourtAvailability` no tiene `@@unique([courtId, dayOfWeek])` ni campo `clubId` — `updateAvailability` usa `findFirst + update/create` y filtra por `court: { clubId }` en queries
- `Court` requiere `svgX/Y/W/H` obligatorios — `createCourt` usa defaults `0, 0, 100, 180`
- Invitation requiere `invitedBy: String` — `inviteStaff` captura `session.userId` de `requireRole`
- User model usa campo `password` (no `passwordHash`) — corregido en `acceptStaffInvitation`
- `BookingGrid` usa `ResizeObserver` para calcular `colWidth = floor((containerWidth - 52px) / nCanchas)` en tiempo real
- Admin bypasea restriccion de tiempo anticipado de `calcAvailableSlots` usando `now = midnight` del dia seleccionado

---

## Sprint 6 — Panel Superadmin ✅

- [x] `lib/audit.ts`: `createAuditLog(tx, input)` — siempre dentro de `$transaction` (C-06). Cast `Prisma.InputJsonValue` para campo Json.
- [x] `actions/superadmin/clubs.ts`: `createClub` (onboarding 2 pasos + invitación owner si es cuenta nueva), `toggleClubActive`, `updateClub`. Todos con audit log en misma TX.
- [x] `actions/superadmin/users.ts`: `banUser`, `unbanUser`, `deactivateUser`, `activateUser`, `cancelUserBooking`, `resetUserPassword`. Todos revocan refresh tokens + log en TX.
- [x] `actions/superadmin/audit.ts`: `getAuditLogs` con filtros por `action` (cast `as AuditAction`) y `entityType`.
- [x] `components/layout/SuperadminBanner.tsx`: banner sticky violeta con nombre del club, zona, cantidad de canchas, estado activo/inactivo y botón toggle (optimistic UI con `useTransition`).
- [x] `/superadmin`: dashboard global — 4 KPI cards (ingresos hoy, reservas hoy, clubes activos, usuarios nuevos 7d), chart semanal, feed de actividad reciente (últimas 10 acciones), grid de todos los clubes.
- [x] `/superadmin/clubs`: lista filtrable (búsqueda + todos/activos/inactivos), stats por club (canchas, reservas hoy), link a modo soporte.
- [x] `/superadmin/clubs` — `CreateClubForm.tsx`: formulario onboarding 2 pasos (datos del club → asignar owner). Si el email del owner no existe, crea cuenta inactiva + invitación.
- [x] `/superadmin/clubs/[id]`: modo soporte — `SuperadminBanner` + KPIs del día + sub-tabs (Reservas / Canchas / Horarios / Equipo / Analytics) + info del club y lista de canchas.
- [x] `/superadmin/clubs/[id]/reservas`: grilla de reservas reutilizando `ReservasShell` + `cancelBooking`/`confirmBooking` del owner.
- [x] `/superadmin/clubs/[id]/canchas`: gestión de canchas reutilizando `CanchasClient`.
- [x] `/superadmin/clubs/[id]/horarios`: horarios reutilizando `HorariosClient`.
- [x] `/superadmin/clubs/[id]/equipo`: staff reutilizando `EquipoClient`.
- [x] `/superadmin/clubs/[id]/analytics`: analytics con chart 7 días, horarios pico y ranking de canchas.
- [x] `/superadmin/users`: listado con búsqueda por nombre/email/zona, filtros (todos / players / baneados / inactivos), link a perfil de usuario.
- [x] `/superadmin/users/[id]`: perfil completo (stats, nivel, historial de reservas) + panel de acciones (`UserActions.tsx` Client Component): resetear contraseña, activar/desactivar, banear con motivo, desbanear, cancelar reservas individuales.
- [x] `/superadmin/audit`: log inmutable paginado (50 por página). Filtros por tipo de entidad y por acción. Muestra actor, acción con badge de color, entidad y metadata resumida. Paginación con links.
- [x] `npx tsc --noEmit`: 0 errores

**Notas técnicas Sprint 6:**

- `AuditAction` es un enum Prisma — en queries `where` debe castearse explícitamente: `action as AuditAction`. El spread `{ action: string }` no es assignable a `AuditLogWhereInput`.
- `Prisma.InputJsonValue` requerido para el campo `metadata Json?` — `Record<string, unknown>` no es assignable directamente.
- Todas las sub-páginas de `/superadmin/clubs/[id]/` reutilizan los mismos Client Components del owner (`CanchasClient`, `HorariosClient`, `EquipoClient`, `ReservasShell`) pasando el `clubId` desde los `params` de la URL. C-14 cumplido.
- `SuperadminBanner` es sticky al top de cada sub-página del club, posicionado sobre el `<main>` del layout (no reemplaza el sidebar).
- `createClub` asigna `isActive: false` al club nuevo — el owner debe completar la configuración antes de activarlo.
- `resetUserPassword` reutiliza el modelo `Invitation` para almacenar el token de reset (misma mecánica que invitación de staff).

---

## Sprint 7 — Pagos, Notificaciones & Polish ✅

- [x] `lib/email.ts`: wrapper Resend — C-01 (zero Next.js imports). Funciones: `sendBookingConfirmation`, `sendBookingCancellation`, `sendBookingReminder`, `sendOwnerWelcome`, `sendStaffInvitation`, `sendPasswordReset`. Templates HTML inline con diseño oscuro PadelGo.
- [x] `actions/payment.ts`: `createMercadoPagoPreference(bookingId)` — llama a `POST /checkout/preferences`, almacena `preferenceId` en `booking.paymentId`, retorna `{ initPoint, preferenceId }`. Solo para bookings `PENDING` del usuario autenticado.
- [x] `app/api/webhooks/mp/route.ts`: POST handler con verificación de firma HMAC-SHA256 (`ts=..,v1=..` header). Maneja `payment.created` / `payment.updated`: aprobado → `CONFIRMED + PAID + email`, refund/cancelled → `CANCELLED + REFUNDED + email`. Return 200 siempre para evitar reintentos de MP en errores de config.
- [x] `actions/owner/staff.ts`: wiring de `sendStaffInvitation` post-invitación (lookup club+inviter name, fire-and-forget con try/catch).
- [x] `actions/superadmin/clubs.ts`: wiring de `sendOwnerWelcome` cuando se crea owner nuevo (captura rawToken fuera del TX con variable mutable).
- [x] `actions/superadmin/users.ts`: wiring de `sendPasswordReset` post-reset (retorna `userEmail` y `userName` desde TX para usar en email).
- [x] `actions/reviews.ts`: `createReview(clubId, rating, comment?)` — C-13 (solo con booking COMPLETED), upsert vía `@@unique([userId, clubId])`, recalcula `club.rating` y `club.reviewCount` en la misma TX. `getUserClubReview(clubId)` para pre-popular form.
- [x] `components/reviews/ReviewForm.tsx`: Client Component — 5 estrellas interactivas (hover + click), label descriptivo (Muy malo → Excelente), textarea comentario, submit con `useTransition`. Estado "ya enviado" con reseña resumida.
- [x] `app/(auth)/confirmar/[id]/page.tsx`: muestra `ReviewForm` al final de la página cuando `booking.status === 'COMPLETED'`. Lookup de reseña existente para pre-popular si ya reseñó.
- [x] `app/club/[id]/page.tsx`: ISR con `unstable_cache` — `getClubData` cached con tag `club-${id}` y `revalidate: 3600`. `generateMetadata` dinámica con title, description, OpenGraph y Twitter. `APP_URL` desde env.
- [x] `actions/booking.ts`: `revalidateTag('club-${clubId}', 'default')` al crear booking (junto con revalidatePath).
- [x] `app/sitemap.ts`: sitemap dinámico — todos los clubes activos + rutas estáticas (/, /buscar, /open-match).
- [x] `app/robots.ts`: robots.txt — disallow /admin, /superadmin, /historial, /perfil, /api/, sitemap incluido.
- [x] `app/layout.tsx`: metadata global mejorada — `metadataBase`, `title.template`, keywords, OpenGraph, Twitter card, robots indexing.
- [x] `npx tsc --noEmit`: 0 errores

**Notas técnicas Sprint 7:**

- `revalidateTag` en Next.js 16 requiere segundo argumento `profile: string | CacheLifeConfig` (breaking change vs v14/v15). Solución: pasar `'default'` como perfil en todos los llamados.
- `unstable_cache` soporta tags e invalida con `revalidateTag(tag, profile)`. La UI refleja nuevas reservas en max 1h (TTL fallback) o inmediatamente si es vía webhook o createBooking.
- MP webhook: verificación de firma usa `x-signature: ts=<ts>,v1=<hmac>` con manifest `id:<dataId>;request-id:<reqId>;ts:<ts>;`. Comparación en tiempo constante para prevenir timing attacks.
- `sendOwnerWelcome` captura el `rawToken` fuera del TX usando una variable mutable (`let ownerRawToken = null`) que se asigna dentro del callback del $transaction — patrón de cierre seguro en Prisma.
- Emails son fire-and-forget (`try/catch` externo al action principal) — un fallo de email no falla la acción ni el webhook.
- ReviewForm usa `initialRating` para distinguir "crear nueva" vs "actualizar existente" en el label del botón submit.

---

## Sprint 8 — Guest Flow, Turnos Fijos & Navbar ✅

### ITEM 3 — Flujo de reserva para invitados (Guest Flow)

- [x] `prisma/schema.prisma`: campo `isGhost Boolean @default(false)` en `User` (ya existía del Sprint anterior; confirmado)
- [x] `actions/booking.ts`: `createGhostBooking` Server Action — crea `User` ghost (isGhost=true, sin password) o reutiliza existente, luego `createBooking` interno. Retorna `ACCOUNT_EXISTS` si el email ya pertenece a cuenta real
- [x] `components/booking/BookingWizard.tsx`: reescrito con auth gate en Step 1:
  - Si `userId === null && !guestReady`: muestra botones "Iniciar sesión" / "Registrarse" + form invitado (nombre + email con validación regex)
  - Al submit del form invitado: `setGuestReady(true)`, desbloquea Step 2
  - Banner "Reservando como invitado · Cambiar" persistente en steps 2 y 3
  - `handleConfirm` ramifica: `userId ? createBookingAction() : createGhostBookingAction()`
  - Modal `ACCOUNT_EXISTS`: advertencia amber con link "Iniciar sesión →"
  - Step 3 muestra fila extra "Invitado | {guestName}" en resumen
- [x] `app/club/[id]/page.tsx`: añade `getSession()` en `Promise.all`, pasa `userId={session?.userId ?? null}` y `createGhostBookingAction={createGhostBooking}` a `BookingWizard`
- [x] `npx tsc --noEmit`: 0 errores

### ITEM 5 — Turnos Fijos (Reservas semanales recurrentes)

- [x] `prisma/schema.prisma`: nuevo modelo `RecurringBooking` (id, clubId, courtId, playerName, playerPhone, dayOfWeek, startTime, durationMinutes, pricePerSession, startDate, isActive, createdBy, createdAt, updatedAt, generatedBookings). FK `recurringBookingId` en `Booking` (onDelete: SetNull). Índices en `[clubId, isActive]` y `[courtId, dayOfWeek]`
- [x] `npx prisma migrate dev --name add_recurring_bookings`: migración aplicada
- [x] `npx prisma generate`: cliente regenerado con nuevos tipos
- [x] `lib/recurring.ts` (C-01): `RECURRING_WEEKS_AHEAD = 8`, `getNextOccurrences(dayOfWeek, from, count)` (UTC-safe), `getOccurrencesInRange(dayOfWeek, from, to)`
- [x] `actions/owner/recurring.ts`: `createRecurringBooking` (TX: crea RecurringBooking + 8 BLOCK bookings saltando conflictos), `cancelRecurringBooking` (TX: isActive=false + cancela futuros CONFIRMED/PENDING), `listRecurringBookings` (incluye court.name + generatedBookings próximos)
- [x] `app/(owner)/admin/turnos-fijos/page.tsx`: Server Component — resuelve clubId por rol (OWNER: ownedClubs[0], STAFF: staffClubId), fetch courts + recurring en paralelo
- [x] `app/(owner)/admin/turnos-fijos/TurnosFijosClient.tsx`: Client Component — form crear (cancha, nombre/teléfono jugador, día semana, horario, duración 60/90/120, precio), lista con badge de día + botón cancelar, toast optimista, setList para cancel optimistic
- [x] `components/layout/AdminSidebar.tsx`: añadido item "Turnos fijos" en `OWNER_ONLY_ITEMS` (entre Canchas y Equipo)
- [x] `npx tsc --noEmit`: 0 errores

### Navbar Migration — Player App

- [x] `components/layout/Navbar.tsx`: async Server Component — lee sesión con `getSession()`, fetch `{ name, avatarColor, zone, level }` del usuario autenticado, renderiza `<NavbarClient>`
- [x] `components/layout/NavbarClient.tsx`: `'use client'` — navbar sticky h-16 con backdrop-filter blur(24px) y `color-mix(in oklab, var(--bg) 85%, transparent)`:
  - Logo `PADELGO` font-display text-[26px] tracking-[3px]
  - Links desktop (hidden md:flex): autenticado = Inicio / Reservar / Ranking / Open Match; invitado = Inicio / Reservar
  - Active link: `text-accent bg-tag font-bold`; inactivo: `text-muted hover:text-text hover:bg-card`
  - Autenticado: user chip (first name + `Avatar xs` + chevron) → dropdown (mini profile card + Mi perfil + Historial + ThemeToggle + Cerrar sesión). Cierre por click afuera via `useRef + document.addEventListener`
  - Invitado: `ThemeToggle` + botones "Iniciar sesión" / "Registrarse"
- [x] `components/layout/PublicLayout.tsx`: usa `<Navbar>` en lugar de `<Sidebar>`, `flex-col`, sin `md:ml-[210px]`
- [x] `app/(auth)/layout.tsx`: ídem PublicLayout
- [x] `components/layout/BottomNav.tsx`: reordenado a Inicio → Reservar → **Ranking → Open** → Perfil
- [x] `app/buscar/page.tsx`: añade `max-w-[1360px] mx-auto` al contenedor, sticky map ajustado a `top-[80px]` (64px navbar + 16px gap)
- [x] `app/(auth)/historial|ranking|open-match/page.tsx`: añade `max-w-[1360px] mx-auto` al contenedor raíz
- [x] `app/globals.css`: añade `@keyframes fadeIn` (opacity 0→1, translateY -6px→0) y clase `.animate-fadeIn`
- [x] `npx tsc --noEmit`: 0 errores

**Notas técnicas Sprint 8:**

- `createGhostBooking` distingue tres casos en el email: (1) no existe → crea User ghost, (2) existe ghost → reutiliza (actualiza nombre), (3) existe real → retorna `{ success: false, error: 'ACCOUNT_EXISTS' }`
- `RecurringBooking` usa "materialise on create": 8 BLOCK bookings generados en la misma TX de creación. Sin cron jobs. Conflictos se omiten silenciosamente (`conflict: continue`)
- Navbar usa `color-mix(in oklab, var(--bg) 85%, transparent)` como inline style — las variables CSS del tema están disponibles en runtime por el `@theme inline` de Tailwind v4, pero `color-mix` con `var()` requiere inline style (no clase Tailwind) para evaluar la variable correctamente
- Después de `prisma migrate dev`, siempre correr `prisma generate` para regenerar el cliente TypeScript — de lo contrario los nuevos modelos/campos no existen en los tipos

---

## Contratos arquitectonicos (resumen)

| Codigo | Descripcion breve                                                                    |
| ------ | ------------------------------------------------------------------------------------ |
| C-01   | `lib/` es framework-agnostic — zero imports de Next.js                               |
| C-02   | `types/index.ts` sin Prisma Client — TypeScript puro                                 |
| C-03   | Server Actions son frontera delgada: validate → lib → TX → revalidate → ActionResult |
| C-04   | `ActionResult<T>` como unico contrato de retorno                                     |
| C-05   | Anti-double-booking via `$transaction` atomica                                       |
| C-06   | AuditLog siempre en la misma TX (Superadmin)                                         |
| C-07   | Ban check en proxy.ts via JWT claim (zero DB query)                                  |
| C-08   | Precios en centavos Int, inmutables en punto de venta                                |
| C-09   | SUPERADMIN solo desde seed — register() siempre crea PLAYER                          |
| C-10   | STAFF solo accede a su club (staffClubId)                                            |
| C-11   | STAFF ve 4 items sidebar; OWNER ve 8 items                                           |
| C-12   | Duraciones validas: 60, 90 (default), 120 min                                        |
| C-13   | Reviews: @@unique([userId, clubId]), solo con booking COMPLETED                      |
| C-14   | Componentes /admin/\* parametrizados por clubId (para reutilizar en superadmin)      |
