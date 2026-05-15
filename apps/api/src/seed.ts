import { db } from '@joot/db'
import { auth } from './auth.js'

const env = (key: string, fallback?: string): string => {
  const val = process.env[key] ?? fallback
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

async function seed() {
  const holdingName  = env('HOLDING_COMPANY_NAME', 'Joot Holdings')
  const subName      = env('SUBSIDIARY_NAME',      'Main Subsidiary')
  const adminEmail   = env('ADMIN_EMAIL')
  const adminPass    = env('ADMIN_PASSWORD')
  const adminName    = env('ADMIN_NAME', 'System Admin')

  // Idempotency: holding company + admin both exist → fully seeded, skip.
  // Holding company exists but no admin → partial seed, continue from admin step.
  let holdingCompany = await db.holdingCompany.findFirst()
  let subsidiary     = holdingCompany
    ? await db.subsidiary.findFirst({ where: { holdingCompanyId: holdingCompany.id } })
    : null

  const existingAdmin = await (db as any).baUser.findFirst({ where: { role: 'holding_admin' } })
  if (holdingCompany && existingAdmin) {
    console.log('Already seeded — skipping.')
    return
  }

  if (!holdingCompany) {
    holdingCompany = await db.holdingCompany.create({
      data: { name: holdingName, schemaName: 'public' },
    })
    console.log('HoldingCompany:', holdingCompany.id)
  } else {
    console.log('HoldingCompany already exists:', holdingCompany.id)
  }

  if (!subsidiary) {
    subsidiary = await db.subsidiary.create({
      data: {
        holdingCompanyId: holdingCompany.id,
        name:             subName,
        pgSchema:         'subsidiary',
        leaveYearType:    'calendar',
        timezone:         'Africa/Johannesburg',
      },
    })
    console.log('Subsidiary:', subsidiary.id)
  } else {
    console.log('Subsidiary already exists:', subsidiary.id)
  }

  // Better Auth handles password hashing — do not hash manually
  const result = await auth.api.signUpEmail({
    body: { email: adminEmail, name: adminName, password: adminPass },
    headers: new Headers(),
  }) as { user: { id: string; email: string } }

  // Set holding_admin role — no subsidiaryId (holding admins span all subsidiaries)
  await (db as any).baUser.update({
    where: { id: result.user.id },
    data:  { role: 'holding_admin' },
  })

  console.log('Admin user:', result.user.id, adminEmail)
  console.log('Seed complete.')
}

seed()
  .then(() => process.exit(0))
  .catch((err: Error) => { console.error('Seed failed:', err.message); process.exit(1) })
