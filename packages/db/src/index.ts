export { db, type DbClient } from './client.js'
export { getTenantClient } from './tenant.js'
export { syncTreePath } from './tree-path.js'
export { resolveApexApprover, resolveDeputy } from './apex.js'
export { assertNoReciprocalDeputy } from './deputy.js'

// Re-export generated Prisma types for consumers
export { PrismaClient } from '@prisma/client'
export * from '@prisma/client'
