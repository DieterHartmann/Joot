import ExcelJS from 'exceljs'
import { SHEETS, type ColDef } from './columns.js'

function parseCell(cell: ExcelJS.Cell, col: ColDef, sheetName: string, rowNum: number): unknown {
  let raw = cell.value

  // ExcelJS formula cells: use the result
  if (raw !== null && typeof raw === 'object' && 'result' in (raw as any)) {
    raw = (raw as any).result
  }

  const isEmpty = raw === null || raw === undefined || raw === ''

  if (isEmpty) {
    if (col.required) {
      throw new Error(`Sheet "${sheetName}" row ${rowNum}: "${col.header.replace(' *', '')}" is required`)
    }
    return col.default !== undefined ? col.default : null
  }

  const str = String(raw).trim()

  switch (col.type) {
    case 'string':
      return str

    case 'number': {
      const n = Number(str)
      if (isNaN(n)) throw new Error(
        `Sheet "${sheetName}" row ${rowNum}: "${col.header.replace(' *', '')}" must be a number, got "${str}"`
      )
      return n
    }

    case 'boolean': {
      const lower = str.toLowerCase()
      if (lower === 'yes') return true
      if (lower === 'no')  return false
      throw new Error(
        `Sheet "${sheetName}" row ${rowNum}: "${col.header.replace(' *', '')}" must be yes or no, got "${str}"`
      )
    }

    case 'date': {
      // ExcelJS can return a Date object directly for date-formatted cells
      if (raw instanceof Date) return raw.toISOString().slice(0, 10)
      const d = new Date(str)
      if (isNaN(d.getTime())) throw new Error(
        `Sheet "${sheetName}" row ${rowNum}: "${col.header.replace(' *', '')}" must be a valid date (YYYY-MM-DD), got "${str}"`
      )
      return d.toISOString().slice(0, 10)
    }

    case 'enum': {
      if (!col.values?.includes(str)) throw new Error(
        `Sheet "${sheetName}" row ${rowNum}: "${col.header.replace(' *', '')}" must be one of [${col.values?.join(', ')}], got "${str}"`
      )
      return str
    }
  }
}

// ── Typed parsed shapes ────────────────────────────────────────────────────────

export interface ParsedDept    { name: string; parentName: string | null; defaultApproverEmail: string | null; apexApproverEmail: string | null }
export interface ParsedLT      { name: string; category: string; maxDaysPerYear: number | null; allowNegative: boolean; expiryMonths: number | null; requiresDualApproval: boolean; bceaProtected: boolean }
export interface ParsedEmployee { fullName: string; email: string; password: string; role: string; departmentName: string | null; startDate: string; ctc: number }
export interface ParsedBalance  { employeeEmail: string; leaveTypeName: string; openingBalance: number }

export interface ParsedData {
  departments:     ParsedDept[]
  leaveTypes:      ParsedLT[]
  employees:       ParsedEmployee[]
  openingBalances: ParsedBalance[]
  errors:          string[]
}

// ── Main parser ───────────────────────────────────────────────────────────────

