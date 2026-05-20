import Fastify from 'fastify'
import authPlugin from './plugins/auth.plugin.js'
import healthRoutes      from './routes/health.js'
import meRoutes          from './routes/me.js'
import subsidiaryRoutes  from './routes/subsidiaries.js'
import userRoutes        from './routes/users.js'
import departmentRoutes  from './routes/departments.js'
import leaveTypeRoutes   from './routes/leave-types.js'
import leaveBalanceRoutes from './routes/leave-balances.js'
import leaveRequestRoutes from './routes/leave-requests.js'
import approvalRoutes    from './routes/approvals.js'
import deputyRoutes      from './routes/deputies.js'
import holidayRoutes     from './routes/holidays.js'
import auditRoutes       from './routes/audit.js'
import accrualRoutes     from './routes/accrual.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  })

  // Auth plugin must be registered first — it installs the session decorator
  // and the global preHandler hook that resolves the session on every request.
  await app.register(authPlugin)

  await app.register(healthRoutes)
  await app.register(meRoutes)
  await app.register(subsidiaryRoutes)
  await app.register(userRoutes)
  await app.register(departmentRoutes)
  await app.register(leaveTypeRoutes)
  await app.register(leaveBalanceRoutes)
  await app.register(leaveRequestRoutes)
  await app.register(approvalRoutes)
  await app.register(deputyRoutes)
  await app.register(holidayRoutes)
  await app.register(auditRoutes)
  await app.register(accrualRoutes)

  return app
}
