import ExcelJS from 'exceljs'
import { SHEETS, BOOL_VALUES } from './columns.js'

const BRAND_COLOR  = 'FF4F46E5' // indigo-600
const EXAMPLE_FILL = 'FFF5F3FF' // indigo-50
const EXAMPLE_FONT = '55000000' // 33% black — visually muted

export async function generateTemplate(subsidiaryName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'Joot Leave Management'
  wb.created  = new Date()
  wb.modified = new Date()

  // ── Instructions sheet (first) ─────────────────────────────────────────────
  const intro = wb.addWorksheet('Instructions')
  intro.getColumn(1).width = 90

  const titleCell = intro.getRow(1).getCell(1)
  titleCell.value = `Joot Commissioning Template — ${subsidiaryName}`
  titleCell.font  = { bold: true, size: 14, color: { argb: BRAND_COLOR } }

  const instructions = [
    '',
    'This workbook seeds all initial data for your company in Joot.',
    '',
    'SHEETS — fill in this order:',
    '  1. Departments      — your org chart. Parent names must appear before their children.',
    '  2. Leave Types      — the types of leave your company offers.',
    '  3. Employees        — all staff members. Departments must match the Departments sheet.',
    '  4. Opening Balances — (optional) starting balances for companies migrating mid-year.',
    '',
    'RULES:',
    '  • Columns marked with * are required.',
    '  • The shaded example row on each sheet shows the expected format — delete or overwrite it.',
    '  • Department and Leave Type names must be unique.',
    '  • Employee emails must be unique.',
    '  • Dates must be in YYYY-MM-DD format.',
    '  • Do not rename or delete any sheets or column headers.',
    '',
    'Upload via Admin → Commissioning once filled in.',
    '',
    `Template generated: ${new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}`,
  ]

  instructions.forEach((line, i) => {
    const cell = intro.getRow(i + 2).getCell(1)
    cell.value = line
    cell.font  = { size: 11, color: { argb: '55111827' } }
  })

  // ── Data sheets ────────────────────────────────────────────────────────────
  for (const sheet of SHEETS) {
    const ws = wb.addWorksheet(sheet.name, {
      views: [{ state: 'frozen', ySplit: 1 }],
    })

    // Column widths (must be set before rows)
    ws.columns = sheet.columns.map(col => ({ key: col.key, width: col.width }))

    // ── Header row (row 1) ────────────────────────────────────────────────
    const headerRow = ws.getRow(1)
    headerRow.height = 22

    sheet.columns.forEach((col, i) => {
      const cell        = headerRow.getCell(i + 1)
      cell.value        = col.header
      cell.fill         = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLOR } } as any
      cell.font         = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      cell.alignment    = { vertical: 'middle', horizontal: 'left', wrapText: false }
      if (col.note) cell.note = { texts: [{ text: col.note }] }
    })

    // ── Example row (row 2) ────────────────────────────────────────────────
    const exampleRow = ws.getRow(2)
    exampleRow.height = 18

    sheet.columns.forEach((col, i) => {
      if (!col.example) return
      const cell     = exampleRow.getCell(i + 1)
      cell.value     = col.example
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXAMPLE_FILL } } as any
      cell.font      = { italic: true, color: { argb: EXAMPLE_FONT }, size: 10 }
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
    })

    // ── Data validations (rows 2–1001) ─────────────────────────────────────
    sheet.columns.forEach((col, i) => {
      const letter = ws.getColumn(i + 1).letter
      const range  = `${letter}2:${letter}1001`

      if (col.type === 'enum' && col.values?.length) {
        (ws as any).dataValidations.add(range, {
          type:             'list',
          allowBlank:       !col.required,
          formulae:         [`"${col.values.join(',')}"`],
          showErrorMessage: true,
          errorTitle:       'Invalid value',
          error:            `Must be one of: ${col.values.join(', ')}`,
        })
      }

      if (col.type === 'boolean') {
        (ws as any).dataValidations.add(range, {
          type:             'list',
          allowBlank:       true,
          formulae:         [`"${BOOL_VALUES.join(',')}"`],
          showErrorMessage: true,
          errorTitle:       'Invalid value',
          error:            'Must be yes or no',
        })
      }
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
