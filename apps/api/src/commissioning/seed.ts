import { randomUUID } from 'crypto'
import { db, syncTreePath } from '@joot/db'
import { auth } from '../auth.js'
import type { ParsedData } from './parse.js'

// Topological sort: parents before children, detects circular refs.
function topoSortDepts(depts: { name: string; parentName: string | null }[]) {
  const sorted: typeof depts = []
  const remaining = [...depts]
  const placed    = new Set<string>()

  while (remaining.length) {
    const before = remaining.length
    for (let i = remaining.length - 1; i >= 0; i--) {
      const d = remaining[i]
      if (!d.parentName || placed.has(d.parentName)) {
        sorted.push(d)
        placed.add(d.name)
        remaining.splice(i, 1)
      }
    }
    if (remaining.length === before) {
      throw new Error(
        `Circular department references: ${remaining.map(d => d.name).join(', ')}`
      )
    }
  }
  return sorted
}

export interface SeedResult {
  departments:     number
  leaveTypes:      number
  employees:       number
  openingBalances: number
}

export async function seedCommissioning(
  data: ParsedData,
  subsidiaryId: string,
): Promise<SeedResult> {
  // ── Pre-flight: check for conflicts in the DB ─────────────────────────────
  const emailList = data.employees.map(e => e.email)
  const existingBaUsers = await (db as any).baUser.findMany({
    where:  { email: { in: emailList } },
    select: { email: true, id: true },
  })

  if (existingBaUsers.length) {
    // Distinguish real conflicts (BaUser + subsidiary User exists) from orphans
    // left by a previous failed commissioning attempt (BaUser only, no subsidiary User).
    const existingSubUsers = await db.user.findMany({
      where:  { email: { in: existingBaUsers.map((u: any) => u.email) }, subsidiaryId },
      select: { email: true },
    })

    if (existingSubUsers.length) {
      throw new Error(
        `These emails already exist in this subsidiary: ${existingSubUsers.map(u => u.email).join(', ')}`
      )
    }

    // Orphaned BaUser records from a previous failed upload — clean them up and proceed.
    const orphanIds = existingBaUsers.map((u: any) => u.id)
    const deleted = await (db as any).baUser.deleteMany({ where: { id: { in: orphanIds } } })
    console.info(`[commissioning] auto-cleaned ${deleted.count} orphaned BaUser record(s) before retry`)
  }

  // ── Step 1: Create Better Auth users (outside Prisma transaction) ─────────
  // auth.api.signUpEmail writes to its own BaUser/BaSession tables.
  // We collect IDs so we can clean up if the transaction below fails.
  const authUserIds: string[] = []

  try {
    for (const emp of data.employees) {
      const result = await auth.api.signUpEmail({
        body:    { email: emp.email, name: emp.fullName, password: emp.password },
        headers: new Headers(),
      })
      authUserIds.push(result.user.id)

      await (db as any).baUser.update({
        where: { id: result.user.id },
        data:  { subsidiaryId, role: emp.role },
      })
    }
  } catch (err) {
    if (authUserIds.length) {
      await (db as any).baUser.deleteMany({ where: { id: { in: authUserIds } } })
        .catch((cleanupErr: Error) =>
          console.error(`[commissioning] BaUser cleanup failed after Step 1 error: ${cleanupErr.message}`)
        )
    }
    throw err
  }

  // ── Step 2: Prisma transaction — departments, leave types, users, balances ─
  try {
    const counts = await db.$transaction(async (tx) => {
      // Departments — topological order so parents exist before children
      const deptIdMap: Record<string, string> = {}
      const sorted = topoSortDepts(data.departments)

      for (const dept of sorted) {
        const id       = randomUUID()
        const parentId = dept.parentName ? deptIdMap[dept.parentName] : null
        deptIdMap[dept.name] = id

        await tx.department.create({
          data: {
            id,
            subsidiaryId,
            name:               dept.name,
            parentDepartmentId: parentId,
            treePath:           id,       // placeholder — syncTreePath will fix
            treePathLabel:      dept.name,
            treeDepth:          0,
          },
        })

        // syncTreePath walks the parent chain; passing tx so it sees uncommitted rows
        await syncTreePath(tx as any, id)
      }

      // Approver IDs are resolved after employees exist — populated below

      // Leave types
      const ltIdMap: Record<string, string> = {}

      for (const lt of data.leaveTypes) {
        const id = randomUUID()
        ltIdMap[lt.name] = id
        await tx.leaveType.create({
          data: {
            id,
            subsidiaryId,
            name:                 lt.name,
            category:             lt.category as any,
            maxDaysPerYear:       lt.maxDaysPerYear,
            allowNegative:        lt.allowNegative,
            expiryMonths:         lt.expiryMonths,
            requiresDualApproval: lt.requiresDualApproval,
            bceaProtected:        lt.bceaProtected,
            active:               true,
          },
        })
      }

      // Employees — map email → subsidiary user id
      const empIdMap: Record<string, string> = {}

      for (const emp of data.employees) {
        const id     = randomUUID()
        const deptId = emp.departmentName ? deptIdMap[emp.departmentName] : null
        empIdMap[emp.email] = id

        await tx.user.create({
          data: {
            id,
            email:        emp.email,
            fullName:     emp.fullName,
            subsidiaryId,
            departmentId: deptId ?? null,
            role:         emp.role as any,
            startDate:    new Date(emp.startDate),
            ctc:          emp.ctc,
          },
        })
      }

      // Wire department approvers now that empIdMap is populated
      for (const dept of data.departments) {
        const id = deptIdMap[dept.name]
        const defaultApproverId = dept.defaultApproverEmail ? empIdMap[dept.defaultApproverEmail] : undefined
        const apexApproverId    = dept.apexApproverEmail    ? empIdMap[dept.apexApproverEmail]    : undefined
        if (defaultApproverId || apexApproverId) {
          await tx.department.update({
            where: { id },
            data:  { defaultApproverId, apexApproverId },
          })
        }
      }

      // Opening balances
      for (const bal of data.openingBalances) {
        await tx.leaveBalance.create({
          data: {
            id:              randomUUID(),
            userId:          empIdMap[bal.employeeEmail],
            leaveTypeId:     ltIdMap[bal.leaveTypeName],
            accrued:         bal.openingBalance,
            used:            0,
            balance:         bal.openingBalance,
            accrualRate:     0,
            lastAccrualDate: new Date(),
          },
        })
      }

      return {
        departments:     sorted.length,
        leaveTypes:      data.leaveTypes.length,
        employees:       data.employees.length,
        openingBalances: data.openingBalances.length,
      }
    })

    return counts
  } catch (err) {
    if (authUserIds.length) {
      await (db as any).baUser.deleteMany({ where: { id: { in: authUserIds } } })
        .catch((cleanupErr: Error) =>
          console.error(`[commissioning] BaUser cleanup failed after transaction rollback: ${cleanupErr.message}`)
        )
    }
    throw err
  }
}
