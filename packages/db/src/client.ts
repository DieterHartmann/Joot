import { PrismaClient } from '@prisma/client'

const APPEND_ONLY = 'audit_event is append-only'

const makeClient = () =>
  new PrismaClient().$extends({
    query: {
      auditEvent: {
        update:       async () => { throw new Error(`${APPEND_ONLY}: update() is forbidden`) },
        updateMany:   async () => { throw new Error(`${APPEND_ONLY}: updateMany() is forbidden`) },
        delete:       async () => { throw new Error(`${APPEND_ONLY}: delete() is forbidden`) },
        deleteMany:   async () => { throw new Error(`${APPEND_ONLY}: deleteMany() is forbidden`) },
        upsert:       async () => { throw new Error(`${APPEND_ONLY}: upsert() is forbidden`) },
      },
    },
  })

export type DbClient = ReturnType<typeof makeClient>

// Singleton — one client per process
export const db: DbClient = makeClient()
