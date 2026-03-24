# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (webpack mode, not turbopack)
pnpm build        # Production build
pnpm lint         # ESLint check
pnpm prisma studio  # Prisma Studio GUI

# Database
pnpm prisma migrate dev    # Apply migrations
pnpm prisma generate       # Regenerate client after schema changes
pnpm prisma db seed        # Run prisma/seed.ts (uses tsx + dotenv)
```

Required env vars: `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`.

## Architecture

### Route Groups

```
app/
  (auth)/         # Authenticated player routes: open-match, historial, perfil, ranking
  (owner)/admin/  # Club owner/staff management: reservas, canchas, horarios, bar, analytics
  (superadmin)/   # Global admin: users, clubs management, audit log
  login/, registro/  # Public auth pages
  _club/[id]/     # Public club detail page
  api/            # Webhooks (MercadoPago), cron (booking reminders), auth/refresh
```

### Feature Structure

Domain logic is organized under `features/<domain>/`:

```
features/
  auth/
    actions/auth.ts          # Source of truth (actions/auth.ts re-exports from here)
    actions/passwordReset.ts # Password reset flow (requestPasswordReset, resetPassword)
  reservas/
    actions/bookings.ts      # All booking mutations + fetchBookingsAction
    dal/bookings.ts          # getAdminBookingsByDate (use cache)
    dal/courts.ts            # getCourtsByClubId (use cache)
    hooks/useBookings.ts     # React Query mutations
    components/
      booking-grid/          # BookingGrid + sub-components
      weekly-booking-grid/   # WeeklyBookingGrid + sub-components
      manual-booking-wizard/ # ManualBookingWizard + Step1/2/3
