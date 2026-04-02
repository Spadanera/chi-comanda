import { Request, Response, NextFunction } from "express"

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>

export const asyncHandler = (fn: AsyncRouteHandler) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }

export const errorMiddleware = (error: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error(error)
    res.status(500).json({ message: error.message || 'Internal server error' })
}
