const KEY_PREFIX = "kcx_admin_seen"

const read = (key: string): number => {
  try {
    const value = localStorage.getItem(key)
    if (!value) return 0
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

const write = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // ignore storage errors
  }
}

export function getAdminTicketSeenAt(ticketId: string): number {
  return read(`${KEY_PREFIX}:ticket:${ticketId}`)
}

export function setAdminTicketSeenAt(ticketId: string): void {
  write(`${KEY_PREFIX}:ticket:${ticketId}`, Date.now())
}

export function setAdminSectionSeenAt(section: string): void {
  write(`${KEY_PREFIX}:section:${section}`, Date.now())
}