```

Re-export stubs exist at the old paths (`actions/auth.ts`, `actions/owner/bookings.ts`, `hooks/useBookings.ts`, `lib/dal/booking.ts`, `lib/dal/court.ts`) for backwards compatibility — do not remove them.

### Auth System (custom JWT, not NextAuth)

Two-layer split by runtime:

- **`lib/auth.ts`** — Pure Node.js functions (bcrypt, JWT sign/verify). Zero Next.js imports. Used from Server Actions and API routes.
- **`lib/auth.edge.ts`** — Edge-runtime subset using only `jose`. Used exclusively by `proxy.ts` for route protection.
- **`features/auth/actions/auth.ts`** — Boundary layer (`'use server'`). Reads cookies, calls `lib/auth.ts`, handles login/logout/register. Exports `getSession()`, `requireAuth()`, `requireRole(roles[])`.
- **`actions/auth.ts`** — Re-export shim kept for backwards compatibility (~40 files import from here).

Access tokens: 15 min JWT in httpOnly cookie. Refresh tokens: SHA-256 hashed opaque token stored in DB, 7 days.

**`isActive` not in JWT:** A disabled user can still use the app until the 15-min token expires. This is an accepted tradeoff for stateless JWT — no action needed.

**Password Reset flow:** Uses the `Invitation` model for storing reset tokens. `requestPasswordReset` creates an `Invitation` with a SHA-256 hashed token and sends an email via `sendPasswordReset()`. `resetPassword` verifies the token, updates the password with bcrypt, and marks `acceptedAt`. The `Invitation.clubId` FK uses the first available club as a workaround (reset lookups always use `tokenHash`, never `clubId`).

Ghost users (`isGhost: true`) are placeholder accounts with no password, created when an owner manually adds a player who doesn't have an account yet.

### Data Access Layer (DAL)

`lib/dal/*.ts` and `features/*/dal/*.ts` — Server-only data fetching functions. These use Next.js `'use cache'` with `cacheTag` and `cacheLife` for ISR-style caching. Always call these from Server Components/pages, never from Client Components.

`lib/dal/admin.ts` exports `getAdminContext(roles[])` — the standard entrypoint for all owner/staff pages. Returns `{ session, club, hasClub }`.

**Cache pattern:** DAL functions tag their cache with `cacheTag('bookings-${clubId}')` or `cacheTag('courts-${clubId}')`. Server Actions that mutate data **must** call `revalidateTag(tag)` in addition to `revalidatePath()`. Using only `revalidatePath()` does NOT invalidate `'use cache'` function results.

```typescript
// Correct pattern in a Server Action:
import { revalidatePath, revalidateTag } from 'next/cache'
revalidateTag(`bookings-${clubId}`)
revalidatePath('/admin/reservas')
```

### Server Actions

`actions/auth.ts`, `actions/booking.ts`, `actions/owner/*.ts`, `actions/superadmin/*.ts` — All marked `'use server'`. Always return `ActionResult<T>` (see `types/index.ts`), never throw to the client.

### Client Data Fetching

React Query (`@tanstack/react-query`) is used exclusively for client-side mutations and polling. The booking grid (`BookingsClient`) uses `useQuery` with `initialData` from SSR and `refetchInterval: 30000`. Mutations live in `hooks/useBookings.ts`.

Cross-component refresh is coordinated via a custom DOM event: `window.dispatchEvent(new CustomEvent('reservas:refresh', { detail: { bookingId } }))`.

### Booking Grid System

The reservas page (`app/(owner)/admin/reservas/`) uses parallel routes for the "new booking" modal:
- `@modal/(.)nueva/` — intercepted route rendered as a modal overlay
- `ReservasPage` (Server Component) fetches initial data and passes it to `BookingsClient` (Client Component)
- `BookingsClient` manages React Query state and renders `ReservasShell` → `BookingGrid` or `WeeklyBookingGrid`

### Prisma Setup

Prisma client is generated to `app/generated/prisma/` (not the default location). Always import from `@/app/generated/prisma/client` in `lib/prisma.ts`. Uses `PrismaPg` adapter with a `pg.Pool` for connection pooling (Neon-compatible).

After any schema change: `pnpm prisma generate` then restart the dev server.

### Types

`types/index.ts` is the single source of truth for all TypeScript types. Enums here mirror Prisma enums but are plain TypeScript (`type Role = 'SUPERADMIN' | 'OWNER' | 'STAFF' | 'PLAYER'`). `ActionResult<T>` is the standard return type for all Server Actions.

### Critical Conventions

**Dates/Timezone:** All `Booking.date` values are stored as UTC midnight. The app's business timezone is `America/Argentina/Buenos_Aires` (UTC-3). Always use helpers from `lib/date.ts`:
- `argTodayStr()` for "today" as a string
- `argToday()` for "today" as a Date
- `toUtcDateStr(date)` to convert DB dates to display strings
- Never use `new Date().getDate()` or `.setHours(0,0,0,0)` directly — these break near midnight ARG time.

**Prices:** All monetary values are stored in **centavos** (integer), not pesos. Display by dividing by 100.

**Roles:** `SUPERADMIN` > `OWNER` > `STAFF` > `PLAYER`. STAFF users have a `staffClubId` on their JWT session. `getAdminContext` resolves the club for both OWNER (by `ownerId`) and STAFF (by `staffClubId`).

### Component Size Convention

Keep components under ~200 lines. When a component grows beyond that, extract sub-components into subdirectories following the existing pattern (e.g. `BookingGrid/BookingBlockCell/BookingBlockCell.tsx`). Shared helpers and types live in `helpers/` and `types/` within the component's directory.

### UI Stack

- Tailwind CSS v4 with `tailwind-merge` (`clsx` + `twMerge` for conditional classes)
- Zustand (`store/themeStore.ts`) for dark/light theme
- shadcn/ui (installed, Tailwind v4 compatible) — `components.json` at root, `lib/utils.ts` with `cn()`
- `components/ui/` — shared primitives backed by shadcn: `button`, `dialog`, `badge`, `skeleton`, `sonner`
- `features/reservas/components/` — booking components: `booking-grid/`, `weekly-booking-grid/`, `manual-booking-wizard/`
- Spanish UI — all user-facing text is in Spanish (es-AR locale)

**shadcn/ui conventions:**
- Install new components with `pnpm dlx shadcn@latest add <component>` — they land in `components/ui/` as lowercase files.
- Always import using **lowercase paths**: `@/components/ui/button`, `@/components/ui/skeleton`, etc. Using uppercase causes TS1149 casing errors on Windows.
- Use `cn()` from `@/lib/utils` for conditional classes (replaces raw `clsx`).

**CSS variable bridge:** `globals.css` maps shadcn's semantic tokens to our design tokens:
- `--primary` → `var(--accent)` (lime yellow brand color)
- `--background` → `var(--bg)`, `--foreground` → `var(--text)`
- `--muted` → `var(--surface)` (shadcn muted = bg), `--muted-foreground` → `var(--muted)` (shadcn muted-foreground = text)
- Our custom tokens (`--bg`, `--card`, `--accent`, `--border`, `--text`, `--muted`, etc.) remain unchanged and are used directly in custom components.

**Components:** shadcn-backed: `Button`, `Skeleton`, `Badge`, `Modal` (Dialog), `Toast` (sonner). Custom (kept as-is): `Avatar`, `Tag`, `LevelBar`, `PrintButton`, `DateRangePicker`.
