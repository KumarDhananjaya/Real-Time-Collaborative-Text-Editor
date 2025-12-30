import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { UserModel } from '../../models/User';

/** Random color generator for user cursors */
function generateUserColor(): string {
    const colors = [
        '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
        '#2196F3', '#00BCD4', '#009688', '#4CAF50',
        '#FF9800', '#FF5722', '#795548', '#607D8B'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

const router = Router();

/**
 * POST /api/users/register
 * Register a new user (simplified - no password for demo)
 */
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, name } = req.body;

        if (!email || !name) {
            return res.status(400).json({
                success: false,
                error: 'Email and name are required'
            });
        }

        // Check if user exists
        let user = await UserModel.findOne({ email: email.toLowerCase() });

        if (user) {
            return res.status(409).json({
                success: false,
                error: 'User already exists'
            });
        }

        // Create new user
        user = await UserModel.create({
            _id: uuidv4(),
            email: email.toLowerCase(),
            name,
            color: generateUserColor(),
        });

        // Generate token
        const token = jwt.sign(
            { userId: user._id, name: user.name, color: user.color },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    color: user.color,
                },
                token,
            },
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ success: false, error: 'Failed to register user' });
    }
});

/**
 * POST /api/users/login
 * Login user (simplified - email only for demo)
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        const user = await UserModel.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id, name: user.name, color: user.color },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    color: user.color,
                },
                token,
            },
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ success: false, error: 'Failed to login' });
    }
});

/**
 * POST /api/users/guest
 * Create a guest session
 */
router.post('/guest', async (req: Request, res: Response) => {
    try {
        const { name = 'Guest' } = req.body;

        const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const color = generateUserColor();

        // Generate short-lived token for guest
        const token = jwt.sign(
            { userId: guestId, name, color, isGuest: true },
            config.jwt.secret,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            data: {
                user: {
                    id: guestId,
                    name,
                    color,
                    isGuest: true,
                },
                token,
            },
        });
    } catch (error) {
        console.error('Error creating guest session:', error);
        res.status(500).json({ success: false, error: 'Failed to create guest session' });
    }
});

/**
 * GET /api/users/me
 * Get current user info
 */
router.get('/me', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        // Check if guest
        if (userId.startsWith('guest_')) {
            return res.json({
                success: true,
                data: {
                    id: userId,
                    name: (req as any).userName || 'Guest',
                    isGuest: true,
                },
            });
        }

        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            data: {
                id: user._id,
                email: user.email,
                name: user.name,
                color: user.color,
            },
        });
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ success: false, error: 'Failed to get user' });
    }
});

export default router;
