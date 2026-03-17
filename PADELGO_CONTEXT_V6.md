# PADELGO — CONTEXTO MAESTRO DEL PROYECTO
> Documento de referencia para iterar el producto con Claude en VS Code / Claude Code.
> Última actualización: v3.4 — Febrero 2026

---

## 1. VISIÓN DEL PRODUCTO

**PadelGo** es una plataforma B2B2C de reserva de canchas de pádel para el mercado argentino.

- **Supply side (B2B):** Clubes/dueños que publican sus canchas, gestionan disponibilidad y reciben reservas
- **Demand side (B2C):** Jugadores que buscan canchas, reservan turnos y forman parte de una comunidad
- **Diferenciador clave:** No es solo una utilidad de reserva. Es el lugar donde vive la vida de pádel del jugador. Inspirado en la experiencia de comunidad de Strava, Hevy, Gentler Streak y Komoot

**Competidor de referencia:** Playtomic. PadelGo busca superar sus fricciones principales:
- Flujo de reserva con demasiados pasos
- Sin sentido de comunidad ni identidad de usuario
- Búsqueda lenta e imprecisa
- No resuelve el problema de conseguir compañeros para jugar

---

## 2. STACK TECNOLÓGICO

```
Framework:     Next.js 16.1.6 (App Router) con TypeScript strict
Rendering:     Server Components por defecto — Client Components solo donde haya interactividad
Backend:       Server Actions (no API routes separadas salvo casos específicos)
Estilos:       Tailwind CSS v3
State:         Server state via Server Components + React cache
               Client state liviano: useState / useReducer
               State global de UI (tema): Zustand — solo cuando sea necesario
Base de datos: PostgreSQL en Docker (dev) — managed en producción
ORM:           Prisma v7 (schema first, migraciones versionadas)
Auth:          JWT propio — access_token (15min) + refresh_token (7 días) en cookies httpOnly
Pagos:         Mercado Pago (Argentina) — Internacional pendiente para fases futuras
Mapas:         Mapbox GL JS o Leaflet (Client Component)
Deploy:        Vercel
```

### 2.1 Principios de arquitectura Next.js

```
REGLA DE ORO: Todo lo que puede ser Server Component, lo es.

- Fetching de datos    → Server Components (no useEffect + fetch en cliente)
- Mutaciones           → Server Actions (no endpoints REST propios)
- Formularios          → action={serverAction} con useActionState para feedback
- Interactividad real  → 'use client' mínimo e intencional
- Layouts de nav       → Server Components con Suspense boundaries
```

### 2.2 Estrategia de autenticación JWT con cookies

```typescript
// access_token:  JWT firmado, expira en 15 min, cookie httpOnly
// refresh_token: JWT firmado, expira en 7 días, cookie httpOnly, ruta /api/auth/refresh
//
// Flujo:
// 1. Login → Server Action genera ambos tokens → setea cookies httpOnly
// 2. Cada request → proxy.ts verifica access_token
// 3. access_token expirado + refresh válido → rota ambos tokens → continúa
// 4. refresh_token expirado → redirect /login
// 5. Logout → Server Action borra ambas cookies

// Helpers (lib/auth.ts)
getSession()              // Lee y verifica access_token — usar en Server Components
requireAuth()             // getSession() + redirect('/login') si no autenticado
requireRole(role)         // requireAuth() + verifica rol — para rutas owner/staff
requireSuperAdmin()       // requireAuth() + verifica SUPERADMIN — para /superadmin/*
```

### 2.3 Preparación para app mobile (futuro — no implementar ahora)

La app mobile (React Native + Expo) es una decisión de futuro, **después de validar el producto web**. Sin embargo, hay tres criterios de código a respetar desde el Sprint 1 para que la migración a monorepo no requiera refactorizar:

**Regla 1 — `lib/` no importa nada de Next.js**
Los archivos en `lib/` deben ser agnósticos del framework. Nunca deben importar `next/headers`, `next/navigation`, `cookies`, `redirect` ni ninguna API de Next.js. Esas dependencias solo van en Server Actions (`actions/`) y layouts/pages.

```typescript
// ✅ CORRECTO — lib/level.ts es portable
export function calculateLevel(current: number, won: boolean, opponentLevel: number): number { ... }

// ❌ INCORRECTO — lib/level.ts no debe hacer esto
import { cookies } from 'next/headers'   // rompe la portabilidad
```

**Regla 2 — `types/index.ts` sin dependencias de framework**
Los tipos TypeScript deben ser puro TypeScript. Sin imports de Prisma Client directo, sin imports de Next.js. Usar los tipos inferidos de Prisma solo en los archivos de actions/lib, no en el archivo de tipos compartidos.

```typescript
// ✅ CORRECTO — tipo portable
export type UserPublic = { id: string; name: string; level: number; ... }

// ❌ INCORRECTO — acopla los tipos a Prisma Client
import type { User } from '@prisma/client'   // no en types/index.ts
```

**Regla 3 — Server Actions son la frontera, no la lógica**
Las Server Actions en `actions/` deben ser delgadas: validan input, llaman a funciones de `lib/`, persisten con Prisma, y retornan `ActionResult<T>`. La lógica real vive en `lib/`. Cuando llegue la mobile, las Server Actions se convierten en API routes casi mecánicamente porque la lógica ya está separada.

```typescript
// ✅ CORRECTO — action delgada, lógica en lib/
export async function createBooking(data: CreateBookingInput): Promise<ActionResult<Booking>> {
  const session = await requireAuth()
  const slots   = await getAvailableSlots(data.courtId, data.date)   // lib/availability.ts
  const booking = await prisma.$transaction(...)
  return { success: true, data: booking }
}
```

**Cuando llegue el momento:** convertir a monorepo Turborepo con `packages/types` y `packages/core` (la lógica de `lib/`), agregar `apps/mobile` con Expo. La conversión de Server Actions a API routes es el único trabajo real de migración.

### 2.4 Docker en desarrollo

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: padelgo
      POSTGRES_USER: padelgo
      POSTGRES_PASSWORD: padelgo_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

```bash
docker compose up -d            # levantar DB
npx prisma migrate dev          # aplicar migraciones
npx prisma studio               # explorar DB en browser
npx prisma db seed              # cargar seed data
```

---

## 3. ARQUITECTURA DE LA APLICACIÓN

### 3.1 Estructura de rutas (App Router)

```
app/
├── (public)/                           # Sin auth requerida
│   ├── page.tsx                        → /  Landing
│   ├── buscar/page.tsx                 → /buscar  Buscador de clubes
│   └── club/[id]/page.tsx              → /club/:id  Detalle + reserva
│
├── (auth)/                             # requireAuth en layout
│   ├── layout.tsx
│   ├── confirmar/page.tsx              → /confirmar
│   ├── match/page.tsx                  → /match  Partido Rápido
│   ├── open-match/page.tsx             → /open-match
│   ├── ranking/page.tsx                → /ranking
│   ├── historial/page.tsx              → /historial
│   └── perfil/page.tsx                 → /perfil
│
├── (owner)/                            # requireRole(OWNER | STAFF) en layout
│   ├── layout.tsx
│   └── admin/
│       ├── page.tsx                    → /admin  Dashboard (resumen del día)
│       ├── reservas/
│       │   ├── page.tsx                → /admin/reservas  Grilla del día
│       │   └── nueva/page.tsx          → /admin/reservas/nueva  Reserva manual
│       ├── bar/
│       │   ├── page.tsx                → /admin/bar  Caja (sub-tab default)
│       │   │                              sub-tabs client-side: caja | inventario | historial
│       ├── canchas/page.tsx            → /admin/canchas  (solo OWNER)
│       ├── horarios/page.tsx           → /admin/horarios
│       ├── equipo/page.tsx             → /admin/equipo  (solo OWNER)
│       ├── analytics/page.tsx          → /admin/analytics  (solo OWNER)
│       └── config/page.tsx             → /admin/config  (solo OWNER)
│
├── (superadmin)/                       # requireRole(SUPERADMIN) en layout
│   ├── layout.tsx
│   └── superadmin/
│       ├── page.tsx                    → /superadmin  Dashboard global + métricas
│       ├── clubs/
│       │   ├── page.tsx                → /superadmin/clubs  Lista todos los clubes
│       │   ├── nuevo/page.tsx          → /superadmin/clubs/nuevo  Onboarding de club
│       │   └── [id]/
│       │       ├── page.tsx            → /superadmin/clubs/:id  Vista del club con banner
│       │       ├── canchas/page.tsx    → gestión de canchas del club
│       │       ├── reservas/page.tsx   → todas las reservas del club
│       │       ├── horarios/page.tsx   → config de disponibilidad
│       │       ├── equipo/page.tsx     → Staff del club + invitar
│       │       └── analytics/page.tsx → métricas del club
│       ├── users/
│       │   ├── page.tsx                → /superadmin/users  Búsqueda de usuarios
│       │   └── [id]/page.tsx           → /superadmin/users/:id  Perfil + acciones
│       └── audit/
│           └── page.tsx                → /superadmin/audit  Log de actividad
│
├── login/page.tsx
├── registro/page.tsx
├── invitacion/[token]/page.tsx         → /invitacion/:token  Activación de Staff
├── api/
│   ├── auth/refresh/route.ts           # Único route handler de auth
│   └── webhooks/mp/route.ts            # Webhook Mercado Pago (Sprint 6)
│
├── layout.tsx                          # Root layout — fuentes, providers
├── globals.css                         # CSS variables de temas + Tailwind base
├── not-found.tsx
└── error.tsx

proxy.ts                                # En raíz del proyecto — verifica JWT
```

### 3.2 Navegación híbrida

- **Desktop (>768px):** Sidebar izquierdo fijo (220px), contenido a la derecha
- **Mobile (<768px):** Bottom navigation bar con 5–7 ítems, sidebar oculto
- El layout de nav es Server Component; solo `usePathname()` requiere `'use client'` mínimo

---

## 4. DESIGN SYSTEM

### 4.1 Temas de color — 2 variantes Obsidian

Implementados con CSS variables en `:root` (dark, default) y `[data-theme="light"]`.
Tailwind los consume mapeando las variables en `tailwind.config.ts`.

