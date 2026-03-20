import { getAdminContext } from '@/lib/dal/admin'
import { cacheLife, cacheTag, revalidatePath, revalidateTag } from 'next/cache'

const getData = async () => {
  'use cache'
  cacheTag('data-prueba') // Etiqueta esta función para que su caché pueda ser invalidada por otras funciones que usen la misma etiqueta
  cacheLife('days')
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return { message: 'Hola, mundo!', timestamp: new Date().toISOString() }
}

const handleRefresh = async () => {
  'use server'
    revalidateTag('data-prueba', 'max') // Invalida la caché de cualquier función etiquetada con 'data-prueba', forzando a que se vuelva a ejecutar en la próxima llamada
    revalidatePath('/admin/pruebas-cache')
}

export default async function PruebasCache() {
  const { session } = await getAdminContext(['OWNER', 'STAFF'])
  console.log(session)

  const data = await getData()

  return (
    <div>
      <p>{data.message}</p>
      <p>Tiempo: {data.timestamp}</p>
      <form action={handleRefresh}>
        <button className="bg-accent text-accent-text font-semibold text-sm px-4 py-2 rounded-lg hover:bg-accent-dark transition-colors">
          Actualizar
        </button>
      </form>
    </div>
  )
}
