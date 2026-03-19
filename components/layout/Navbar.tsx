// Server Component — reads session + user data, passes to NavbarClient
import { getSessionAndUserProfile } from '@/actions/auth'
import NavbarClient from './NavbarClient'

export default async function Navbar() {
  const { session, user } = await getSessionAndUserProfile()

  return <NavbarClient session={session} user={user} />
}