**Variables de cada tema:**
```css
--color-bg              /* fondo principal */
--color-surface         /* fondo de paneles/sidebar */
--color-card            /* fondo de cards */
--color-card-hover      /* card en hover */
--color-border          /* bordes estándar */
--color-border-hover    /* borde en hover */
--color-accent          /* color principal de acción */
--color-accent-dark     /* accent en hover */
--color-accent-text     /* texto sobre accent */
--color-accent-glow     /* glow/sombra del accent */
--color-text            /* texto principal */
--color-muted           /* texto secundario */
--color-sub             /* texto terciario / placeholders */
--color-tag             /* fondo de chips/tags */
--color-tag-text        /* texto de chips/tags */
--color-tag-border      /* borde de chips/tags */
```

**Los 2 temas activos:**

| Nombre         | Base      | Accent    | Descripción                       |
|----------------|-----------|-----------|-----------------------------------|
| Obsidian Dark  | `#080808` | `#d4f000` | Negro profundo + lima. Default    |
| Obsidian Light | `#f5f5f0` | `#8aa000` | Claro cálido + lima oscura        |

El accent lima es la identidad visual del producto en ambos temas.
En el tema claro se oscurece a `#8aa000` para mantener contraste sobre fondo claro.

### 4.2 Tipografía — Bebas Neue + DM Sans (única combinación)

```css
--font-display: 'Bebas Neue', cursive;    /* títulos, números grandes, logo */
--font-body:    'DM Sans', sans-serif;    /* todo el resto */
--font-mono:    'DM Mono', monospace;     /* precios, tiempos */
```

```typescript
// app/layout.tsx — carga via next/font/google
import { DM_Sans, DM_Mono, Bebas_Neue } from 'next/font/google'
```

**Uso en Tailwind:**
```html
<h1 class="font-display text-7xl tracking-widest uppercase">PADELGO</h1>
<p class="font-body text-sm text-muted">Texto secundario</p>
<span class="font-mono text-accent">$3.500</span>
```

### 4.3 Tokens Tailwind

```typescript
// tailwind.config.ts
extend: {
  colors: {
    bg:             'var(--color-bg)',
    surface:        'var(--color-surface)',
    card:           'var(--color-card)',
    border:         'var(--color-border)',
    accent:         'var(--color-accent)',
    'accent-dark':  'var(--color-accent-dark)',
    'accent-text':  'var(--color-accent-text)',
    text:           'var(--color-text)',
    muted:          'var(--color-muted)',
    sub:            'var(--color-sub)',
    tag:            'var(--color-tag)',
    'tag-text':     'var(--color-tag-text)',
  },
  fontFamily: {
    display: ['var(--font-display)'],
    body:    ['var(--font-body)'],
    mono:    ['var(--font-mono)'],
  },
}
// Uso: bg-bg, text-accent, border-border, bg-card, font-display, etc.
```

### 4.4 Componentes base (diseñados en prototipo v3.0, a migrar a Next.js)

| Componente         | Tipo   | Descripción                                          |
|--------------------|--------|------------------------------------------------------|
| `Button`           | Client | 4 variantes: accent, ghost, outline, surface         |
| `Avatar`           | Client | Generativo: iniciales + color hash único por usuario |
| `Tag`              | Server | Chips de categoría/filtro                            |
| `Badge`            | Server | Estado disponible/ocupado/destacado                  |
| `Input`            | Client | Input con label, error state, icono                  |
| `Skeleton`         | Server | Loading placeholder                                  |
| `ClubCard`         | Server | Card con gradiente generativo único por club         |
| `DatePicker`       | Client | Scroll horizontal de fechas (14 días)                |
| `TimePicker`       | Client | Grid de horarios con estado ocupado/libre            |
| `DurationSelector` | Client | Selector 60 / **90 (default)** / 120 min             |
| `CourtDiagram`     | Client | SVG top-down de canchas seleccionables               |
| `BookingWizard`    | Client | Wizard 3 pasos: fecha → horario+duración → cancha    |
| `MapView`          | Client | Mapa con pins de precio (Mapbox/Leaflet)             |
| `LevelBar`         | Server | Barra de progreso de nivel (1.0–10.0)                |
| `StreakCalendar`   | Server | Grilla 35 días con días jugados marcados             |
| `AchievementCard`  | Server | Badge de logro con barra de progreso                 |

### 4.5 Dashboard de administración — decisiones de diseño

El dashboard del Owner/Staff fue prototipado en 3 variantes y se eligió el **Layout C — "Morning Briefing"** como base de producción.

**Filosofía del layout elegido:**
- Sidebar izquierdo de 210px con ícono + label en cada ítem — no solo íconos, para ser amigable con usuarios no técnicos
- Indicador de sección activa: barra vertical lima a la izquierda del ítem + fondo sutil
- Pantalla principal dividida en: header de métricas → estado de canchas → próximas reservas → grilla compacta
- La grilla completa es una tab separada ("Reservas") — no sobrecarga la vista principal
- Topbar con fecha/hora en tiempo real + botón "Nueva reserva" siempre visible

**Principios UX del dashboard (para mantener en toda expansión futura):**
1. **Claridad sobre densidad** — un usuario no-técnico (dueño de 45 años) tiene que entender el estado del club en 3 segundos sin leer
2. **La grilla es la metáfora central** — canchas como columnas, horas como filas, idéntico a una agenda física
3. **Colores con significado consistente** — verde = libre/OK, rojo = ocupado/alerta, naranja = manual/advertencia, azul = online/info
4. **Acciones frecuentes siempre accesibles** — "Nueva reserva" visible en topbar desde cualquier sección
5. **Feedback inmediato** — toda acción (cobrar en bar, guardar config, enviar invitación) muestra confirmación visual

**Grilla de disponibilidad — detalles técnicos:**
- Columnas calculadas dinámicamente con `ResizeObserver` para llenar el ancho disponible
- Línea de hora actual: barra horizontal lima con punto circular, posición calculada con `(hora - 8) * ROW_H + (min / 60) * ROW_H`
- Horas pasadas se muestran con opacidad reducida
- Celdas vacías son clickeables → abren modal de nueva reserva pre-cargado con esa cancha y horario
- Bloques de reserva: gradiente sutil azul (online) o naranja (manual), nombre + rango horario

**Módulo de Bar — decisión de arquitectura:**
El bar vive dentro del dashboard admin como una sección independiente con 3 sub-tabs: Caja / Inventario / Historial. No es una app separada. La caja es la vista por defecto porque es la que se usa con más frecuencia durante el día.

**Restricciones STAFF vs OWNER en el dashboard:**

| Sección              | STAFF | OWNER |
|----------------------|-------|-------|
| Hoy (resumen)        | ✅    | ✅    |
| Reservas (grilla)    | ✅    | ✅    |
| Bar (caja + historial)| ✅   | ✅    |
| Bar (inventario)     | ✅    | ✅    |
| Canchas (CRUD)       | ❌    | ✅    |
| Horarios             | ✅    | ✅    |
| Equipo               | ❌    | ✅    |
| Analytics            | ❌    | ✅    |
| Configuración        | ❌    | ✅    |

---

## 5. ENTIDADES DE DATOS (Prisma Schema)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  password      String    // bcrypt hash, cost 12
  phone         String?
  avatarUrl     String?
  avatarColor   String    // hex generativo por hash del nombre
  zone          String    // barrio/zona habitual
  level         Float     @default(2.0)  // 1.0 → 10.0 con 1 decimal
  matchesPlayed Int       @default(0)
  matchesWon    Int       @default(0)
  streak        Int       @default(0)    // días consecutivos jugando
  lastPlayedAt  DateTime?
  role          Role      @default(PLAYER)
  isActive      Boolean   @default(true)
  isBanned      Boolean   @default(false)   // ban por Superuser
  bannedAt      DateTime?
  bannedReason  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Staff: referencia al club al que pertenece
  staffClubId   String?
  staffClub     Club?     @relation("ClubStaff", fields: [staffClubId], references: [id])

  bookings      Booking[]
  achievements  UserAchievement[]
  refreshTokens RefreshToken[]
  ownedClubs    Club[]    @relation("ClubOwner")
  reviews       Review[]
  auditLogs     AuditLog[]
  invitations   Invitation[]
}

model RefreshToken {
  id        String    @id @default(cuid())
  token     String    @unique  // hash SHA-256 del token real
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime  @default(now())
  revokedAt DateTime?

  @@index([userId])
}

model Club {
  id          String    @id @default(cuid())
  name        String
  description String
  vibe        String    // tagline corto ej: "El favorito de Palermo"
  city        String
  zone        String
  address     String
  lat         Float
  lng         Float
  phone       String
  email       String
  rating      Float     @default(0)
  reviewCount Int       @default(0)
  amenities   String[]
  tags        String[]  // ["Techado", "Al Aire Libre", "Premium"]
  colorR      Int       // RGB para gradiente generativo en UI
  colorG      Int
  colorB      Int
  photos      String[]
  isActive    Boolean   @default(true)
  ownerId     String
  owner       User      @relation("ClubOwner", fields: [ownerId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  courts      Court[]
  reviews     Review[]
  bookings    Booking[]
  staffUsers  User[]    @relation("ClubStaff")
  invitations Invitation[]
  barProducts BarProduct[]
  barSales    BarSale[]
}

model Court {
  id        String    @id @default(cuid())
  clubId    String
  club      Club      @relation(fields: [clubId], references: [id], onDelete: Cascade)
  name      String    // "Cancha 1"
  type      CourtType
  covered   Boolean   @default(false)
  svgX      Float     // posición en el diagrama SVG del club
  svgY      Float
  svgW      Float
  svgH      Float
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())

  availabilities CourtAvailability[]
  bookings       Booking[]
}

model CourtAvailability {
  id           String  @id @default(cuid())
  courtId      String
  court        Court   @relation(fields: [courtId], references: [id], onDelete: Cascade)
  dayOfWeek    Int     // 0=Dom, 1=Lun, ..., 6=Sáb
  openTime     String  // "08:00" — configurable por el dueño
  closeTime    String  // "22:00" — configurable por el dueño
  pricePerHour Float   // precio base ARS por hora
  isActive     Boolean @default(true)
}

model Booking {
  id              String        @id @default(cuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id])
  clubId          String
  club            Club          @relation(fields: [clubId], references: [id])
  courtId         String
  court           Court         @relation(fields: [courtId], references: [id])
  date            DateTime      // solo fecha (midnight UTC)
  startTime       String        // "19:00"
  durationMinutes Int           // 60, 90 (default) o 120
  playerIds       String[]      // IDs de jugadores invitados/confirmados
  status          BookingStatus @default(PENDING)
  totalPrice      Float         // (pricePerHour / 60) * durationMinutes
  paymentStatus   PaymentStatus @default(UNPAID)
  paymentId       String?       // ID de transacción Mercado Pago
  isOpenMatch     Boolean       @default(false)
  requiredLevel   String?       // "3.0–4.0" solo si isOpenMatch
  spotsAvailable  Int?          // solo si isOpenMatch
  source          BookingSource @default(ONLINE)
  manualName      String?       // nombre del cliente en reserva manual sin cuenta
  manualPhone     String?       // teléfono en reserva manual
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  barSales        BarSale[]     // consumiciones del bar asociadas a este turno

  @@index([courtId, date])      // índice para queries de disponibilidad
}

