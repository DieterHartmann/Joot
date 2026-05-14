import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { auth, type Session } from '../auth.js'

declare module 'fastify' {
  interface FastifyRequest {
    session: Session
  }
}

function buildHeaders(req: FastifyRequest): Headers {
  const headers = new Headers()
  for (const [key, val] of Object.entries(req.headers)) {
    if (Array.isArray(val)) val.forEach(v => headers.append(key, v))
    else if (val !== undefined) headers.set(key, val)
  }
  return headers
}

// Exported so route files can compose them as preHandler arrays.
export async function requireSession(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session) {
    reply.code(401).send({ error: 'Unauthorized' })
  }
}

export function requireRole(...roles: string[]) {
  return async function(req: FastifyRequest, reply: FastifyReply) {
    if (!req.session) {
      reply.code(401).send({ error: 'Unauthorized' })
      return
    }
    const userRole = (req.session.user as any).role as string | undefined
    if (!userRole || !roles.includes(userRole)) {
      reply.code(403).send({ error: 'Forbidden' })
    }
  }
}

export default fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('session', null)

  // Resolve session for every request that isn't a Better Auth route or health check.
  // auth.api.getSession validates the session token against the database.
  app.addHook('preHandler', async (req: FastifyRequest) => {
    if (req.url.startsWith('/api/auth/') || req.url === '/health') return
    req.session = await auth.api.getSession({ headers: buildHeaders(req) })
  })

  // Proxy all /api/auth/* traffic to the Better Auth handler.
  app.all('/api/auth/*', async (req: FastifyRequest, reply: FastifyReply) => {
    const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:4000'
    const url = new URL(req.url, baseUrl).toString()

    const response = await auth.handler(
      new Request(url, {
        method:  req.method,
        headers: buildHeaders(req),
        body:
          req.method !== 'GET' && req.method !== 'HEAD'
            ? JSON.stringify(req.body)
            : undefined,
      }),
    )

    reply.status(response.status)
    // Forward all response headers except content-encoding (Fastify handles compression)
    response.headers.forEach((val, key) => {
      if (key.toLowerCase() !== 'content-encoding') reply.header(key, val)
    })

    const text = await response.text()
    return text ? reply.send(text) : reply.send()
  })
})
