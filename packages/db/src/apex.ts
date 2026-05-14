import type { DbClient } from './client.js'

const today = (): Date => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Resolves the active deputy for a user, if any.
 * Temporary overrides take precedence over permanent assignments.
 * Returns the original userId if no active deputy exists.
 */
export async function resolveDeputy(client: DbClient, userId: string): Promise<string> {
  const active = await client.deputyAssignment.findFirst({
    where: {
      userId,
      validFrom: { lte: today() },
      OR: [{ validTo: null }, { validTo: { gte: today() } }],
    },
    // Temporary overrides sort first (true > false)
    orderBy: { isTemporaryOverride: 'desc' },
    select: { deputyId: true },
  })

  return active?.deputyId ?? userId
}

/**
 * Walks up the department tree from departmentId looking for the nearest
 * apex_approver_id. Falls back to the subsidiary's HR Director if none is
 * found before the root. Deputy substitution is applied to the resolved
 * approver before returning.
 *
 * The result is written to approval_step at submission time and never
 * re-resolved — call this only when creating the approval chain.
 */
export async function resolveApexApprover(
  client: DbClient,
  departmentId: string,
  subsidiaryId: string,
): Promise<string> {
  let currentId: string | null = departmentId

  while (currentId !== null) {
    const dept = await client.department.findUniqueOrThrow({
      where:  { id: currentId },
      select: { apexApproverId: true, parentDepartmentId: true },
    })

    if (dept.apexApproverId !== null) {
      return resolveDeputy(client, dept.apexApproverId)
    }

    currentId = dept.parentDepartmentId
  }

  // No apex found in the tree — HR Director is the fallback apex of last resort
  const hrDirector = await client.user.findFirst({
    where:  { subsidiaryId, role: 'hr_director' },
    select: { id: true },
  })

  if (!hrDirector) {
    throw new Error(
      `resolveApexApprover: no apex_approver_id in department tree and no HR Director found for subsidiary ${subsidiaryId}`,
    )
  }

  return resolveDeputy(client, hrDirector.id)
}
