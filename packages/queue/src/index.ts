import { Queue, Worker, type Processor } from 'bullmq'
export type { Job } from 'bullmq'

export const QUEUE_NAME = 'joot'

// ── Job payload types ────────────────────────────────────────────────────────

export interface NotifyApproverPayload {
  leaveRequestId: string
  stepId:         string
  stepSequence:   number
  approverEmail:  string
  approverName:   string
  employeeName:   string
  leaveTypeName:  string
  startDate:      string
  endDate:        string
  days:           number
  notes?:         string
  appUrl:         string
}

export interface NotifyEmployeePayload {
  leaveRequestId: string
  employeeEmail:  string
  employeeName:   string
  leaveTypeName:  string
  startDate:      string
  endDate:        string
  days:           number
  status:         'approved' | 'rejected'
  approverName:   string
  decisionNotes?: string
  appUrl:         string
}

export interface NotifyRecallPayload {
  leaveRequestId: string
  employeeEmail:  string
  employeeName:   string
  leaveTypeName:  string
  startDate:      string
  endDate:        string
  days:           number
  recalledByName: string
  notes?:         string
  appUrl:         string
}

export type JobData =
  | { type: 'notify-approver'; payload: NotifyApproverPayload }
  | { type: 'notify-employee'; payload: NotifyEmployeePayload }
  | { type: 'notify-recall';   payload: NotifyRecallPayload }

// ── Helpers ───────────────────────────────────────────────────────────────────

function connection(redisUrl: string) {
  const u = new URL(redisUrl)
  return {
    host:     u.hostname,
    port:     Number(u.port) || 6379,
    password: u.password ? decodeURIComponent(u.password) : undefined,
  }
}

export function createQueue(redisUrl: string): Queue<JobData> {
  return new Queue<JobData>(QUEUE_NAME, { connection: connection(redisUrl) })
}

export function createWorker(
  redisUrl: string,
  processor: Processor<JobData>,
): Worker<JobData> {
  return new Worker<JobData>(QUEUE_NAME, processor, {
    connection: connection(redisUrl),
  })
}
