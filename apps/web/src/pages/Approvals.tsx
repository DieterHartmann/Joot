import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { approveStep, getPendingApprovals, rejectStep, type PendingApprovalStep } from '../api'

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Approvals() {
  const [steps, setSteps]     = useState<PendingApprovalStep[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState<string | null>(null)
  const [notesModal, setNotesModal] = useState<{ stepId: string; action: 'approve' | 'reject' } | null>(null)
  const [notes, setNotes]     = useState('')
  const [error, setError]     = useState('')

  async function load() {
    setLoading(true)
    setSteps(await getPendingApprovals())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNotes(stepId: string, action: 'approve' | 'reject') {
    setNotes('')
    setError('')
    setNotesModal({ stepId, action })
  }

  async function handleDecision() {
    if (!notesModal) return
    const { stepId, action } = notesModal
    setActing(stepId)
    setError('')
    try {
      if (action === 'approve') await approveStep(stepId, notes || undefined)
      else await rejectStep(stepId, notes || undefined)
      setNotesModal(null)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActing(null)
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Pending Approvals</h1>
      </div>

      {loading ? <div className="page-loading">Loading…</div> : (
        steps.length === 0
          ? <div className="page-notice">No pending approvals — you're all caught up.</div>
          : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead><tr>
                  <th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Step</th><th></th>
                </tr></thead>
                <tbody>
                  {steps.map(s => {
                    const lr = s.leaveRequest
                    return (
                      <tr key={s.id}>
                        <td>{lr.user.fullName}</td>
                        <td>{lr.leaveType.name}</td>
                        <td>{fmt(lr.startDate)}</td>
                        <td>{fmt(lr.endDate)}</td>
                        <td>{Number(lr.daysCalculated)}</td>
                        <td><span className="role-badge">step {s.sequence}</span></td>
                        <td className="action-cell">
                          <button
                            className="btn-primary btn-sm"
                            disabled={acting === s.id}
                            onClick={() => openNotes(s.id, 'approve')}
                          >Approve</button>
                          <button
                            className="btn-ghost btn-sm"
                            style={{ marginLeft: '0.5rem' }}
                            disabled={acting === s.id}
                            onClick={() => openNotes(s.id, 'reject')}
                          >Reject</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
      )}

      {notesModal && (
        <div className="modal-overlay" onClick={() => setNotesModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{notesModal.action === 'approve' ? 'Approve request' : 'Reject request'}</h2>
            <label>Notes (optional)
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                style={{ resize: 'vertical' }}
                autoFocus
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setNotesModal(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                disabled={acting !== null}
                onClick={handleDecision}
              >
                {acting ? 'Saving…' : notesModal.action === 'approve' ? 'Confirm approve' : 'Confirm reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
