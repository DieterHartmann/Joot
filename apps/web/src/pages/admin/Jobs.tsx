import { useState } from 'react'
import Layout from '../../components/Layout'
import { triggerAccrual, triggerExpiryWarnings } from '../../api'

interface JobCard {
  title:       string
  description: string
  trigger:     () => Promise<void>
}

const JOBS: JobCard[] = [
  {
    title:       'Leave Accrual',
    description: 'Credits each active employee with their monthly leave entitlement (maxDaysPerYear ÷ 12). Skips employees not yet started and balances already accrued this calendar month.',
    trigger:     triggerAccrual,
  },
  {
    title:       'Expiry Warnings',
    description: 'Scans all leave balances expiring within 30 or 7 days and emails affected employees. Will not re-send if a warning was already sent in the last 5 days.',
    trigger:     triggerExpiryWarnings,
  },
]

function JobRow({ job }: { job: JobCard }) {
  const [running, setRunning] = useState(false)
  const [msg,     setMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  async function run() {
    setRunning(true)
    setMsg(null)
    try {
      await job.trigger()
      setMsg({ ok: true, text: 'Job enqueued — check worker logs for progress.' })
    } catch (err: any) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="job-card">
      <div className="job-card-body">
        <h3 className="job-title">{job.title}</h3>
        <p className="job-desc">{job.description}</p>
        {msg && (
          <p className={msg.ok ? 'form-success' : 'form-error'} style={{ margin: '8px 0 0' }}>
            {msg.text}
          </p>
        )}
      </div>
      <div className="job-card-action">
        <button className="btn-primary" onClick={run} disabled={running}>
          {running ? 'Enqueuing…' : 'Run now'}
        </button>
      </div>
    </div>
  )
}

export default function Jobs() {
  return (
    <Layout>
      <div className="page-header">
        <h1>Background Jobs</h1>
      </div>
      <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '0.9rem' }}>
        These jobs run automatically on schedule. Use the buttons below to trigger them manually for testing or ad-hoc runs.
      </p>
      <div className="job-list">
        {JOBS.map(j => <JobRow key={j.title} job={j} />)}
      </div>
    </Layout>
  )
}
