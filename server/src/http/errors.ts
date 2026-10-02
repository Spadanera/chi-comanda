export class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message)
        this.name = new.target.name
    }
}

export class BadRequestError extends HttpError {
    constructor(message = 'Richiesta non valida') { super(400, message) }
}

export class UnauthorizedError extends HttpError {
    constructor(message = 'Unauthorized') { super(401, message) }
}

export class ForbiddenError extends HttpError {
    constructor(message = 'Forbidden') { super(403, message) }
}

export class NotFoundError extends HttpError {
    constructor(message = 'Resource not found') { super(404, message) }
}

/** The request is valid but conflicts with the current state (e.g. deleting something still in use). */
export class ConflictError extends HttpError {
    constructor(message: string) { super(409, message) }
}
