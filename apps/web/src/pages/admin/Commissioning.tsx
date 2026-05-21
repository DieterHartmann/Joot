import { useRef, useState } from 'react'
import Layout from '../../components/Layout'
import { useSubsidiary } from '../../SubsidiaryContext'

interface UploadResult {
  departments:     number
  leaveTypes:      number
  employees:       number
  openingBalances: number
}

export default function Commissioning() {
  const { subsidiary } = useSubsidiary()
  const subId = subsidiary?.id

  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading]   = useState(false)
  const [result,    setResult]      = useState<UploadResult | null>(null)
  const [errors,    setErrors]      = useState<string[]>([])
  const [fileName,  setFileName]    = useState('')

  function downloadTemplate() {
    const params = subId ? `?subsidiaryId=${subId}` : ''
    window.location.href = `/api/commissioning/template${params}`
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setUploading(true)
    setResult(null)
    setErrors([])

    try {
      const form = new FormData()
      form.append('file', file)
      if (subId) form.append('subsidiaryId', subId)

      const res = await fetch('/api/commissioning/upload', {
        method:      'POST',
        body:        form,
        credentials: 'include',
      })

      const body = await res.json()

      if (!res.ok) {
        setErrors(body.errors ?? [body.error ?? 'Upload failed'])
      } else {
        setResult(body)
        if (fileRef.current) fileRef.current.value = ''
        setFileName('')
      }
    } catch (err: any) {
      setErrors([err.message])
    } finally {
      setUploading(false)
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Commissioning</h1>
      </div>
      <p style={{ color: '#6b7280', marginBottom: '28px', fontSize: '0.9rem', maxWidth: '640px' }}>
        Use this workflow to bulk-load a company's initial data — departments, leave types, employees, and opening balances — from a single spreadsheet.
        The template is generated fresh each time, so it always reflects the current schema.
      </p>

      {/* Step 1 — Download */}
      <div className="commission-step">
        <div className="commission-step-number">1</div>
        <div className="commission-step-body">
          <h3>Download template</h3>
          <p>
            Download the XLSX template for <strong>{subsidiary?.name ?? 'this company'}</strong>.
            Fill in each sheet in order: Departments → Leave Types → Employees → Opening Balances.
          </p>
          <button className="btn-primary" onClick={downloadTemplate}>
            Download template
          </button>
        </div>
      </div>

      {/* Step 2 — Upload */}
      <div className="commission-step">
        <div className="commission-step-number">2</div>
        <div className="commission-step-body">
          <h3>Upload completed spreadsheet</h3>
          <p>
            Upload the filled-in template. All data is validated before any records are created.
            If there are errors, the upload is rejected and nothing is written to the database.
          </p>
          <form onSubmit={handleUpload} className="upload-form">
            <label className="file-label">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={e => setFileName(e.target.files?.[0]?.name ?? '')}
                style={{ display: 'none' }}
              />
              <span className="file-btn btn-ghost">Choose file</span>
              <span className="file-name">{fileName || 'No file chosen'}</span>
            </label>
            <button type="submit" className="btn-primary" disabled={!fileName || uploading}>
              {uploading ? 'Uploading…' : 'Upload & seed'}
            </button>
          </form>

          {errors.length > 0 && (
            <div className="commission-errors">
              <strong>Upload failed — fix these errors and re-upload:</strong>
              <ul>
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {result && (
            <div className="commission-success">
              <strong>Data seeded successfully</strong>
              <ul>
                <li>{result.departments} departments</li>
                <li>{result.leaveTypes} leave types</li>
                <li>{result.employees} employees</li>
                {result.openingBalances > 0 && <li>{result.openingBalances} opening balances</li>}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
