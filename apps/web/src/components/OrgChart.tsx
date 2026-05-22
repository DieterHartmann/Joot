import { useEffect, useRef, useState } from 'react'
import { getOrgChart, type OrgChartData, type OrgChartDept, type OrgChartSubsidiary } from '../api'

// ── Layout constants ──────────────────────────────────────────────────────────
const CW = 152   // card width
const CH = 72    // card height
const HG = 14    // horizontal gap between siblings
const VG = 52    // vertical gap between levels (space for connector lines)

// ── Tree node ─────────────────────────────────────────────────────────────────
interface LNode {
  dept:         OrgChartDept
  children:     LNode[]
  x:            number
  y:            number
  subtreeW:     number
}

function buildTree(depts: OrgChartDept[]): LNode[] {
  const map = new Map<string, LNode>()
  for (const d of depts) map.set(d.id, { dept: d, children: [], x: 0, y: 0, subtreeW: CW })
  const roots: LNode[] = []
  for (const node of map.values()) {
    const parentId = node.dept.parentId
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function computeWidth(node: LNode): number {
  if (node.children.length === 0) { node.subtreeW = CW; return CW }
  let total = node.children.reduce((s, c) => s + computeWidth(c), 0)
  total += HG * (node.children.length - 1)
  node.subtreeW = Math.max(total, CW)
  return node.subtreeW
}

function assignXY(node: LNode, left: number, depth: number) {
  node.y = depth * (CH + VG)
  node.x = left + (node.subtreeW - CW) / 2
  let childLeft = left
  for (const child of node.children) {
    assignXY(child, childLeft, depth + 1)
    childLeft += child.subtreeW + HG
  }
}

function flattenTree(nodes: LNode[]): LNode[] {
  const result: LNode[] = []
  const visit = (n: LNode) => { result.push(n); n.children.forEach(visit) }
  nodes.forEach(visit)
  return result
}

function getAncestorIds(deptId: string, depts: OrgChartDept[]): Set<string> {
  const byId = new Map(depts.map(d => [d.id, d]))
  const ids = new Set<string>()
  let cur = byId.get(deptId)
  while (cur?.parentId) { ids.add(cur.parentId); cur = byId.get(cur.parentId) }
  return ids
}

function stepPath(px: number, py: number, cx: number, cy: number): string {
  const mx = px
  const my = py + VG / 2
  return `M${px},${py} L${mx},${my} L${cx},${my} L${cx},${cy}`
}

// ── Card ──────────────────────────────────────────────────────────────────────
function OrgCard({
  node, isUser, isAncestor, collapsed, hasChildren, onToggle,
}: {
  node:        LNode
  isUser:      boolean
  isAncestor:  boolean
  collapsed:   boolean
  hasChildren: boolean
  onToggle:    () => void
}) {
  const d = node.dept
  const cls = [
    'org-card',
    isUser     ? 'org-card--user'     : '',
    isAncestor ? 'org-card--ancestor' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls} style={{ width: CW, height: CH, boxSizing: 'border-box' }}>
      <div className="org-card-name" title={d.name}>{d.name}</div>
      {d.defaultApproverName && (
        <div className="org-card-approver" title={d.defaultApproverName}>
          ↑ {d.defaultApproverName}
        </div>
      )}
      <div className="org-card-footer">
        <span className="org-card-count">{d.employeeCount} {d.employeeCount === 1 ? 'person' : 'people'}</span>
        {hasChildren && (
          <button className="org-expand-btn" onClick={onToggle}>
            {collapsed ? `+${node.children.length}` : '−'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Subsidiary tree view ──────────────────────────────────────────────────────
function SubsidiaryView({ depts, userDeptId }: { depts: OrgChartDept[]; userDeptId: string | null }) {
  const ancestorIds = userDeptId ? getAncestorIds(userDeptId, depts) : new Set<string>()

  // Start with ancestors expanded so user sees their position immediately
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    // expand roots and all ancestors of the user's dept
    for (const d of depts) {
      if (!d.parentId) initial.add(d.id)  // root nodes expanded by default
    }
    ancestorIds.forEach(id => initial.add(id))
    if (userDeptId) {
      const parent = depts.find(d => d.id === userDeptId)?.parentId
      if (parent) initial.add(parent)
    }
    return initial
  })

  const toggle = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // Prune collapsed children from the tree for layout purposes
  function pruneTree(nodes: LNode[]): LNode[] {
    return nodes.map(n => ({
      ...n,
      children: expandedIds.has(n.dept.id) ? pruneTree(n.children) : [],
    }))
  }

  const roots       = buildTree(depts)
  const prunedRoots = pruneTree(roots)

  const totalRootW = prunedRoots.reduce((s, r) => {
    computeWidth(r)
    return s + r.subtreeW
  }, 0) + HG * Math.max(0, prunedRoots.length - 1)

  let left = 0
  for (const r of prunedRoots) {
    assignXY(r, left, 0)
    left += r.subtreeW + HG
  }

  const allNodes  = flattenTree(prunedRoots)
  const totalH    = allNodes.reduce((m, n) => Math.max(m, n.y + CH), 0)
  const totalW    = Math.max(totalRootW, CW)

  // Build a map to find the original (unpruned) node for hasChildren check
  const originalByDept = new Map<string, LNode>()
  flattenTree(roots).forEach(n => originalByDept.set(n.dept.id, n))

  return (
    <div className="org-chart-scroll">
      <div style={{ position: 'relative', width: totalW, height: totalH, minHeight: 80 }}>
        <svg
          style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}
          width={totalW}
          height={totalH}
        >
          {allNodes.map(node =>
            node.children.map(child => {
              const px = node.x + CW / 2
              const py = node.y + CH
              const cx = child.x + CW / 2
              const cy = child.y
              const isHighlight = ancestorIds.has(node.dept.id) || node.dept.id === userDeptId
              return (
                <path
                  key={child.dept.id}
                  d={stepPath(px, py, cx, cy)}
                  fill="none"
                  stroke={isHighlight ? '#6366f1' : '#cbd5e1'}
                  strokeWidth={isHighlight ? 2 : 1}
                />
              )
            })
          )}
        </svg>

        {allNodes.map(node => {
          const original   = originalByDept.get(node.dept.id)
          const hasChildren = (original?.children.length ?? 0) > 0
          return (
            <div
              key={node.dept.id}
              style={{ position: 'absolute', left: node.x, top: node.y }}
            >
              <OrgCard
                node={node}
                isUser={node.dept.id === userDeptId}
                isAncestor={ancestorIds.has(node.dept.id)}
                collapsed={!expandedIds.has(node.dept.id)}
                hasChildren={hasChildren}
                onToggle={() => toggle(node.dept.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Holding view ──────────────────────────────────────────────────────────────
function HoldingView({ holdingName, subsidiaries }: { holdingName: string; subsidiaries: OrgChartSubsidiary[] }) {
  return (
    <div className="org-holding-wrap">
      <div className="org-holding-root">{holdingName}</div>
      <div className="org-holding-children">
        {subsidiaries.map(s => (
          <div key={s.id} className="org-subsidiary-card">
            <div className="org-card-name">{s.name}</div>
            <div className="org-card-count" style={{ marginTop: 4 }}>
              {s.employeeCount} employees &middot; {s.deptCount} departments
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function OrgChart() {
  const [data, setData] = useState<OrgChartData | null>(null)

  useEffect(() => { getOrgChart().then(d => d && setData(d)) }, [])

  if (!data) return <div className="org-loading">Loading chart…</div>

  if (data.type === 'holding') {
    return <HoldingView holdingName={data.holdingName} subsidiaries={data.subsidiaries} />
  }

  return <SubsidiaryView depts={data.departments} userDeptId={data.userDeptId} />
}
