import { db, type DbClient } from './client.js'

// POST-PoC: dynamic schema-per-tenant requires migrating away from Prisma's
// @@schema annotations to unqualified table names + SET LOCAL search_path.
// With @@schema("subsidiary"), Prisma hard-codes the schema name in SQL and
// SET search_path cannot override it.
//
// When that migration is done, this factory will accept pgSchema and wrap
// every query in: SET LOCAL search_path TO "<pgSchema>", public
//
// For the PoC, one subsidiary exists in the "subsidiary" schema and this
// factory returns the shared client unchanged.
export function getTenantClient(_pgSchema: string): DbClient {
  return db
}
