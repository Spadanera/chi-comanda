import { BadRequestError } from './errors'

/** Parses a positive integer id (route param, query or body field). */
export function toId(value: unknown, name = 'id'): number {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isInteger(n) || n <= 0) {
        throw new BadRequestError(`Parametro "${name}" non valido`)
    }
    return n
}

export function toIdList(value: unknown, name = 'ids'): number[] {
    if (!Array.isArray(value)) {
        throw new BadRequestError(`Parametro "${name}" non valido`)
    }
    return value.map(v => toId(v, name))
}

/** Parses a JSON array of ids such as `[1,2,3]` coming from a URL segment. */
export function toIdListFromJson(value: string, name = 'ids'): number[] {
    let parsed: unknown
    try {
        parsed = JSON.parse(value)
    } catch {
        throw new BadRequestError(`Parametro "${name}" non valido`)
    }
    return toIdList(parsed, name)
}

export function toPositiveAmount(value: unknown, name = 'amount'): number {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestError(`Parametro "${name}" non valido`)
    }
    return n
}

export function toNonNegativeInt(value: unknown, fallback: number): number {
    const n = Number(value)
    return Number.isInteger(n) && n >= 0 ? n : fallback
}
