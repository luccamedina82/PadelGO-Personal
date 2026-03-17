// Server Component — reads session + user data, passes to NavbarClient
import { getSession } from '@/actions/auth'
import prisma from '@/lib/prisma'
import NavbarClient from './NavbarClient'

export default async function Navbar() {
  const session = await getSession()

  let user: { name: string; avatarColor: string; zone: string; level: number } | null = null
  if (session) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, avatarColor: true, zone: true, level: true },
    })
    user = dbUser ?? null
  }

  return <NavbarClient session={session} user={user} />
}
