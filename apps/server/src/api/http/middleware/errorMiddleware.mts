import { NextFunction, Request, Response } from 'express';

export function errorMiddleware(error: Error, req: Request, res: Response, next: NextFunction) {
    return res.status(500).json({
        message: 'Internal Server Error',
        error: error.message,
    });
}
