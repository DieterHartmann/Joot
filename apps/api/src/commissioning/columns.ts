// Single source of truth for the commissioning spreadsheet schema.
// generate.ts reads this to build the XLSX template.
// parse.ts reads this to extract and validate uploaded data.
// Add a column here → it appears in the template AND gets parsed automatically.

export const LEAVE_CATEGORIES = [
  'annual', 'sick', 'parental', 'maternity',
  'compassionate', 'family_responsibility', 'custom',
] as const

export const EMPLOYEE_ROLES = [
  'employee', 'manager', 'hr_director', 'ceo', 'subsidiary_admin',
] as const

export const BOOL_VALUES = ['yes', 'no'] as const

export type ColType = 'string' | 'number' | 'boolean' | 'date' | 'enum'

export interface ColDef {
  key:      string
  header:   string
  type:     ColType
  values?:  readonly string[]
  required: boolean
  width:    number
  note?:    string
  default?: string          // used when cell is blank and field is optional
  example?: string          // shown in example row in the template
}

export interface SheetDef {
  name:        string
  description: string
  columns:     ColDef[]
}

export const SHEETS: SheetDef[] = [
  {
    name:        'Departments',
    description: 'Define your organisational structure. Parents must appear above their children.',
    columns: [
      {
        key: 'name', header: 'Name *', type: 'string', required: true, width: 30,
        note:    'Department name. Must be unique within this file.',
        example: 'Finance',
      },
      {
        key: 'parent_name', header: 'Parent Name', type: 'string', required: false, width: 30,
        note:    'Name of the parent department (must appear in this sheet). Leave blank for top-level.',
        example: '',
      },
    ],
  },
  {
    name:        'Leave Types',
    description: 'Define the types of leave your company offers.',
    columns: [
      {
        key: 'name', header: 'Name *', type: 'string', required: true, width: 28,
        note: 'Leave type name. Must be unique within this file.',
        example: 'Annual Leave',
      },
      {
        key: 'category', header: 'Category *', type: 'enum', required: true, width: 24,
        values:  LEAVE_CATEGORIES,
        note:    `Must be one of: ${LEAVE_CATEGORIES.join(', ')}`,
        example: 'annual',
      },
      {
        key: 'max_days_per_year', header: 'Max Days/Year', type: 'number', required: false, width: 16,
        note:    'Leave blank for unlimited. Also used as the monthly accrual basis (value ÷ 12).',
        example: '21',
      },
      {
        key: 'allow_negative', header: 'Allow Negative', type: 'boolean', required: false, width: 16,
        values: BOOL_VALUES, default: 'no',
        note:    'yes or no. Allows employees to take leave before sufficient balance accrues.',
        example: 'no',
      },
      {
        key: 'expiry_months', header: 'Expiry Months', type: 'number', required: false, width: 15,
        note:    'Leave blank for no expiry. Number of months after accrual before balance expires.',
        example: '',
      },
      {
        key: 'requires_dual_approval', header: 'Dual Approval', type: 'boolean', required: false, width: 15,
        values: BOOL_VALUES, default: 'no',
        note:    'yes or no. Requires both line manager and apex approver sign-off.',
        example: 'no',
      },
      {
        key: 'bcea_protected', header: 'BCEA Protected', type: 'boolean', required: false, width: 15,
        values: BOOL_VALUES, default: 'no',
        note:    'yes or no. Marks this as a legally protected leave type under BCEA.',
        example: 'yes',
      },
    ],
  },
  {
    name:        'Employees',
    description: 'One row per employee. Temporary passwords — employees must change on first login.',
    columns: [
      {
        key: 'full_name', header: 'Full Name *', type: 'string', required: true, width: 28,
        note: 'Employee\'s full name as it will appear throughout the system.',
        example: 'Jane Smith',
      },
      {
        key: 'email', header: 'Email *', type: 'string', required: true, width: 34,
        note:    'Must be unique. Used as login credential.',
        example: 'jane.smith@company.com',
      },
      {
        key: 'password', header: 'Temp Password *', type: 'string', required: true, width: 18,
        note:    'Temporary password. Employee must change this on first login.',
        example: 'Change@Me1',
      },
      {
        key: 'role', header: 'Role *', type: 'enum', required: true, width: 20,
        values:  EMPLOYEE_ROLES,
        note:    `Must be one of: ${EMPLOYEE_ROLES.join(', ')}`,
        example: 'employee',
      },
      {
        key: 'department_name', header: 'Department', type: 'string', required: false, width: 28,
        note:    'Must match a name in the Departments sheet exactly.',
        example: 'Finance',
      },
      {
        key: 'start_date', header: 'Start Date *', type: 'date', required: true, width: 14,
        note:    'Format: YYYY-MM-DD',
        example: '2024-01-15',
      },
      {
        key: 'ctc', header: 'CTC (Annual) *', type: 'number', required: true, width: 16,
        note:    'Annual cost-to-company in your currency. Used for payroll reporting only.',
        example: '450000',
      },
    ],
  },
  {
    name:        'Opening Balances',
    description: 'Optional. For companies migrating mid-year — seed existing leave balances.',
    columns: [
      {
        key: 'employee_email', header: 'Employee Email *', type: 'string', required: true, width: 34,
        note:    'Must match an email in the Employees sheet.',
        example: 'jane.smith@company.com',
      },
      {
        key: 'leave_type_name', header: 'Leave Type *', type: 'string', required: true, width: 28,
        note:    'Must match a name in the Leave Types sheet exactly.',
        example: 'Annual Leave',
      },
      {
        key: 'opening_balance', header: 'Opening Balance *', type: 'number', required: true, width: 18,
        note:    'Days to credit. This is the balance the employee starts with in Joot.',
        example: '10.5',
      },
    ],
  },
]
