import type { DbClient } from './client.js'

/**
 * Enforces the reciprocal deputy constraint:
 * if A has B as deputy, B cannot have A as deputy.
 *
 * Call before any DeputyAssignment create or update.
 * Throws if the constraint would be violated.
 */
export async function assertNoReciprocalDeputy(
  client: DbClient,
  userId: string,
  deputyId: string,
): Promise<void> {
  const reciprocal = await client.deputyAssignment.findFirst({
    where:  { userId: deputyId, deputyId: userId },
    select: { id: true },
  })

  if (reciprocal) {
    throw new Error(
      `Reciprocal deputy assignment forbidden: ` +
      `user ${deputyId} is already assigned as deputy for user ${userId}. ` +
      `A cannot be B's deputy if B is already A's deputy.`,
    )
  }
}
