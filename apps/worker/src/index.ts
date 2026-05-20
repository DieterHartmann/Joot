import { createQueue, createWorker } from '@joot/queue'
import { processJob } from './handlers.js'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) throw new Error('REDIS_URL is required')

const worker = createWorker(redisUrl, processJob)
const queue  = createQueue(redisUrl)

worker.on('completed', job => {
  console.log(`[worker] job ${job.id} (${(job.data as any).type}) completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.id} (${(job?.data as any)?.type}) failed:`, err.message)
})

// Register monthly accrual cron — 00:05 on the 1st of every month.
// BullMQ deduplicates by name + pattern so restarts don't stack up jobs.
queue.add(
  'run-accrual-cron',
  { type: 'run-accrual', payload: { triggeredBy: 'cron' } },
  { repeat: { pattern: '5 0 1 * *' } },
).then(() => {
  console.log('[worker] accrual cron registered (5 0 1 * *)')
}).catch(err => {
  console.error('[worker] failed to register accrual cron:', err.message)
})

console.log('[worker] started — waiting for jobs on queue "joot"')

// Graceful shutdown
async function shutdown() {
  console.log('[worker] shutting down…')
  await worker.close()
  await queue.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)