model Achievement {
  id          String         @id @default(cuid())
  key         String         @unique  // "first_booking", "streak_30", etc.
  icon        String
  name        String
  description String
  category    AchievementCat
  total       Float?         // valor objetivo para barra de progreso

  users       UserAchievement[]
}

model UserAchievement {
  id            String      @id @default(cuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievementId String
  achievement   Achievement @relation(fields: [achievementId], references: [id])
  progress      Float       @default(0)
  unlockedAt    DateTime?
  createdAt     DateTime    @default(now())

  @@unique([userId, achievementId])
}

model Review {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  clubId    String
  club      Club     @relation(fields: [clubId], references: [id])
  rating    Int      // 1–5
  comment   String?
  createdAt DateTime @default(now())

  @@unique([userId, clubId])    // una reseña por usuario por club
}

model Invitation {
  id         String    @id @default(cuid())
  email      String
  clubId     String
  club       Club      @relation(fields: [clubId], references: [id], onDelete: Cascade)
  invitedBy  String                      // ID del Owner que invitó
  inviter    User      @relation(fields: [invitedBy], references: [id])
  token      String    @unique           // hash SHA-256 del token enviado por email
  expiresAt  DateTime                    // +48hs desde la creación
  acceptedAt DateTime?
  createdAt  DateTime  @default(now())

  @@index([email])
}

model AuditLog {
  id         String      @id @default(cuid())
  actorId    String                        // ID del Superuser que ejecutó la acción
  actor      User        @relation(fields: [actorId], references: [id])
  action     AuditAction
  entityType String                        // "Club", "User", "Booking", etc.
  entityId   String                        // ID de la entidad afectada
  metadata   Json?                         // valor anterior, motivo, contexto adicional
  createdAt  DateTime    @default(now())

  @@index([actorId])
  @@index([entityType, entityId])
}

// ── ENUMS ──────────────────────────────────────────

enum Role {
  SUPERADMIN     // acceso total + auditoría — solo creado por seed
  OWNER          // gestiona su club + puede jugar como player
  STAFF          // acceso limitado al dashboard de su club
  PLAYER         // app de jugador
}

enum CourtType {
  CRISTAL
  MURO
  PANORAMICA
}

enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
}

enum PaymentStatus {
  UNPAID
  PAID
  REFUNDED
  MANUAL         // pagó en persona, sin transacción digital
}

enum BookingSource {
  ONLINE         // reserva normal desde la app del jugador
  MANUAL_OWNER   // cargada por Owner/Staff desde el panel admin
  MANUAL_SUPPORT // cargada por Superuser desde /superadmin
  BLOCK          // bloqueo interno: mantenimiento, clase, evento privado
}

enum AchievementCat {
  INICIO
  CONSTANCIA
  EXPLORADOR
  SOCIAL
  NIVEL
  RANKING
  ESPECIAL
}

enum AuditAction {
  CREATE_CLUB
  UPDATE_CLUB
  ACTIVATE_CLUB
  DEACTIVATE_CLUB
  CREATE_COURT
  UPDATE_COURT
  CANCEL_BOOKING
  DEACTIVATE_USER
  ACTIVATE_USER
  BAN_USER
  UNBAN_USER
  RESET_USER_PASSWORD
  UPDATE_CLUB_AVAILABILITY
  INVITE_STAFF
  REMOVE_STAFF
  CREATE_MANUAL_BOOKING
}

// ── BAR ────────────────────────────────────────────

model BarProduct {
  id         String       @id @default(cuid())
  clubId     String
  club       Club         @relation(fields: [clubId], references: [id], onDelete: Cascade)
  name       String
  category   BarCategory
  price      Int                          // en centavos de ARS
  stock      Int          @default(0)
  minStock   Int          @default(3)     // alerta de bajo stock
  emoji      String       @default("🥤") // ícono visual en la caja
  active     Boolean      @default(true)
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  saleItems  BarSaleItem[]

  @@index([clubId, active])
}

model BarSale {
  id          String        @id @default(cuid())
  clubId      String
  club        Club          @relation(fields: [clubId], references: [id])
  staffId     String?                      // quién cobró (null si no hay login de staff aún)
  staff       User?         @relation("BarSaleStaff", fields: [staffId], references: [id])
  bookingId   String?                      // reserva asociada (opcional)
  booking     Booking?      @relation(fields: [bookingId], references: [id])
  total       Int                          // suma de items en centavos
  payMethod   PayMethod
  createdAt   DateTime      @default(now())

  items       BarSaleItem[]

  @@index([clubId, createdAt])
}

model BarSaleItem {
  id         String     @id @default(cuid())
  saleId     String
  sale       BarSale    @relation(fields: [saleId], references: [id], onDelete: Cascade)
  productId  String
  product    BarProduct @relation(fields: [productId], references: [id])
  qty        Int
  unitPrice  Int        // precio al momento de la venta (puede diferir del precio actual)
}

enum BarCategory {
  BEBIDAS
  COMIDAS
  SNACKS
  DEPORTIVO
}

enum PayMethod {
  EFECTIVO
  TRANSFERENCIA
  POSNET
}
```

### 5.1 Interfaces TypeScript auxiliares

```typescript
// types/index.ts

export type UserPublic = {
  id: string
  name: string
  avatarColor: string
  zone: string
  level: number           // 1.0 → 10.0
  streak: number
  matchesPlayed: number
  matchesWon: number
}

export type ClubWithCourts = Club & {
  courts: Court[]
  _count: { reviews: number }
}

export type BookingWithDetails = Booking & {
  club: Club
  court: Court
  user: UserPublic
}

// Slot calculado por lib/availability.ts
export type TimeSlot = {
  time: string              // "19:00"
  available: boolean
  durationOptions: number[] // ej: [60, 90] — solo los que caben antes del cierre
}

