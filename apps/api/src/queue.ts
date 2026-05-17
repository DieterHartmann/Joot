import { createQueue } from '@joot/queue'

// Queue is a no-op if REDIS_URL is absent (e.g. local dev without Redis).
// Jobs are silently dropped rather than crashing the API.
const redisUrl = process.env.REDIS_URL

const _queue = redisUrl ? createQueue(redisUrl) : null

export const queue = _queue
