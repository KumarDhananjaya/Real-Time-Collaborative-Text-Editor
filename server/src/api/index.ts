import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import documentsRouter from './routes/documents';
import usersRouter from './routes/users';

const router = Router();

/**
 * Optional auth middleware - attaches user info if token present
 */
function optionalAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);

        try {
            const decoded = jwt.verify(token, config.jwt.secret) as any;
            (req as any).userId = decoded.userId;
            (req as any).userName = decoded.name;
        } catch (err) {
            // Invalid token - continue as unauthenticated
        }
    }

    next();
}

// Apply optional auth to all routes
router.use(optionalAuth);

// Mount routes
router.use('/documents', documentsRouter);
router.use('/users', usersRouter);

// Health check
router.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

export default router;