// Retorno estándar de Server Actions
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }
```

---

## 6. CASOS DE USO — APP JUGADOR

### UC-01: Búsqueda y reserva de cancha (flujo principal)

**Actor:** Jugador (guest o autenticado)
**Precondición:** Ninguna (guest flow habilitado para búsqueda)

**Flujo principal:**
1. Usuario llega a la landing page
2. Ingresa zona/barrio en el buscador o hace clic en "Buscar Clubs"
3. Ve la lista de clubes con mapa split (desktop) o lista (mobile)
4. Puede filtrar por: Techado, Al Aire Libre, precio máximo, Premium
5. Hace clic en "Ver turnos" → quick-book inline con horarios del día
6. O entra a la página del club
7. Selecciona: fecha → horario + duración (60/90/120 min) → cancha en diagrama SVG
8. Ve resumen con precio total calculado
9. Confirma → pantalla de confirmación con WhatsApp share + módulo equipo

**Flujo alternativo (Quick-Book):**
- Selecciona horario + duración inline en la card → directo a confirmación sin pasar por la página del club

**Reglas de negocio — Turnos:**
- Duración por defecto: **90 minutos**
- Opciones disponibles: **60 min**, **90 min**, **120 min**
- Solo se muestran duraciones que caben antes del horario de cierre:
  - Ejemplo: club cierra 22:00 y el slot es 21:00 → solo 60 min disponible
  - Ejemplo: slot 21:30 → ninguna duración disponible (no muestra ese slot)
- Horario operativo: **08:00–22:00 por defecto**, configurable por el dueño por cancha y día de la semana
- Slots ocupados se muestran bloqueados visualmente (no seleccionables)
- Las reservas deben hacerse con mínimo 1 hora de anticipación
- `precioTotal = (pricePerHour / 60) * durationMinutes`

---

### UC-02: Partido Rápido (Matchmaking)

**Actor:** Jugador autenticado
**Precondición:** Jugador con nivel asignado en su perfil

**Flujo:**
1. Configura: zona, nivel, cuándo (hoy/mañana/finde), franja horaria
2. "Encontrar partido" → propuesta: club + horario + duración + 3 jugadores compatibles
3. Acepta → va al flujo de reserva pre-rellenado / Rechaza → shuffle → siguiente propuesta

**Reglas:**
- Jugadores sugeridos dentro de ±1.0 punto de nivel del usuario (escala 1.0–10.0)
- El sistema prioriza clubes con disponibilidad real en el horario deseado
- Máximo 3 propuestas antes de mostrar "Sin opciones en tu zona"
- La propuesta expira en 10 minutos si no se acepta

---

### UC-03: Open Match

**Sub-caso A — Publicar turno abierto:**
1. Usuario tiene un turno reservado (o reserva uno)
2. Lo marca como "Abierto" → configura: nivel requerido + spots libres (1–3)
3. El turno aparece en el feed de Open Match para otros jugadores

**Sub-caso B — Unirse a un turno:**
1. Accede a "Open Match" → pestaña "Disponibles"
2. Ve feed filtrado por nivel y zona
3. "Sumarme" → confirma participación
4. El host recibe notificación

**Reglas:**
- Solo puede unirse si su nivel está dentro del rango requerido
- El turno se cierra automáticamente al completar todos los spots
- Si se cancela, todos los participantes son notificados

---

### UC-04: Sistema de Nivel

**Rango:** 1.0 → 10.0 con 1 decimal (ej: 3.4, 7.2)

| Rango     | Categoría    |
|-----------|--------------|
| 1.0–3.0   | Principiante |
| 3.1–5.0   | Intermedio   |
| 5.1–7.0   | Avanzado     |
| 7.1–9.0   | Competitivo  |
| 9.1–10.0  | Élite        |

- Nivel inicial: **2.0** (ajustable en onboarding con 3 preguntas de calibración)
- Sube/baja según resultados cargados manualmente
- Fórmula tipo Elo adaptada: victoria contra nivel mayor → más puntos
- Mínimo incremento/decremento: 0.1 punto

**Barra de progreso en UI:**
```typescript
// Progreso hacia el siguiente nivel entero
const levelFloor = Math.floor(level)                       // ej: 3 si nivel es 3.4
const progress   = ((level - levelFloor) / 1.0) * 100      // ej: 40%
```

---

### UC-05: Sistema de Racha

- +1 por cada día con al menos 1 partido completado
- Se resetea a 0 si pasa un día sin jugar
- Calendario visual: últimos 35 días (5 semanas × 7 días)
- Banner de urgencia si lleva 5+ días sin jugar

---

### UC-06: Logros (Achievements)

| Categoría  | Key             | Nombre          | Condición                              |
|------------|-----------------|-----------------|----------------------------------------|
| INICIO     | first_booking   | Primera Reserva | Completar la primera reserva           |
| CONSTANCIA | week_active     | Semana Activa   | 7 partidos en una semana               |
| CONSTANCIA | habitual_5      | Habitual        | 5 reservas en el mismo club            |
| CONSTANCIA | streak_30       | Racha de 30     | 30 días consecutivos jugando           |
| EXPLORADOR | clubs_5         | Explorador      | Jugar en 5 clubes distintos            |
| EXPLORADOR | clubs_10        | Gran Explorador | Jugar en 10 clubes distintos           |
| SOCIAL     | players_10      | Social          | Jugar con 10 personas distintas        |
| SOCIAL     | invite_5        | Conector        | Invitar a 5 jugadores por Open Match   |
| NIVEL      | level_5         | Nivel 5         | Alcanzar nivel 5.0                     |
| NIVEL      | level_7         | Nivel 7         | Alcanzar nivel 7.0                     |
| NIVEL      | level_10        | Élite           | Alcanzar nivel 10.0 (máximo)           |
| RANKING    | top10_zone      | Top 10 Zona     | Entrar al top 10 del ranking local     |

---

### UC-07: Ranking Local

- **Tab "Tu zona":** jugadores de la misma zona/barrio
- **Tab "Buenos Aires":** ranking global de la ciudad
- Top 3 con podio visual especial
- El usuario autenticado siempre aparece destacado aunque esté en posición 50+
- Puntos = función de: nivel + partidos jugados + victorias + racha activa

---

### UC-08: Historial Inteligente

**Vistas:**
1. **Mis partidos:** lista cronológica con resultado y compañeros. CTA "Repetir turno"
2. **Estadísticas:** gráfico barras semanales, club favorito, horario pico, winrate

**Sugerencia proactiva (arriba del fold):**
- Detecta patrón recurrente del usuario (día + hora habitual)
- Muestra: *"Solés jugar los miércoles a las 19 — este miércoles hay cancha en [Club]"*
- CTA de reserva directa

---

### UC-09: Perfil de Jugador

1. **Header:** avatar generativo, nombre, zona, nivel (1.0–10.0) con barra de progreso, 4 stats
2. **Tab Logros:** grid de achievements desbloqueados + bloqueados con progreso
3. **Tab Racha:** calendario visual 35 días + número de racha + banner de urgencia

---

## 7. CASOS DE USO — DASHBOARD OWNER (Sprint 5)

### UC-10: Gestión de Canchas
- CRUD: nombre, tipo (cristal/muro/panorámica), techada, posición en SVG, precio/hora
- Activar/desactivar temporalmente

### UC-11: Configuración de Horarios
- Horario de apertura/cierre configurable por cancha y por día de la semana
- Bloquear slots específicos (mantenimiento, torneos, eventos)
- Vista grilla tipo calendar del día actual

### UC-12: Panel de Reservas + Reserva Manual

**Ver reservas:**
- Vista grilla del día / semana con todas las reservas
- Distinguir visualmente el origen: 🌐 Online / 📞 Manual / 🔒 Bloqueo
- Confirmar o cancelar reservas

**Reserva manual (nueva):**
- Owner o Staff accede a `/admin/reservas/nueva`
- Selecciona cancha + fecha + horario + duración (igual que el wizard del jugador)
- Opcionalmente busca un usuario existente por email o ingresa nombre + teléfono
- Selecciona origen: Presencial, Teléfono, o Bloqueo interno
- Si es Bloqueo: solo pide motivo (mantenimiento, clase, evento), no hay precio ni cliente
- La reserva se crea directamente como `CONFIRMED` con `paymentStatus: MANUAL`
- El double-booking check aplica igual — usa la misma transacción Prisma

### UC-13: Analytics del Club (solo OWNER, no STAFF)
- Ingresos del día, semana, mes
- % de ocupación por cancha
- Horarios más demandados
- Jugadores más frecuentes

### UC-14: Gestión de Equipo / Staff

**Invitar Staff:**
1. Owner entra a `/admin/equipo`
2. Ingresa el email del empleado
3. Server Action crea `Invitation` (token, expira en 48hs) y envía email con link
4. El empleado entra al link `/invitacion/[token]`, crea su contraseña
5. Se crea su cuenta con `role: STAFF` y `staffClubId` asignado al club del Owner

**Gestionar Staff:**
- Ver lista de Staff activo del club
- Ver invitaciones pendientes y su estado (enviada / expirada)
- Reenviar invitación expirada
- Remover Staff (desvincula `staffClubId` y desactiva su acceso al dashboard)

**Restricciones del Staff vs Owner:**
- Staff puede: ver reservas, confirmar/cancelar, crear reservas manuales, gestionar horarios
- Staff NO puede: ver analytics, configurar el club, gestionar canchas, invitar más Staff, remover Staff

---

## 8. CASOS DE USO — PANEL SUPERADMIN (Sprint 6)

### Diseño visual del panel

El Superadmin tiene su propia identidad visual diferenciada del dashboard Owner/Staff:
- **Accent violeta** (`#a855f7`) en lugar del lima — mismo design system, acento diferente
- Sidebar con indicador violeta en ítem activo (vs lima en el Owner)
- Badge `⚡ SUPERADMIN` persistente en el topbar
- Punto violeta junto al logo y subtítulo "Superadmin" (vs "Panel administrador")
- Fondo base levemente teñido (`#0a0810`) para distinguir el entorno visualmente

El objetivo es que quien usa el panel nunca olvide que está en "modo dios". Cualquier acción tiene consecuencias reales sobre usuarios y clubes reales.

### UC-15: Dashboard Global

Métricas de la plataforma completa visible al entrar a `/superadmin`:

**KPIs (fila de 4 cards):**
- Ingresos totales del día — suma de todos los clubes activos (accent card)
- Reservas del día — total plataforma, online + manual
- Clubes activos — de N registrados
- Usuarios nuevos — últimos 7 días

**Gráfico semanal:** barras de ingresos por día (lunes a domingo), día actual destacado en lima.

**Feed de actividad reciente:** scroll de eventos en tiempo real — nuevas reservas, registros de usuarios, ventas de bar, cambios de estado de clubes, acciones del Superadmin. Cada tipo tiene ícono y color propio.

**Grilla de clubes — estado hoy:** todos los clubes en grid de 3 columnas con estado (activo/inactivo), reservas del día e ingresos. Los inactivos aparecen con opacidad reducida.

### UC-16: Onboarding de Club (creación por Superuser)

Exclusivo del Superuser — los clubes contactan a PadelGo y el equipo los registra.

**Formulario inline en `/superadmin/clubs`** — se expande sobre la tabla sin cambiar de página. Dos pasos:

**Paso 1 — Datos del club:**
- Nombre del club *
- Zona / Barrio *
- Dirección *

**Paso 2 — Asignar Owner:**
- Email del Owner * (si ya existe como usuario, se vincula; si no, se envía invitación)
- Nombre (solo si es cuenta nueva)
- Aviso contextual: "Si el email no pertenece a ningún usuario registrado, se enviará un link de activación para crear su cuenta con rol OWNER"

**Confirmación:** flash de éxito inline, sin redirección. Club queda `isActive: false` hasta que el Owner complete su configuración.

**Auditoría:** `AuditLog` con `action: CREATE_CLUB` en la misma transacción.

### UC-17: Vista de Clubes

Tabla con búsqueda + 3 filtros (Todos / Activos / Inactivos). Columnas:
`Club + email | Zona | Owner | Canchas | Reservas hoy | Ingresos | Estado | [Ver club →]`

El botón "Ver club →" activa el **modo contexto** (UC-17b).

### UC-17b: Modo Contexto de Club (Banner de Superuser)

Al entrar a un club, toda la UI cambia a modo soporte:

**Banner violeta persistente al tope (debajo del topbar):**
```
👁  Modo soporte  ·  [Nombre del club]  ·  [Zona · N canchas]  ·  🟢 Activo
                                          [Desactivar club]  [← Salir del contexto]
```

- El sidebar muestra un indicador "Contexto activo" con el nombre del club y link para salir
- Sub-tabs horizontales: Reservas · Canchas · Horarios · Equipo · Analytics
- Cards con KPIs del club (reservas hoy, ingresos, canchas, Owner)
- Cada sub-tab carga el mismo componente que ve el Owner en `/admin/*` pero con datos del club seleccionado y todas las acciones registradas en AuditLog

**Botón Desactivar/Activar club:** cambia `isActive` del club con confirmación implícita en el banner.

### UC-18: Soporte a Usuario

**Panel dividido:** lista de usuarios a la izquierda (360px), detalle a la derecha.

**Lista izquierda:**
- Buscador por nombre, email, zona
- Cada fila: avatar generativo + nombre + email + nivel + cantidad de reservas
- Badges visibles en la lista: `BAN` (rojo), `INACTIVO` (gris)
- Borde izquierdo violeta en ítem seleccionado

**Detalle derecho — header del usuario:**
- Avatar grande + nombre + email + teléfono
- Si está baneado: card con borde rojo + motivo del ban visible
- Stats: Nivel · Reservas · Zona · Último acceso

**Acciones de soporte (grilla 2×2):**

