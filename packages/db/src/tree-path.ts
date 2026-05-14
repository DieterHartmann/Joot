import type { DbClient } from './client.js'

// Walks up the parent chain from deptId and builds the full materialised path.
// treePath  = UUID segments joined by '.' — stable across renames
// treePathLabel = name segments joined by '.' — human-readable proxy
async function buildPath(
  client: DbClient,
  deptId: string,
): Promise<{ treePath: string; treePathLabel: string; treeDepth: number }> {
  const segments: { id: string; name: string }[] = []
  let currentId: string | null = deptId

  while (currentId !== null) {
    const dept = await client.department.findUniqueOrThrow({
      where: { id: currentId },
      select: { id: true, name: true, parentDepartmentId: true },
    })
    segments.unshift({ id: dept.id, name: dept.name })
    currentId = dept.parentDepartmentId
  }

  return {
    treePath:      segments.map((s) => s.id).join('.'),
    treePathLabel: segments.map((s) => s.name).join('.'),
    treeDepth:     segments.length - 1,
  }
}

/**
 * Rebuilds treePath and treePathLabel for a department and every descendant.
 * Call after any rename OR reparent. Not idempotent-safe to skip — the label
 * path can silently drift if callers forget to call this.
 */
export async function syncTreePath(client: DbClient, departmentId: string): Promise<void> {
  const before = await client.department.findUniqueOrThrow({
    where:  { id: departmentId },
    select: { treePath: true },
  })

  const newPath = await buildPath(client, departmentId)

  await client.department.update({
    where: { id: departmentId },
    data:  newPath,
  })

  // Descendants: their treePath starts with the OLD path + '.'
  const descendants = await client.department.findMany({
    where:  { treePath: { startsWith: before.treePath + '.' } },
    select: { id: true },
  })

  // Rebuild each descendant independently — correct even for deep renames
  await Promise.all(
    descendants.map(async (desc) => {
      const path = await buildPath(client, desc.id)
      await client.department.update({
        where: { id: desc.id },
        data:  path,
      })
    }),
  )
}
