import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { db } from '@joot/db'

// Better Auth expects to access models as client.user, client.session, etc.
// Our Prisma schema names those models BaUser, BaSession, etc. (to avoid a
// naming collision with the subsidiary-schema User model accessed as db.user).
// This Proxy remaps the four model names at the point of access.
const authDb = new Proxy(db as any, {
  get(target: any, prop: string) {
    const remap: Record<string, string> = {
      user:         'baUser',
      session:      'baSession',
      account:      'baAccount',
      verification: 'baVerification',
    }
    const alias = remap[prop]
    return alias !== undefined ? target[alias] : target[prop]
  },
})

export const auth = betterAuth({
  baseURL:  process.env.BETTER_AUTH_URL    ?? 'http://localhost:4000',
  basePath: '/api/auth',
  secret:   process.env.BETTER_AUTH_SECRET ?? 'dev-secret-CHANGE-ME-in-production',
  database: prismaAdapter(authDb, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      // Embedded in session so routes don't need an extra DB lookup per request.
      subsidiaryId: { type: 'string', required: false, fieldName: 'subsidiaryId' },
      role:         { type: 'string', required: false, fieldName: 'role' },
    },
  },
})

export type Auth    = typeof auth
export type Session = Awaited<ReturnType<typeof auth.api.getSession>>
