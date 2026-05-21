import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { getLiabilityReport, getLeaveTransactions, type LiabilityRow, type LeaveTransaction } from '../../api'
import { useSubsidiary } from '../../SubsidiaryContext'

function fmt(n: number) { return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

type Tab = 'liability' | 'transactions'

export default function Reports() {
  const { subsidiary } = useSubsidiary()
  const subId = subsidiary?.id

  const [tab,          setTab]          = useState<Tab>('liability')
  const [excludeBcea,  setExcludeBcea]  = useState(false)
  const [liabilityData, setLiability]  = useState<{ rows: LiabilityRow[]; summary: any } | null>(null)
  const [txMonth,      setTxMonth]      = useState(currentMonth())
  const [txData,       setTxData]       = useState<{ rows: LeaveTransaction[]; total: number } | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  async function loadLiability() {
    setLoading(true); setError('')
    try { setLiability(await getLiabilityReport(subId, excludeBcea)) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function loadTransactions() {
    setLoading(true); setError('')
    try { setTxData(await getLeaveTransactions(txMonth, subId)) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (tab === 'liability') loadLiability() }, [tab, excludeBcea, subId])
  useEffect(() => { if (tab === 'transactions') loadTransactions() }, [tab, txMonth, subId])

  return (
    <Layout>
      <div className="page-header">
        <h1>Reports</h1>
      </div>

      {/* Tab bar */}
      <div className="report-tabs">
        <button className={`report-tab ${tab === 'liability'     ? 'active' : ''}`} onClick={() => setTab('liability')}>Leave Liability</button>
        <button className={`report-tab ${tab === 'transactions'  ? 'active' : ''}`} onClick={() => setTab('transactions')}>Leave Transactions</button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {/* ── Liability ──────────────────────────────────────────────────────── */}
      {tab === 'liability' && (
        <>
          <div className="report-toolbar">
            <label className="check-label">
              <input type="checkbox" checked={excludeBcea} onChange={e => setExcludeBcea(e.target.checked)} />
              Exclude BCEA-protected leave types
            </label>
          </div>

          {liabilityData && (
            <div className="liability-summary">
              <div className="liability-stat">
                <span className="liability-stat-label">Total liability days</span>
                <span className="liability-stat-value">{fmt(liabilityData.summary.totalDays)}</span>
              </div>
              <div className="liability-stat">
                <span className="liability-stat-label">Total monetary liability</span>
                <span className="liability-stat-value">R {fmt(liabilityData.summary.totalMonetary)}</span>
              </div>
              <div className="liability-stat">
                <span className="liability-stat-label">Daily rate basis</span>
                <span className="liability-stat-value">{liabilityData.summary.workingDaysPerYear} days / year</span>
              </div>
            </div>
          )}

          {loading ? <div className="page-loading">Loading…</div> : liabilityData && (
            <div className="table-wrap">
              <table className="admin-table">
                <thead><tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th style={{ textAlign: 'right' }}>Days</th>
                  <th style={{ textAlign: 'right' }}>Daily Rate</th>
                  <th style={{ textAlign: 'right' }}>Liability (R)</th>
                </tr></thead>
                <tbody>
                  {liabilityData.rows.length === 0 && (
                    <tr><td colSpan={5} className="empty-cell">No leave balances with outstanding days</td></tr>
                  )}
                  {liabilityData.rows.map((r, i) => (
                    <tr key={i}>
                      <td>
                        <span>{r.fullName}</span>
                        <span className="text-muted" style={{ display: 'block', fontSize: '0.8em' }}>{r.email}</span>
                      </td>
                      <td>
                        {r.leaveTypeName}
                        {r.bceaProtected && <span className="text-muted" style={{ fontSize: '0.75em', marginLeft: 6 }}>BCEA</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.days)}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>R {fmt(r.dailyRate)}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>R {fmt(r.monetary)}</td>
                    </tr>
                  ))}
                  {liabilityData.rows.length > 0 && (
                    <tr style={{ fontWeight: 700, background: '#f9fafb' }}>
                      <td colSpan={2}>Total</td>
                      <td style={{ textAlign: 'right' }}>{fmt(liabilityData.summary.totalDays)}</td>
                      <td />
                      <td style={{ textAlign: 'right' }}>R {fmt(liabilityData.summary.totalMonetary)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Transactions ───────────────────────────────────────────────────── */}
      {tab === 'transactions' && (
        <>
          <div className="report-toolbar">
            <label>Month
              <input type="month" value={txMonth} onChange={e => setTxMonth(e.target.value)}
                style={{ marginLeft: 8, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
              />
            </label>
          </div>

          {loading ? <div className="page-loading">Loading…</div> : txData && (
            <>
              {txData.rows.length > 0 && (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 12 }}>
                  {txData.rows.length} transaction{txData.rows.length !== 1 ? 's' : ''} — {fmt(txData.total)} total days taken
                </p>
              )}
              <div className="table-wrap">
                <table className="admin-table">
                  <thead><tr>
                    <th>Employee</th>
                    <th>Leave Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th style={{ textAlign: 'right' }}>Days</th>
                  </tr></thead>
                  <tbody>
                    {txData.rows.length === 0 && (
                      <tr><td colSpan={5} className="empty-cell">No approved leave taken in {txMonth}</td></tr>
                    )}
                    {txData.rows.map(r => (
                      <tr key={r.leaveRequestId}>
                        <td>
                          <span>{r.fullName}</span>
                          <span className="text-muted" style={{ display: 'block', fontSize: '0.8em' }}>{r.email}</span>
                        </td>
                        <td>{r.leaveTypeName}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.startDate)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.endDate)}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.days)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </Layout>
  )
}