| Acción | Descripción | Color |
|--------|-------------|-------|
| Resetear contraseña | Envía email con link de reset al usuario | Azul |
| Cancelar reserva | Abre historial para elegir cuál cancelar | Neutro |
| Desactivar / Activar cuenta | Toggle `isActive` — sin poder loguearse | Naranja / Verde |
| Banear / Levantar ban | `isBanned: true` + campo de motivo obligatorio | Rojo / Verde |

**Ban flow:** al hacer clic en "Banear" el botón se expande inline con un input de motivo. Solo confirma si hay texto. El motivo queda en `User.bannedReason`.

**Historial de reservas:** tabla completa con club, cancha, fecha, hora, precio, estado. Las confirmadas tienen botón "Cancelar" individual.

### UC-19: Log de Auditoría

Desde `/superadmin/audit`:

**Filtros:**
- Por tipo de entidad: Todos / Club / User
- Por tipo de acción: chips de las acciones más frecuentes + opción "Todas"
- Contador de registros filtrados

**Aviso de inmutabilidad:** banner violeta que recuerda que el log no puede editarse ni borrarse.

**Cada entrada muestra:**
- Hora (o "Ayer", "Lun", etc. para entradas antiguas)
- Badge de acción coloreado (cada `AuditAction` tiene color propio)
- Nombre de la entidad afectada
- Chip de tipo (Club / User)
- Metadata legible (ej: "Motivo: Múltiples cancelaciones sin aviso")
- Avatar del Superuser que ejecutó la acción (siempre el mismo en MVP)

**Colores de acciones en el log:**

| Acción | Color |
|--------|-------|
| CREATE_CLUB, ACTIVATE_CLUB, ACTIVATE_USER, UNBAN_USER | Verde |
| UPDATE_CLUB, UPDATE_CLUB_AVAILABILITY, RESET_USER_PASSWORD, CANCEL_BOOKING, CREATE_MANUAL_BOOKING | Azul |
| DEACTIVATE_CLUB, DEACTIVATE_USER, REMOVE_STAFF | Naranja |
| BAN_USER | Rojo |
| INVITE_STAFF | Violeta |

---

## 9. CASOS DE USO — MÓDULO DE BAR (Sprint 5)

El bar vive dentro del dashboard admin en `/admin/bar` con 3 sub-tabs: **Caja / Inventario / Historial**. OWNER y STAFF tienen acceso completo. La lógica de stock se actualiza en tiempo real al confirmar una venta.

### UC-20: Caja (venta rápida)

1. Staff/Owner entra a `/admin/bar` — la Caja es la sub-tab por defecto
2. Ve grilla de productos del club organizados por categoría con precio y stock visible
3. Puede filtrar por categoría (Bebidas / Comidas / Snacks / Deportivo) o buscar por nombre
4. Tap en producto → se agrega al pedido con contador (si el producto ya está, incrementa qty)
5. Panel derecho muestra el ticket: items, cantidades editables, total
6. Opcionalmente asocia la venta a una reserva activa o reciente (linkBookingId)
7. Selecciona método de pago: Efectivo / Transferencia / Posnet
8. Confirma → Server Action `createBarSale`:
   - Crea `BarSale` + `BarSaleItem[]` en una transacción
   - Descuenta stock de cada `BarProduct` en la misma transacción
   - Si algún producto quedó sin stock, devuelve warning pero no bloquea
9. Feedback visual inmediato: flash de confirmación + pedido se vacía

**Reglas:**
- Productos con `active: false` no aparecen en la caja
- Productos con `stock: 0` aparecen bloqueados (no se pueden agregar)
- El precio guardado en `BarSaleItem.unitPrice` es el precio al momento de la venta, no el actual

### UC-21: Inventario

**Ver y editar productos:**
- Lista todos los productos del club organizados por categoría
- Stock actual vs stock mínimo — alerta naranja si `stock <= minStock`
- Banner global al tope si hay algún producto con bajo stock
- Toggle activo/inactivo por producto (inactivo = no aparece en la caja)

**Agregar producto:**
- Formulario inline: nombre, categoría, precio, stock inicial, stock mínimo, emoji
- Server Action `createBarProduct` — asociado al clubId del Owner

**Restricciones:**
- STAFF puede ver el inventario y actualizar stock manualmente
- STAFF NO puede agregar, editar ni eliminar productos (solo OWNER)

### UC-22: Historial de ventas

- Resumen del día: cantidad de ventas, total recaudado, ticket promedio
- Lista cronológica de ventas con: hora, productos (chips), método de pago, total, reserva asociada si la tiene
- Filtrable por método de pago y rango de horas

### UC-23: Analytics del Club (solo OWNER)

Desde `/admin/analytics`:

**KPIs principales:**
- Ingresos totales = ingresos de reservas + ingresos de bar
- Cantidad de reservas (con desglose online vs manual)
- Total recaudado en bar + cantidad de ventas
- Porcentaje de ocupación vs promedio histórico

**Gráficos:**
- Barras apiladas por día de la semana: reservas (lima) + bar (naranja)
- Horarios pico: barra horizontal por slot horario con intensidad según demanda
- Ranking de canchas por ingresos con barra de progreso
- Breakdown de origen de reservas (web vs manual) con porcentaje

**Cálculo de ingresos:**
```typescript
// lib/analytics.ts
// Ingresos de reservas: suma de Booking.price donde status=CONFIRMED
// Ingresos de bar: suma de BarSale.total para el club en el período
// Ocupación: (slots ocupados / slots totales posibles) * 100
//   slots totales = canchas activas × horas operativas × días del período
```

---

## 10. FLUJOS DE AUTENTICACIÓN

### 9.1 Guest Flow
- Landing y buscador son públicos sin necesidad de cuenta
- Al intentar reservar: modal con "Crear cuenta" o "Continuar como invitado" (nombre + email)
- Invitados no tienen perfil, ranking ni logros

### 9.2 Registro de Jugador de Jugador
1. Nombre + email + contraseña
2. Selección de zona/barrio
3. Onboarding de nivel: 3 preguntas de calibración → asigna nivel inicial entre 1.0 y 4.0
4. Server Action: crea User en DB (bcrypt hash) → genera tokens → setea cookies → redirect home

### 9.3 Login / Logout
- **Login:** verifica email+contraseña → genera access_token + refresh_token → setea cookies `httpOnly; Secure; SameSite=Strict`
- **Logout:** Server Action borra ambas cookies → redirect `/`

### 9.4 Proxy de autenticación (Next.js 16)
```typescript
// proxy.ts — aplica a rutas protegidas (Next.js 16: middleware.ts → proxy.ts)
// /confirmar, /match, /open-match, /ranking, /historial, /perfil
// /admin/*, /superadmin/*
//
// access_token válido                        → next()
// access_token expirado + refresh válido     → rota ambos tokens → next()
// ambos inválidos o ausentes                 → redirect '/login?from=...'

// IMPORTANTE: en Next.js 16 la función se llama proxy, no middleware
export function proxy(request: NextRequest) { ... }
```

### 9.5 Invitación de Staff (Owner invita a empleado)
1. Owner entra a `/admin/equipo` → ingresa email del empleado
2. Server Action crea `Invitation` (token hasheado, `expiresAt: +48hs`) → envía email
3. Link enviado: `https://padelgo.ar/invitacion/[token-plano]`
4. El empleado entra → página verifica token no expirado ni usado
5. Ingresa nombre + contraseña → Server Action crea User con `role: STAFF` y `staffClubId` asignado, marca `Invitation.acceptedAt`
6. Token expirado → muestra mensaje + opción de pedir reenvío al Owner
7. Owner puede reenviar desde `/admin/equipo` → nuevo `Invitation`, el anterior se invalida

### 9.6 Activación de Owner (creado por Superuser)
- Mismo mecanismo que invitación de Staff pero sin `staffClubId`
- User se crea con `role: OWNER`, el Club queda vinculado en `ownerId`
- Recibe email de bienvenida con link para completar el perfil del club (canchas, horarios, fotos)

### 9.7 Reset de contraseña (iniciado por Superuser)
1. Superuser hace clic en "Resetear contraseña" en `/superadmin/users/[id]`
2. Server Action genera token de reset → envía email al usuario
3. Usuario entra a `/reset-password/[token]` → ingresa nueva contraseña
4. La acción queda registrada en `AuditLog` con `action: RESET_USER_PASSWORD`

### 9.8 Roles y jerarquía
```
SUPERADMIN   → acceso total — solo creado por seed de DB, nunca por UI
OWNER        → dashboard de su club + app de jugador
STAFF        → dashboard limitado del club al que está vinculado (staffClubId)
PLAYER       → app de jugador
```

**Diferencia STAFF vs OWNER en el dashboard:**

| Acción                        | STAFF | OWNER |
|-------------------------------|-------|-------|
| Ver reservas del día          | ✅    | ✅    |
| Crear reserva manual          | ✅    | ✅    |
| Cancelar reservas             | ✅    | ✅    |
| Gestionar horarios            | ✅    | ✅    |
| Ver analytics                 | ❌    | ✅    |
| Configurar club (datos, fotos)| ❌    | ✅    |
| Gestionar canchas (CRUD)      | ❌    | ✅    |
| Invitar / remover Staff       | ❌    | ✅    |

---

## 11. REGLAS DE NEGOCIO GLOBALES

1. **Double-booking:** Se previene con una transacción Prisma que en un único bloque atómico: (a) busca reservas existentes `CONFIRMED` o `PENDING` en la misma cancha y fecha cuyo rango horario se superponga con el slot pedido, (b) si encuentra alguna, lanza error y no crea nada, (c) si no hay conflicto, crea la reserva. El índice `@@index([courtId, date])` hace esa búsqueda eficiente. Dos usuarios simultáneos no pueden ganar el mismo slot — PostgreSQL garantiza el lock a nivel de fila.
2. **Duraciones:** 60 / **90 (default)** / 120 min. Solo se muestran duraciones que caben antes del horario de cierre del club.
3. **Horario operativo:** 08:00–22:00 por defecto. Configurable por el dueño, por cancha y día de la semana vía `CourtAvailability`.
4. **Precio:** `total = (pricePerHour / 60) * durationMinutes`
5. **Reserva manual:** Entra directamente como `CONFIRMED` + `paymentStatus: MANUAL`. El double-booking check aplica igual. Se diferencia visualmente en la grilla del admin por `source` (MANUAL_OWNER / MANUAL_SUPPORT / BLOCK).
6. **Cancelaciones:** hasta 2 horas antes del turno sin cargo. Política configurable por club.
7. **Nivel en Open Match:** el club puede fijar rango de nivel mínimo y máximo por cancha.
8. **Reseñas:** solo puede reseñar quien completó una reserva en ese club. Restricción `@@unique([userId, clubId])`.
9. **Pagos:** solo Mercado Pago Argentina en fase inicial. Internacional: pendiente.
10. **Staff:** solo puede acceder al dashboard del club al que está vinculado (`staffClubId`). Si el Owner lo remueve, pierde acceso inmediatamente.
11. **Superadmin:** no se puede crear desde la UI. Solo existe en el seed de la DB. Toda acción que ejecute queda registrada en `AuditLog` dentro de la misma transacción — si la acción falla, no queda el log; si pasa, el log es inmutable.
12. **Ban de usuario:** un usuario baneado (`isBanned: true`) no puede loguearse aunque tenga tokens válidos — el proxy.ts verifica el flag en cada request.

