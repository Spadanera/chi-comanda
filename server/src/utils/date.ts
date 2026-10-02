/** Current wall-clock time in Italy formatted as a MySQL DATETIME (`YYYY-MM-DD HH:mm:ss`). */
export function nowInItaly(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Rome',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date())
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

/** Extracts the `YYYY-MM-DD` part from a date or ISO string. */
export function toSqlDate(date: Date | string | undefined): string | undefined {
    if (!date) return undefined
    return (date instanceof Date ? date.toISOString() : String(date)).split('T')[0]
}
