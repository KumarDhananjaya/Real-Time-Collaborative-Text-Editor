import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as Y from 'yjs';
import { DocumentModel } from '../../models/Document';
import { documentManager } from '../../crdt/DocumentManager';

const router = Router();

/**
 * GET /api/documents
 * List all documents for a user
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId || 'anonymous';

        const documents = await DocumentModel.find({
            $or: [
                { createdBy: userId },
                { collaborators: userId },
                { isPublic: true },
            ],
        })
            .select('_id title updatedAt createdBy collaborators')
            .sort({ updatedAt: -1 })
            .limit(50);

        res.json({
            success: true,
            data: documents.map(doc => ({
                id: doc._id,
                title: doc.title,
                updatedAt: doc.updatedAt,
                createdBy: doc.createdBy,
                collaboratorCount: doc.collaborators?.length || 0,
            })),
        });
    } catch (error) {
        console.error('Error listing documents:', error);
        res.status(500).json({ success: false, error: 'Failed to list documents' });
    }
});

/**
 * POST /api/documents
 * Create a new document
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId || 'anonymous';
        const { title = 'Untitled Document' } = req.body;

        const docId = uuidv4();

        // Create initial Yjs document
        const doc = new Y.Doc();
        const text = doc.getText('content');
        text.insert(0, ''); // Initialize with empty text

        const snapshot = Y.encodeStateAsUpdate(doc);

        const newDoc = await DocumentModel.create({
            _id: docId,
            title,
            content: '',
            snapshot: Buffer.from(snapshot),
            createdBy: userId,
            collaborators: [userId],
            isPublic: false,
        });

        res.status(201).json({
            success: true,
            data: {
                id: newDoc._id,
                title: newDoc.title,
                createdAt: newDoc.createdAt,
            },
        });
    } catch (error) {
        console.error('Error creating document:', error);
        res.status(500).json({ success: false, error: 'Failed to create document' });
    }
});

/**
 * GET /api/documents/:id
 * Get document metadata
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const doc = await DocumentModel.findById(id)
            .select('_id title content createdBy collaborators isPublic createdAt updatedAt version');

        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        res.json({
            success: true,
            data: {
                id: doc._id,
                title: doc.title,
                content: doc.content,
                createdBy: doc.createdBy,
                collaboratorCount: doc.collaborators?.length || 0,
                isPublic: doc.isPublic,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
                version: doc.version,
            },
        });
    } catch (error) {
        console.error('Error getting document:', error);
        res.status(500).json({ success: false, error: 'Failed to get document' });
    }
});

/**
 * PATCH /api/documents/:id
 * Update document metadata
 */
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, isPublic } = req.body;

        const updateFields: any = {};
        if (title !== undefined) updateFields.title = title;
        if (isPublic !== undefined) updateFields.isPublic = isPublic;

        const doc = await DocumentModel.findByIdAndUpdate(
            id,
            updateFields,
            { new: true }
        );

        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        res.json({
            success: true,
            data: {
                id: doc._id,
                title: doc.title,
                isPublic: doc.isPublic,
            },
        });
    } catch (error) {
        console.error('Error updating document:', error);
        res.status(500).json({ success: false, error: 'Failed to update document' });
    }
});

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).userId;

        const doc = await DocumentModel.findById(id);

        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        // Only creator can delete
        if (doc.createdBy !== userId && userId !== 'anonymous') {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        // Unload from memory
        await documentManager.unloadDocument(id);

        // Delete from database
        await DocumentModel.findByIdAndDelete(id);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ success: false, error: 'Failed to delete document' });
    }
});

/**
 * POST /api/documents/:id/collaborators
 * Add a collaborator to a document
 */
router.post('/:id/collaborators', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { userId: collaboratorId } = req.body;

        if (!collaboratorId) {
            return res.status(400).json({ success: false, error: 'User ID required' });
        }

        const doc = await DocumentModel.findByIdAndUpdate(
            id,
            { $addToSet: { collaborators: collaboratorId } },
            { new: true }
        );

        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        res.json({
            success: true,
            data: { collaborators: doc.collaborators },
        });
    } catch (error) {
        console.error('Error adding collaborator:', error);
        res.status(500).json({ success: false, error: 'Failed to add collaborator' });
    }
});

export default router;