---

## 12. ESTADO ACTUAL DEL PROYECTO

El archivo `padelgo-v3.jsx` es el prototipo visual de referencia (mock data, un solo archivo React).
El objetivo del proyecto real es reimplementarlo en Next.js con la arquitectura de §2 y §3.

| Feature                            | UI prototipo   | Prod Next.js   |
|------------------------------------|----------------|----------------|
| Landing page                       | ✅ Completo    | ⏳ Sprint 3    |
| Buscador + mapa + filtros          | ✅ Completo    | ⏳ Sprint 3    |
| Quick-book acordeón                | ✅ Completo    | ⏳ Sprint 3    |
| Página de club + booking wizard    | ✅ Completo    | ⏳ Sprint 3    |
| Selector 60 / 90 / 120 min        | ✅ Completo    | ⏳ Sprint 3    |
| Diagrama SVG de canchas            | ✅ Completo    | ⏳ Sprint 3    |
| Confirmación + WhatsApp            | ✅ Completo    | ⏳ Sprint 4    |
| Partido Rápido (Matchmaking)       | ✅ Completo    | ⏳ Sprint 4    |
| Open Match                         | ✅ Completo    | ⏳ Sprint 4    |
| Ranking local + podio              | ✅ Completo    | ⏳ Sprint 4    |
| Historial + estadísticas           | ✅ Completo    | ⏳ Sprint 4    |
| Perfil + Logros + Racha            | ✅ Completo    | ⏳ Sprint 4    |
| Nav híbrido (sidebar + bottom nav) | ✅ Completo    | ⏳ Sprint 1    |
| Tema Obsidian dark + light         | ✅ Definido    | ⏳ Sprint 1    |
| Tipografía Bebas Neue + DM Sans    | ✅ Definido    | ⏳ Sprint 1    |
| Sistema de nivel 1.0–10.0          | ✅ Definido    | ⏳ Sprint 4    |
| Auth JWT con cookies               | —             | ⏳ Sprint 2    |
| Base de datos (Prisma v7 + Docker) | —             | ⏳ Sprint 1    |
| Server Actions                     | —             | ⏳ Sprint 3+   |
| Reserva manual (Owner/Staff)       | —             | ⏳ Sprint 5    |
| Invitación de Staff por email      | —             | ⏳ Sprint 5    |
| Dashboard Owner completo           | —             | ⏳ Sprint 5    |
| Panel Superadmin                   | —             | ⏳ Sprint 6    |
| Onboarding de club (Superuser)     | —             | ⏳ Sprint 6    |
| AuditLog                           | —             | ⏳ Sprint 6    |
| Pagos Mercado Pago                 | —             | ⏳ Sprint 7    |
| Notificaciones por email           | —             | ⏳ Sprint 7    |

---

## 13. PRÓXIMOS PASOS — SPRINTS

### Sprint 1 — Setup del proyecto Next.js

```bash
# 1. Crear proyecto
npx create-next-app@latest padelgo \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# 2. Dependencias
npm install prisma@7 @prisma/client@7
npm install jose bcryptjs @types/bcryptjs   # JWT + hashing
npm install zustand                          # store cliente mínimo
npm install clsx tailwind-merge              # utilidades de clases
npm install resend                           # email (invitaciones + notificaciones)

# 3. Inicializar Prisma y levantar DB
npx prisma init
docker compose up -d
npx prisma migrate dev --name init
npx prisma db seed
```

> **Notas específicas de Next.js 16.1.6:**
> - `middleware.ts` → se llama `proxy.ts` y exporta `proxy()` en vez de `middleware()`
> - `next dev` ya usa Turbopack por defecto — no hace falta el flag `--turbopack`
> - Caching es opt-in con la directiva `"use cache"` — nada se cachea implícitamente
> - Edge runtime eliminado de `proxy.ts` — corre solo en Node.js (ideal para `jose` y `bcryptjs`)

> **Notas específicas de Prisma v7:**
> - `PrismaClient` se importa desde `@prisma/client` igual que antes
> - Migraciones con `prisma migrate dev` sin cambios de API
> - Verificar compatibilidad de tipos generados con TypeScript strict

**Checklist Sprint 1:**
- [ ] Proyecto corriendo en `localhost:3000`
- [ ] `docker-compose.yml` con Postgres configurado y corriendo
- [ ] Schema Prisma v7 completo (§5) con migración inicial aplicada
- [ ] Seed con: 1 SUPERADMIN, 2 OWNERs, 2 clubes, canchas, availability, logros base, 5 PLAYERs
- [ ] `.env.local` con todas las variables del §14
- [ ] Fuentes cargadas en `app/layout.tsx` via `next/font/google`
- [ ] `tailwind.config.ts` con todos los tokens del design system (§4.3)
- [ ] `globals.css` con CSS variables de ambos temas Obsidian (§13)
- [ ] Zustand store `themeStore.ts` — solo dark/light toggle
- [ ] Layout raíz con providers y estructura de nav
- [ ] Sidebar (Server Component) + BottomNav (Client, `usePathname`) listos
- [ ] ThemeToggle funcional

---

### Sprint 2 — Autenticación JWT

```
1. lib/prisma.ts          → singleton Prisma v7 client
2. lib/auth.ts            → generateAccessToken, generateRefreshToken,
                            verifyAccessToken, verifyRefreshToken,
                            getSession, requireAuth, requireRole, requireSuperAdmin
3. lib/cookies.ts         → setAuthCookies(tokens), clearAuthCookies()
4. proxy.ts               → verificación JWT + refresh automático + ban check + role guards
5. app/registro/          → página + Server Action register (solo PLAYER)
6. app/login/             → página + Server Action login (todos los roles)
7. actions/auth.ts        → register, login, logout
8. api/auth/refresh/      → route handler para proxy.ts
9. Seed: datos realistas con todos los roles
```

**Checklist Sprint 2:**
- [ ] Registro crea PLAYER con bcrypt + setea cookies httpOnly
- [ ] Login funciona para todos los roles, redirect correcto por rol:
  - SUPERADMIN → /superadmin
  - OWNER → /admin
  - STAFF → /admin
  - PLAYER → /
- [ ] proxy.ts protege rutas y verifica `isBanned` en cada request
- [ ] Refresh automático transparente al usuario
- [ ] Logout limpia ambas cookies + redirect
- [ ] `getSession()` disponible en cualquier Server Component
- [ ] `requireSuperAdmin()` bloquea acceso a /superadmin a otros roles

---

### Sprint 3 — Pantallas públicas (Jugador)

```
1. components/ui/          → Button, Avatar, Tag, Badge, Input, Skeleton
2. components/layout/      → Sidebar, BottomNav, Topbar, ThemeToggle
3. Landing /               → Server Component, datos reales de DB, Suspense
4. Buscador /buscar        → Server Component con searchParams para filtros
                             ClubCard (Server), MapView (Client - Mapbox/Leaflet)
                             Quick-Book accordion (Client)
5. Club /club/[id]         → Server Component con disponibilidad calculada
                             BookingWizard (Client):
                               DatePicker → TimePicker + DurationSelector → CourtDiagram
                             Precio calculado en tiempo real
6. lib/availability.ts     → calcular TimeSlots[] disponibles para (courtId, date)
                             Incluye durationOptions según tiempo restante hasta cierre
```

**Checklist Sprint 3:**
- [ ] Landing muestra datos reales de DB (clubes, stats)
- [ ] Buscador filtra por zona/nombre via searchParams (sin JS cliente)
- [ ] Mapa muestra pins con coordenadas reales
- [ ] Quick-book muestra slots reales con disponibilidad actualizada
- [ ] BookingWizard completo con los 3 pasos
- [ ] DurationSelector muestra solo 60/90/120 según tiempo antes del cierre
- [ ] Precio se actualiza en tiempo real al cambiar duración
- [ ] Server Action `createBooking` con transacción Prisma anti double-booking
- [ ] `source: ONLINE` se asigna automáticamente en reservas de jugador

---

### Sprint 4 — Pantallas autenticadas (Jugador)

```
1. /confirmar              → post-reserva, WhatsApp share, módulo equipo
2. /perfil                 → datos del user, nivel (1-10) + barra, logros, racha calendar
3. /historial              → reservas pasadas, estadísticas, sugerencia proactiva
4. /ranking                → podio + tabla, user destacado, tabs zona/ciudad
5. /open-match             → feed de turnos abiertos + mis turnos publicados
6. /match                  → wizard de config + propuesta con jugadores compatibles
7. lib/achievements.ts     → evaluar y desbloquear logros post-reserva
8. lib/level.ts            → cálculo Elo adaptado para escala 1.0–10.0
9. Server Action post-match → actualizar nivel + racha + logros en una transacción
```

---

### Sprint 5 — Dashboard Owner + Staff + Bar

