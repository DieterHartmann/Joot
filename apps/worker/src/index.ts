import { createWorker } from '@joot/queue'
import { processJob } from './handlers.js'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) throw new Error('REDIS_URL is required')

const worker = createWorker(redisUrl, processJob)

worker.on('completed', job => {
  console.log(`[worker] job ${job.id} (${(job.data as any).type}) completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.id} (${(job?.data as any)?.type}) failed:`, err.message)
})

console.log('[worker] started — waiting for jobs on queue "joot"')

// Graceful shutdown
async function shutdown() {
  console.log('[worker] shutting down…')
  await worker.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)
