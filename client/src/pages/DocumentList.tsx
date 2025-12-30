import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { API_BASE_URL } from '../config';
import styles from './DocumentList.module.css';

interface Document {
    id: string;
    title: string;
    updatedAt: string;
    collaboratorCount: number;
}

function DocumentList() {
    const { user, token, isLoading: userLoading } = useUser();
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    // Redirect if not logged in
    useEffect(() => {
        if (!userLoading && !user) {
            navigate('/');
        }
    }, [user, userLoading, navigate]);

    // Fetch documents
    useEffect(() => {
        if (!token) return;

        fetchDocuments();
    }, [token]);

    const fetchDocuments = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/documents`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (data.success) {
                setDocuments(data.data);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to fetch documents');
        } finally {
            setLoading(false);
        }
    };

    const createDocument = async () => {
        setCreating(true);
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}/api/documents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ title: 'Untitled Document' }),
            });

            const data = await response.json();

            if (data.success) {
                navigate(`/doc/${data.data.id}`);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to create document');
        } finally {
            setCreating(false);
        }
    };

    const deleteDocument = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm('Are you sure you want to delete this document?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (data.success) {
                setDocuments(docs => docs.filter(d => d.id !== id));
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to delete document');
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

        return date.toLocaleDateString();
    };

    if (userLoading || !user) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>
                    <div className="loading-spinner" />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Your Documents</h1>
                    <p className={styles.subtitle}>Create and manage your collaborative documents</p>
                </div>

                <button
                    onClick={createDocument}
                    className="btn btn-primary"
                    disabled={creating}
                >
                    {creating ? <span className="loading-spinner" /> : '+ New Document'}
                </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            {loading ? (
                <div className={styles.loading}>
                    <div className="loading-spinner" />
                </div>
            ) : documents.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}>📝</div>
                    <h2>No documents yet</h2>
                    <p>Create your first collaborative document to get started</p>
                    <button onClick={createDocument} className="btn btn-primary">
                        Create Document
                    </button>
                </div>
            ) : (
                <div className={styles.grid}>
                    {documents.map(doc => (
                        <Link
                            key={doc.id}
                            to={`/doc/${doc.id}`}
                            className={styles.card}
                        >
                            <div className={styles.cardIcon}>📄</div>
                            <div className={styles.cardContent}>
                                <h3 className={styles.cardTitle}>{doc.title}</h3>
                                <div className={styles.cardMeta}>
                                    <span>{formatDate(doc.updatedAt)}</span>
                                    {doc.collaboratorCount > 1 && (
                                        <span>👥 {doc.collaboratorCount}</span>
                                    )}
                                </div>
                            </div>
                            <button
                                className={styles.deleteBtn}
                                onClick={(e) => deleteDocument(doc.id, e)}
                                title="Delete document"
                            >
                                🗑️
                            </button>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export default DocumentList;