```
1. proxy.ts: guards para /admin/* — permitir OWNER y STAFF
             /admin/canchas, /admin/equipo, /admin/analytics, /admin/config solo OWNER
2. /admin                  → métricas del día: reservas, ingresos totales (reservas+bar),
                             canchas libres ahora, próxima reserva
3. /admin/reservas         → grilla del día con columnas auto-width (ResizeObserver),
                             línea de hora actual animada, badge de source
4. /admin/reservas/nueva   → wizard 4 pasos: cancha → horario+duración → datos cliente → confirmar
                             tipos: Presencial / Teléfono / Bloqueo
                             source: MANUAL_OWNER, paymentStatus: MANUAL
5. /admin/bar              → 3 sub-tabs client-side (no rutas separadas):
                             Caja: grilla de productos + ticket + método de pago + link a reserva
                             Inventario: CRUD productos, alertas bajo stock (solo OWNER editar)
                             Historial: ventas del día con resumen y filtros
6. /admin/canchas          → CRUD canchas: nombre, tipo, techo, precio, activar/desactivar (OWNER)
7. /admin/horarios         → tabla apertura/cierre por cancha y día, toggle activo/inactivo
8. /admin/equipo           → lista Staff + invitaciones pendientes, enviar invitación por email (OWNER)
9. /admin/analytics        → KPIs, gráfico barras apiladas semanal, horarios pico,
                             ranking canchas, breakdown origen reservas (OWNER)
10. /admin/config          → datos del club, horarios globales, política cancelación,
                             moneda, zona de peligro (OWNER)
11. /invitacion/[token]    → página pública: verifica token + formulario de activación Staff
12. lib/email.ts           → emails de invitación Staff
13. lib/analytics.ts       → calcularIngresos, calcularOcupacion, calcularHorariosPico
14. actions/owner/bar.ts   → createBarSale (tx: crea venta + descuenta stock),
                             createBarProduct, updateBarProduct, toggleBarProduct
```

**Checklist Sprint 5:**
- [ ] STAFF ve dashboard, reservas, bar y horarios — no ve canchas, equipo, analytics ni config
- [ ] Reserva manual crea Booking con source correcto, pasa double-booking check
- [ ] Bloqueo interno no requiere cliente ni precio
- [ ] Grilla se adapta al ancho disponible automáticamente con ResizeObserver
- [ ] Línea de hora actual se posiciona con `(hora-8)*ROW_H + (min/60)*ROW_H`
- [ ] Clic en celda vacía de la grilla abre modal de nueva reserva pre-cargado
- [ ] Venta de bar en una transacción: crea BarSale + BarSaleItem[] + descuenta stock
- [ ] Productos con stock=0 bloqueados en la caja, stock bajo con alerta naranja
- [ ] BarSaleItem.unitPrice guarda el precio al momento de la venta (no el actual)
- [ ] Analytics calcula ingresos = reservas confirmadas + ventas bar del período
- [ ] Flujo de invitación Staff completo: email → link → cuenta creada
- [ ] Owner puede remover Staff con efecto inmediato

---

### Sprint 6 — Panel Superadmin

```
1. proxy.ts: guard para /superadmin/* — solo SUPERADMIN
2. /superadmin             → dashboard global: clubes activos, reservas hoy,
                             ingresos plataforma, usuarios nuevos, feed actividad
3. /superadmin/clubs       → lista todos los clubes (activos + inactivos) con búsqueda
4. /superadmin/clubs/nuevo → onboarding mínimo: nombre, email, dirección, coordenadas
                             buscar Owner existente por email o crear cuenta nueva
                             Server Action createClub + createOwnerInvitation si es nuevo
5. /superadmin/clubs/[id]  → banner de contexto "Modo soporte · [Club] · Salir"
                             mismo dashboard que el Owner, con acciones adicionales:
                             activar/desactivar club
6. /superadmin/clubs/[id]/canchas, horarios, reservas, equipo, analytics
                           → mismas vistas que /admin/* pero para cualquier club
7. /superadmin/users       → búsqueda por email/nombre/zona
8. /superadmin/users/[id]  → perfil completo + historial + acciones:
                             cancelar reserva, resetear password, desactivar, banear
9. /superadmin/audit       → log inmutable, filtros por acción/entidad/fecha
10. lib/audit.ts           → createAuditLog(actorId, action, entityType, entityId, metadata)
                             siempre llamar dentro de la misma transacción Prisma
11. actions/superadmin/    → createClub, updateClub, toggleClubActive,
                             cancelUserBooking, resetUserPassword,
                             deactivateUser, banUser, unbanUser
```

**Checklist Sprint 6:**
- [ ] Ningún rol que no sea SUPERADMIN puede acceder a /superadmin/*
- [ ] Banner de contexto visible en todas las subrutas de /superadmin/clubs/[id]
- [ ] Toda acción sensible del Superuser crea AuditLog en la misma transacción
- [ ] AuditLog no es editable ni borrable desde ninguna UI
- [ ] Ban de usuario bloquea el login aunque tenga tokens válidos (check en proxy.ts)
- [ ] Onboarding de club funcional: club creado + Owner notificado por email
- [ ] Reset de password envía email real al usuario

---

### Sprint 7 — Pagos, notificaciones y pulido

```
1. Mercado Pago Checkout Pro:
   - Server Action: crear preferencia → retorna init_point URL
   - api/webhooks/mp/route.ts → verificar firma + actualizar paymentStatus
   - Flujo: Booking PENDING → pago → webhook → CONFIRMED
2. Notificaciones por email (Resend):
   - Confirmación de reserva al jugador
   - Recordatorio 2hs antes del turno
   - Aviso de cancelación (jugador y host si Open Match)
   - Email de bienvenida al Owner cuando activa su cuenta
3. Sistema de reseñas post-partido
4. ISR con revalidateTag en páginas de clubes
5. SEO: metadata dinámica por club, sitemap.xml, robots.txt
6. Optimización de imágenes con next/image + CDN
```

---

## 14. ESTRUCTURA DE CARPETAS (Next.js App Router)

```
padelgo/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                      # Landing
│   │   ├── buscar/page.tsx               # Buscador
│   │   └── club/[id]/page.tsx            # Club + Booking
│   ├── (auth)/
│   │   ├── layout.tsx                    # requireAuth guard
│   │   ├── confirmar/page.tsx
│   │   ├── match/page.tsx
│   │   ├── open-match/page.tsx
│   │   ├── ranking/page.tsx
│   │   ├── historial/page.tsx
│   │   └── perfil/page.tsx
│   ├── (owner)/
│   │   ├── layout.tsx                    # requireRole(OWNER | STAFF) guard
│   │   └── admin/
│   │       ├── page.tsx                  # Dashboard — resumen del día
│   │       ├── reservas/
│   │       │   ├── page.tsx              # Grilla del día (ResizeObserver, línea hora actual)
│   │       │   └── nueva/page.tsx        # Wizard reserva manual (4 pasos)
│   │       ├── bar/
│   │       │   └── page.tsx              # Módulo bar — 3 sub-tabs client-side:
│   │       │                             #   Caja | Inventario | Historial
│   │       ├── canchas/page.tsx          # CRUD canchas (solo OWNER)
│   │       ├── horarios/page.tsx         # Config disponibilidad por cancha/día
│   │       ├── equipo/page.tsx           # Staff activo + invitaciones (solo OWNER)
│   │       ├── analytics/page.tsx        # KPIs + gráficos (solo OWNER)
│   │       └── config/page.tsx           # Datos club + reglas + zona peligro (solo OWNER)
│   ├── (superadmin)/
│   │   ├── layout.tsx                    # requireSuperAdmin() guard + banner contexto
│   │   └── superadmin/
│   │       ├── page.tsx                  # Dashboard global plataforma
│   │       ├── clubs/
│   │       │   ├── page.tsx              # Lista todos los clubes
│   │       │   ├── nuevo/page.tsx        # Onboarding mínimo de club
│   │       │   └── [id]/
│   │       │       ├── page.tsx          # Vista club con banner de contexto
│   │       │       ├── canchas/page.tsx
│   │       │       ├── reservas/page.tsx
│   │       │       ├── horarios/page.tsx
│   │       │       ├── equipo/page.tsx
│   │       │       └── analytics/page.tsx
│   │       ├── users/
│   │       │   ├── page.tsx              # Búsqueda de usuarios
│   │       │   └── [id]/page.tsx         # Perfil completo + acciones de soporte
│   │       └── audit/
│   │           └── page.tsx              # Log inmutable de acciones del Superuser
│   ├── login/page.tsx
│   ├── registro/page.tsx
│   ├── invitacion/[token]/page.tsx        # Activación de Staff o nuevo Owner
│   ├── reset-password/[token]/page.tsx    # Reset de contraseña
│   ├── api/
│   │   ├── auth/refresh/route.ts          # Refresh token endpoint
│   │   └── webhooks/mp/route.ts           # Mercado Pago webhook (Sprint 7)
│   ├── layout.tsx                         # Root layout — fuentes, providers
│   ├── globals.css                        # CSS variables temas + Tailwind base
│   ├── not-found.tsx
│   └── error.tsx
│
├── components/
│   ├── ui/                               # Átomos reutilizables
│   │   ├── Button.tsx
│   │   ├── Avatar.tsx
│   │   ├── Tag.tsx
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   ├── Skeleton.tsx
│   │   └── LevelBar.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx                   # Server Component
│   │   ├── BottomNav.tsx                 # 'use client' — usePathname
│   │   ├── Topbar.tsx                    # Server Component
│   │   ├── ThemeToggle.tsx               # 'use client' — Zustand
│   │   └── SuperadminBanner.tsx          # Server Component — banner de contexto
│   ├── club/
│   │   ├── ClubCard.tsx                  # Server Component
│   │   ├── ClubGrid.tsx                  # Server Component
│   │   ├── MapView.tsx                   # 'use client' — Mapbox/Leaflet
│   │   └── CourtDiagram.tsx              # 'use client' — SVG interactivo
│   ├── booking/
│   │   ├── BookingWizard.tsx             # 'use client' — wizard 3 pasos (jugador)
│   │   ├── ManualBookingForm.tsx         # 'use client' — wizard 4 pasos (admin)
│   │   ├── BookingGrid.tsx               # 'use client' — grilla con ResizeObserver
│   │   ├── DatePicker.tsx                # 'use client'
│   │   ├── TimePicker.tsx                # 'use client'
│   │   ├── DurationSelector.tsx          # 'use client' — 60/90/120 min
│   │   └── BookingSummary.tsx            # Server Component
│   ├── bar/
│   │   ├── BarCaja.tsx                   # 'use client' — grilla productos + ticket
│   │   ├── BarInventario.tsx             # 'use client' — CRUD productos + alertas stock
│   │   ├── BarHistorial.tsx              # Server Component (o client con datos pasados)
│   │   └── BarProductCard.tsx            # 'use client' — tarjeta de producto en caja
│   ├── community/
│   │   ├── MatchProposal.tsx             # 'use client'
│   │   ├── OpenMatchCard.tsx             # Server Component
│   │   ├── RankingRow.tsx                # Server Component
│   │   └── PlayerChip.tsx                # Server Component
│   └── profile/
│       ├── StreakCalendar.tsx             # Server Component
│       └── AchievementCard.tsx           # Server Component
│
├── actions/
│   ├── auth.ts                           # register, login, logout, acceptInvitation
│   ├── booking.ts                        # createBooking, createManualBooking, cancelBooking
│   ├── club.ts                           # getClubs, getClub
│   ├── openMatch.ts                      # publishMatch, joinMatch
│   ├── profile.ts                        # updateProfile, loadMatchResult
│   ├── owner/
│   │   ├── courts.ts                     # createCourt, updateCourt, toggleCourt
│   │   ├── availability.ts               # Config horarios por cancha/día
│   │   ├── bookings.ts                   # createManualBooking, cancelBooking
│   │   ├── staff.ts                      # inviteStaff, removeStaff
│   │   ├── bar.ts                        # createBarSale (tx: venta + stock),
│   │   │                                 #   createBarProduct, updateBarProduct,
│   │   │                                 #   toggleBarProduct
│   │   └── config.ts                     # updateClubConfig
│   └── superadmin/
│       ├── clubs.ts                      # createClub, updateClub, toggleActive
│       ├── users.ts                      # cancelUserBooking, resetPassword,
│       │                                 #   deactivateUser, banUser, unbanUser
│       └── audit.ts                      # getAuditLogs (lectura)
│
├── lib/
│   ├── auth.ts                           # generateTokens, getSession, requireAuth,
│   │                                     #   requireRole, requireSuperAdmin
│   ├── cookies.ts                        # setAuthCookies, clearAuthCookies
│   ├── prisma.ts                         # Prisma v7 client singleton
│   ├── audit.ts                          # createAuditLog — siempre dentro de tx Prisma
│   ├── email.ts                          # wrapper Resend: invitación, confirmación,
│   │                                     #   recordatorio, reset password
│   ├── availability.ts                   # Calcular TimeSlots disponibles para (courtId, date)
│   ├── analytics.ts                      # calcularIngresos(clubId, period),
│   │                                     #   calcularOcupacion(clubId, period),
│   │                                     #   calcularHorariosPico(clubId, period)
│   │                                     #   NOTA: framework-agnostic (sin next/headers)
│   ├── achievements.ts                   # Evaluar y desbloquear logros
│   └── level.ts                          # Cálculo Elo adaptado 1.0–10.0
│
├── store/
│   └── themeStore.ts                     # Zustand: 'dark' | 'light'
│
├── types/
│   └── index.ts                          # Tipos derivados + interfaces auxiliares
│
├── prisma/
│   ├── schema.prisma                     # Schema completo (§5)
│   ├── migrations/                       # Migraciones versionadas
│   └── seed.ts                           # 1 SUPERADMIN + 2 OWNERs + 2 clubes +
│                                         #   canchas + availability + 5 PLAYERs + logros +
│                                         #   ~16 BarProducts por club (4 categorías)
│
├── proxy.ts                              # En raíz — JWT + ban check + role guards (Next.js 16)
├── tailwind.config.ts                    # Design system tokens
├── next.config.ts
├── tsconfig.json                         # strict: true
├── docker-compose.yml
├── .env.local                            # Variables locales (no commitear)
├── .env.example                          # Template de variables
└── CONTEXT.md                            # Este archivo
```

---

## 15. PALETA DE COLORES COMPLETA

### Obsidian Dark — `:root` (default)

```css
--color-bg:           #080808;
--color-surface:      #111111;
--color-card:         #161616;
--color-card-hover:   #1c1c1c;
--color-border:       #242424;
--color-border-hover: #383838;
--color-accent:       #d4f000;
--color-accent-dark:  #b8d400;
--color-accent-text:  #080808;
--color-accent-glow:  rgba(212, 240, 0, 0.12);
--color-text:         #f2f2f2;
--color-muted:        #777777;
--color-sub:          #444444;
--color-tag:          #1a1a00;
--color-tag-text:     #d4f000;
--color-tag-border:   #2a2a00;
```

### Obsidian Light — `[data-theme="light"]`

```css
--color-bg:           #f5f5f0;
--color-surface:      #ebebeb;
--color-card:         #ffffff;
--color-card-hover:   #f9f9f4;
--color-border:       #e0e0d8;
--color-border-hover: #c8c8c0;
--color-accent:       #8aa000;    /* lima oscura — contraste sobre fondo claro */
--color-accent-dark:  #728800;
--color-accent-text:  #ffffff;
--color-accent-glow:  rgba(138, 160, 0, 0.15);
--color-text:         #141414;
--color-muted:        #666666;
--color-sub:          #999999;
--color-tag:          #f0f4d0;
--color-tag-text:     #6a8000;
--color-tag-border:   #d8e490;
```

**Implementación del toggle de tema:**
```typescript
// store/themeStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

