import mongoose, { Schema, Document } from 'mongoose';

/**
 * User schema for authentication and identification
 */
export interface IUser extends Omit<Document, '_id'> {
    _id: string;
    email: string;
    name: string;
    avatar?: string;
    color: string;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>(
    {
        _id: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        name: {
            type: String,
            required: true,
            maxlength: 100,
        },
        avatar: {
            type: String,
        },
        color: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
        _id: false,
    }
);

userSchema.index({ email: 1 });

export const UserModel = mongoose.model<IUser>('User', userSchema);