export async function parseUpload(buffer: Buffer): Promise<ParsedData> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as any)

  const result: ParsedData = {
    departments: [], leaveTypes: [], employees: [], openingBalances: [], errors: [],
  }

  for (const sheetDef of SHEETS) {
    const ws = wb.getWorksheet(sheetDef.name)
    if (!ws) {
      result.errors.push(`Sheet "${sheetDef.name}" not found — do not rename sheets`)
      continue
    }

    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return // skip header

      // Skip fully empty rows
      const allEmpty = sheetDef.columns.every((_, i) => {
        const v = row.getCell(i + 1).value
        return v === null || v === undefined || v === ''
      })
      if (allEmpty) return

      try {
        const parsed: Record<string, unknown> = {}
        for (let i = 0; i < sheetDef.columns.length; i++) {
          const col = sheetDef.columns[i]
          parsed[col.key] = parseCell(row.getCell(i + 1), col, sheetDef.name, rowNum)
        }

        switch (sheetDef.name) {
          case 'Departments':
            result.departments.push({
              name:                 parsed.name as string,
              parentName:           (parsed.parent_name as string | null) || null,
              defaultApproverEmail: (parsed.default_approver_email as string | null) || null,
              apexApproverEmail:    (parsed.apex_approver_email as string | null) || null,
            })
            break

          case 'Leave Types':
            result.leaveTypes.push({
              name:                 parsed.name as string,
              category:             parsed.category as string,
              maxDaysPerYear:       parsed.max_days_per_year as number | null,
              allowNegative:        (parsed.allow_negative ?? false) as boolean,
              expiryMonths:         parsed.expiry_months as number | null,
              requiresDualApproval: (parsed.requires_dual_approval ?? false) as boolean,
              bceaProtected:        (parsed.bcea_protected ?? false) as boolean,
            })
            break

          case 'Employees':
            result.employees.push({
              fullName:       parsed.full_name as string,
              email:          (parsed.email as string).toLowerCase(),
              password:       parsed.password as string,
              role:           parsed.role as string,
              departmentName: (parsed.department_name as string | null) || null,
              startDate:      parsed.start_date as string,
              ctc:            parsed.ctc as number,
            })
            break

          case 'Opening Balances':
            result.openingBalances.push({
              employeeEmail:  (parsed.employee_email as string).toLowerCase(),
              leaveTypeName:  parsed.leave_type_name as string,
              openingBalance: parsed.opening_balance as number,
            })
            break
        }
      } catch (err: any) {
        result.errors.push(err.message)
      }
    })
  }

  // ── Cross-sheet reference validation ───────────────────────────────────────
  if (result.errors.length === 0) {
    const deptNames = new Set(result.departments.map(d => d.name))
    const ltNames   = new Set(result.leaveTypes.map(l => l.name))
    const empEmails = new Set(result.employees.map(e => e.email))

    // Circular / missing parent references
    for (const dept of result.departments) {
      if (dept.parentName && !deptNames.has(dept.parentName)) {
        result.errors.push(`Department "${dept.name}": parent "${dept.parentName}" not found in Departments sheet`)
      }
    }

    // Employee → Department references
    for (const emp of result.employees) {
      if (emp.departmentName && !deptNames.has(emp.departmentName)) {
        result.errors.push(`Employee "${emp.email}": department "${emp.departmentName}" not in Departments sheet`)
      }
    }

    // Department approver email references
    for (const dept of result.departments) {
      if (dept.defaultApproverEmail && !empEmails.has(dept.defaultApproverEmail)) {
        result.errors.push(`Department "${dept.name}": line manager email "${dept.defaultApproverEmail}" not in Employees sheet`)
      }
      if (dept.apexApproverEmail && !empEmails.has(dept.apexApproverEmail)) {
        result.errors.push(`Department "${dept.name}": apex approver email "${dept.apexApproverEmail}" not in Employees sheet`)
      }
    }

    // Opening balance → Employee/LeaveType references
    for (const bal of result.openingBalances) {
      if (!empEmails.has(bal.employeeEmail)) {
        result.errors.push(`Opening balance: employee "${bal.employeeEmail}" not in Employees sheet`)
      }
      if (!ltNames.has(bal.leaveTypeName)) {
        result.errors.push(`Opening balance: leave type "${bal.leaveTypeName}" not in Leave Types sheet`)
      }
    }

    // Detect circular department parent chains
    const visited = new Set<string>()
    const detectCycle = (name: string, chain: string[]): boolean => {
      if (chain.includes(name)) return true
      if (visited.has(name))   return false
      visited.add(name)
      const dept = result.departments.find(d => d.name === name)
      if (dept?.parentName) return detectCycle(dept.parentName, [...chain, name])
      return false
    }
    for (const dept of result.departments) {
      if (detectCycle(dept.name, [])) {
        result.errors.push(`Department "${dept.name}": circular parent reference detected`)
      }
    }
  }

  return result
}
