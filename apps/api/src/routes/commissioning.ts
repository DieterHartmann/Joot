import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { requireRole } from '../plugins/auth.plugin.js'
import { generateTemplate } from '../commissioning/generate.js'
import { parseUpload } from '../commissioning/parse.js'
import { seedCommissioning } from '../commissioning/seed.js'

export default async function commissioningRoutes(app: FastifyInstance) {
  // GET /api/commissioning/template?subsidiaryId=...
  // Streams a freshly generated XLSX. All sheet structure comes from columns.ts.
  app.get(
    '/api/commissioning/template',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin')] },
    async (req, reply) => {
      const sessionSubId = (req.session!.user as any).subsidiaryId as string | undefined
      const qSubId       = (req.query as any).subsidiaryId         as string | undefined
      const subId        = qSubId ?? sessionSubId ?? ''

      const sub  = subId ? await db.subsidiary.findUnique({ where: { id: subId }, select: { name: true } }) : null
      const name = sub?.name ?? 'Company'

      const buf      = await generateTemplate(name)
      const filename = `joot-template-${name.toLowerCase().replace(/\s+/g, '-')}.xlsx`

      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
      return reply.send(buf)
    },
  )

  // POST /api/commissioning/upload (multipart, field name: "file")
  app.post(
    '/api/commissioning/upload',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin')] },
    async (req, reply) => {
      const sessionSubId = (req.session!.user as any).subsidiaryId as string | undefined
      const data         = await (req as any).file()

      if (!data) return reply.code(400).send({ error: 'No file uploaded' })

      const chunks: Buffer[] = []
      for await (const chunk of data.file) chunks.push(chunk)
      const buffer = Buffer.concat(chunks)

      // Parse
      const parsed = await parseUpload(buffer)
      if (parsed.errors.length) return reply.code(422).send({ errors: parsed.errors })
      if (!parsed.departments.length && !parsed.leaveTypes.length && !parsed.employees.length) {
        return reply.code(422).send({ errors: ['Spreadsheet appears empty — no data rows found'] })
      }

      // Determine which subsidiary to seed into
      const subId = (req.body as any)?.subsidiaryId ?? sessionSubId
      if (!subId) return reply.code(400).send({ error: 'subsidiaryId required' })

      // Seed
      try {
        const counts = await seedCommissioning(parsed, subId)
        return reply.send({ success: true, ...counts })
      } catch (err: any) {
        return reply.code(422).send({ errors: [err.message] })
      }
    },
  )
}
