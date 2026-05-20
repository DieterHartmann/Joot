import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { getAuditLog, type AuditEvent } from '../../api'

const PAGE = 50

const ENTITY_TYPES = [
  { value: '',               label: 'All types' },
  { value: 'leave_request',  label: 'Leave requests' },
  { value: 'leave_balance',  label: 'Leave balances' },
  { value: 'approval_step',  label: 'Approvals' },
]

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function humanEventType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function humanEntityType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function StateSnapshot({ state }: { state: Record<string, unknown> | null }) {
  if (!state || Object.keys(state).length === 0) return <span className="text-muted">—</span>
  return (
    <dl className="audit-state">
      {Object.entries(state).map(([k, v]) => (
        <div key={k}>
          <dt>{k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}</dt>
          <dd>{String(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function AuditLog() {
  const [rows,       setRows]       = useState<AuditEvent[]>([])
  const [loading,    setLoading]    = useState(true)
  const [entityType, setEntityType] = useState('')
  const [page,       setPage]       = useState(0)
  const [expanded,   setExpanded]   = useState<string | null>(null)

  async function load(et: string, p: number) {
    setLoading(true)
    const data = await getAuditLog({ entityType: et || undefined, limit: PAGE, offset: p * PAGE })
    setRows(data)
    setLoading(false)
  }

  useEffect(() => { load(entityType, page) }, [entityType, page])

  function handleFilter(et: string) {
    setEntityType(et)
    setPage(0)
    setExpanded(null)
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Audit Log</h1>
        <div className="page-header-actions">
          <select
            value={entityType}
            onChange={e => handleFilter(e.target.value)}
            className="filter-select"
          >
            {ENTITY_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? <div className="page-loading">Loading…</div> : (
        <>
          <div className="table-wrap">
            <table className="admin-table audit-table">
              <thead><tr>
                <th style={{ whiteSpace: 'nowrap' }}>Date / time</th>
                <th>Entity</th>
                <th>Event</th>
                <th>Actor</th>
                <th></th>
              </tr></thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="empty-cell">No audit events found</td></tr>
                )}
                {rows.map(row => (
                  <>
                    <tr
                      key={row.id}
                      className={expanded === row.id ? 'audit-row-expanded' : 'audit-row'}
                      onClick={() => setExpanded(e => e === row.id ? null : row.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(row.createdAt)}</td>
                      <td><span className="text-muted">{humanEntityType(row.entityType)}</span></td>
                      <td><strong>{humanEventType(row.eventType)}</strong></td>
                      <td>
                        <span>{row.actor.fullName}</span>
                        <span className="text-muted" style={{ display: 'block', fontSize: '0.8em' }}>{row.actor.email}</span>
                      </td>
                      <td className="expand-icon">{expanded === row.id ? '▲' : '▼'}</td>
                    </tr>
                    {expanded === row.id && (
                      <tr key={`${row.id}-detail`} className="audit-detail-row">
                        <td colSpan={5}>
                          <div className="audit-detail">
                            {row.beforeState && (
                              <div>
                                <span className="audit-label">Before</span>
                                <StateSnapshot state={row.beforeState} />
                              </div>
                            )}
                            <div>
                              <span className="audit-label">After</span>
                              <StateSnapshot state={row.afterState} />
                            </div>
                            <div>
                              <span className="audit-label">Entity ID</span>
                              <code className="entity-id">{row.entityId}</code>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button className="btn-ghost btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
              ‹ Previous
            </button>
            <span className="page-label">Page {page + 1}</span>
            <button className="btn-ghost btn-sm" onClick={() => setPage(p => p + 1)} disabled={rows.length < PAGE}>
              Next ›
            </button>
          </div>
        </>
      )}
    </Layout>
  )
}