interface ThemeStore {
  theme: Theme
  toggle: () => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      toggle: () => set((s) => ({
        theme: s.theme === 'dark' ? 'light' : 'dark'
      })),
    }),
    { name: 'padelgo-theme' }
  )
)

// En ThemeToggle.tsx ('use client'):
// Al montar → document.documentElement.setAttribute('data-theme', theme)
// Al togglear → mismo setAttribute
```

---

## 16. VARIABLES DE ENTORNO

```bash
# .env.example

# Base de datos
DATABASE_URL="postgresql://padelgo:padelgo_dev@localhost:5432/padelgo"

# JWT — generar con: openssl rand -base64 64
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."

# Tokens de invitación y reset — generar con: openssl rand -base64 32
INVITATION_SECRET="..."
RESET_PASSWORD_SECRET="..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Mapas (elegir uno)
NEXT_PUBLIC_MAPBOX_TOKEN="..."

# Email — Resend
RESEND_API_KEY="..."
EMAIL_FROM="noreply@padelgo.ar"
EMAIL_SUPPORT="soporte@padelgo.ar"

# Mercado Pago (Sprint 7)
MP_ACCESS_TOKEN="..."
MP_PUBLIC_KEY="..."
MP_WEBHOOK_SECRET="..."
```

---

## 17. NOTAS PARA CLAUDE EN EL IDE

### Cómo referenciar este documento en prompts

```
"Usando CONTEXT.md §5, implementá la Server Action createBooking en actions/booking.ts
con las reglas de §9, TypeScript strict, transacción Prisma anti double-booking,
retornando ActionResult<Booking>"
```

```
"Siguiendo §11 Sprint 2, implementá el sistema completo de auth JWT:
lib/auth.ts + lib/cookies.ts + proxy.ts + Server Actions de login/registro.
Usar jose para JWT, bcryptjs para contraseñas, cookies httpOnly.
Recordar: en Next.js 16 el archivo es proxy.ts y la función exportada es proxy()"
```

```
"Creá el componente DurationSelector ('use client') según UC-01 de §6.
Muestra solo las duraciones (60/90/120) que caben antes del closeTime del turno.
Tailwind con tokens de §4.3, duración 90 min seleccionada por defecto"
```

```
"Implementá lib/availability.ts: dado un courtId y una date, retorna TimeSlot[].
Genera slots entre openTime y closeTime del CourtAvailability del día,
marca como available=false los que tienen Booking confirmado en ese horario,
y calcula durationOptions[] para cada slot según el tiempo restante hasta closeTime"
```

### Prioridades de código

1. **TypeScript strict** — no usar `any`, tipar todo con los tipos de `types/index.ts`
2. **Server Components por defecto** — `'use client'` solo donde hay state local o event handlers del DOM
3. **Server Actions para mutaciones** — nunca hacer fetch a rutas propias desde el cliente
4. **Tailwind con tokens** — `bg-bg`, `text-accent`, `border-border` (nunca hex hardcodeados)
5. **Mobile-first** — base=mobile, `md:` tablet, `lg:` desktop
6. **Error handling** — Server Actions retornan `ActionResult<T>`, nunca throwean al cliente
7. **Transacciones Prisma** — para toda operación que toque múltiples tablas (booking, logros, nivel)
8. **Accesibilidad** — `aria-label` en botones icónicos, `role="navigation"` en nav, `focus-visible`

### Patrón estándar de Server Action

```typescript
// actions/booking.ts
'use server'
import { requireAuth } from '@/lib/auth'
import { prisma }      from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'

export async function createBooking(
  data: CreateBookingInput
): Promise<ActionResult<{ bookingId: string }>> {
  const session = await requireAuth()   // redirect automático si no autenticado

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // 1. Verificar disponibilidad
      // 2. Crear Booking
      // 3. Evaluar logros
      // 4. Actualizar racha
      return booking
    })

    revalidatePath('/historial')
    revalidatePath(`/club/${data.clubId}`)

    return { success: true, data: { bookingId: booking.id } }
  } catch (error) {
    return { success: false, error: 'No se pudo completar la reserva' }
  }
}
```

### Patrón estándar de Server Component con datos

```typescript
// app/(public)/buscar/page.tsx
import { getClubs } from '@/actions/club'
import { ClubGrid } from '@/components/club/ClubGrid'
import { Suspense }  from 'react'

export default async function BuscarPage({
  searchParams
}: {
  searchParams: { q?: string; zona?: string; techado?: string }
}) {
  const clubs = await getClubs(searchParams)   // fetch directo a DB, sin useEffect

  return (
    <Suspense fallback={<ClubGridSkeleton />}>
      <ClubGrid clubs={clubs} />
    </Suspense>
  )
}
```

---

*PadelGo CONTEXT.md v3.4*
*Stack: Next.js 16.1.6 App Router · TypeScript strict · Prisma v7 · PostgreSQL · Docker · Tailwind · JWT cookies · Vercel*
*Tipografía: Bebas Neue (display) + DM Sans (body) + DM Mono (precios/tiempos)*
*Temas: Obsidian Dark + Obsidian Light*
*Roles: SUPERADMIN · OWNER · STAFF · PLAYER*
*Módulos: App Jugador · Dashboard Admin · Bar · Analytics · Panel Superadmin*
*Próxima revisión: al completar Sprint 2 (Auth)*
