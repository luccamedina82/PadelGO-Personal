
# TODOS:
 1-[x] mudar a shadcn — BLOQUEADO: no migrar hasta que shadcn estabilice soporte para Tailwind v4 (ver CLAUDE.md). Reevaluar cuando sea necesario un componente complejo (DatePicker, DataTable) o cuando la rama v4 sea estable.
 2-[x] cuando cambio de dia en el calendario de reservas, que exista un spinner hasta que termine de cargarse enteras las reservas.
      → Implementado: barra de progreso animada (accent) en la parte superior del grid, visible cuando `isFetching` de React Query es true (BookingsClient.tsx).
 3-[x] revisar el data fresh, stale y fetching de react query y cada cuanto se hace, es la manera mas optimizada eficiente?
      → Fix: `staleTime` cambiado de 0 a 30_000ms. Agregado `initialDataUpdatedAt: Date.now()` para que los datos SSR se traten como frescos al montar. Esto elimina el refetch redundante inmediato al navegar entre dias. El polling cada 30s via `refetchInterval` sigue funcionando normalmente.
 4-[x] una reserva deberia tener dos estados cobrado o sin cobrado, a que hace referencia MANUAL?
      → MANUAL en PaymentStatus = cobrado manualmente (efectivo, transferencia en el club), a diferencia de PAID = cobrado online via MercadoPago. Implementado: el boton "$ Cobrado" ahora setea MANUAL para reservas con source MANUAL_OWNER/MANUAL_SUPPORT, y PAID para reservas online. El chip en el grid ya mostraba "Manual" en gris (BookingBlockCell). La condicion de visibilidad del boton se actualizo para ocultar "$ Cobrado" si paymentStatus es PAID o MANUAL.
 5-[x] revisa el proyecto, vamos a mudar a shadcn, leyendo documentacion de shadcn aparece que es estable en la version 4 de tailwind. usa context7 y las skills de shadcn
      → Implementado: `components.json` creado, `lib/utils.ts` con `cn()`. CSS bridge vars añadidas en `globals.css` (--background, --foreground, --primary, etc.) mapeando a nuestros design tokens (--bg, --text, --accent). shadcn `button`, `dialog`, `badge`, `skeleton`, `sonner` instalados via CLI. Componentes reemplazados:
        • Button.tsx → shadcn Button (default variant = bg-primary = lime yellow, loading prop preservado)
        • Skeleton.tsx → shadcn Skeleton (bg-surface, + SkeletonText/ClubCardSkeleton mantenidos)
        • Badge.tsx → shadcn Badge base + ProjectBadge default export con nuestras variantes (accent, green, yellow, red, muted, purple)
        • Modal.tsx → shadcn Dialog (Radix UI, accesible, animado, Escape key, aria)
        • Toast.tsx → compat layer sobre sonner (misma API useToast/show, Toaster global en layout)
        • Componentes mantenidos custom: Avatar, Tag, LevelBar, PrintButton, DateRangePicker
        → Deps añadidas: radix-ui, sonner, next-themes, class-variance-authority, lucide-react. Imports normalizados a lowercase en 20 archivos.

 6-[ ] mejorar el flujo de nueva reserva, no se ve bien del todo, que sea mas paso a paso.
 7-[ ] mejorar contraste en el tema claro.