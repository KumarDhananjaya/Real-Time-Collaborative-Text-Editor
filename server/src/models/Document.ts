import mongoose, { Schema, Document } from 'mongoose';

/**
 * Document schema for storing collaborative documents
 * Stores both metadata and CRDT state snapshots
 */
export interface IDocument extends Document {
    _id: string;
    title: string;
    content: string; // Plain text representation for search/preview
    snapshot: Buffer; // Yjs document state as binary
    createdBy: string;
    collaborators: string[];
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}

const documentSchema = new Schema<IDocument>(
    {
        _id: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            required: true,
            default: 'Untitled Document',
            maxlength: 255,
        },
        content: {
            type: String,
            default: '',
        },
        snapshot: {
            type: Buffer,
            required: true,
        },
        createdBy: {
            type: String,
            required: true,
        },
        collaborators: [{
            type: String,
        }],
        isPublic: {
            type: Boolean,
            default: false,
        },
        version: {
            type: Number,
            default: 1,
        },
    },
    {
        timestamps: true,
        _id: false,
    }
);

// Indexes for efficient queries
documentSchema.index({ createdBy: 1 });
documentSchema.index({ collaborators: 1 });
documentSchema.index({ updatedAt: -1 });
documentSchema.index({ title: 'text', content: 'text' });

export const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);
