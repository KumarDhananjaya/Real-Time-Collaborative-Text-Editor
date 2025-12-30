import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import styles from './Home.module.css';

function Home() {
    const { user, isLoading, login, register, loginAsGuest } = useUser();
    const navigate = useNavigate();
    const [mode, setMode] = useState<'login' | 'register' | 'guest'>('guest');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [guestName, setGuestName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // If user is logged in, redirect to documents
    if (!isLoading && user) {
        navigate('/documents');
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (mode === 'login') {
                await login(email);
            } else if (mode === 'register') {
                await register(email, name);
            } else {
                await loginAsGuest(guestName);
            }
            navigate('/documents');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.hero}>
                <div className={styles.heroContent}>
                    <h1 className={styles.title}>
                        Write Together,
                        <span className={styles.gradient}> In Real-Time</span>
                    </h1>
                    <p className={styles.subtitle}>
                        A collaborative text editor powered by CRDTs. Multiple users can edit
                        the same document simultaneously with automatic conflict resolution.
                    </p>

                    <div className={styles.features}>
                        <div className={styles.feature}>
                            <span className={styles.featureIcon}>⚡</span>
                            <span>Real-time sync</span>
                        </div>
                        <div className={styles.feature}>
                            <span className={styles.featureIcon}>🔄</span>
                            <span>Auto conflict resolution</span>
                        </div>
                        <div className={styles.feature}>
                            <span className={styles.featureIcon}>👥</span>
                            <span>Live cursors</span>
                        </div>
                    </div>
                </div>

                <div className={styles.formCard}>
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${mode === 'guest' ? styles.active : ''}`}
                            onClick={() => setMode('guest')}
                        >
                            Quick Start
                        </button>
                        <button
                            className={`${styles.tab} ${mode === 'login' ? styles.active : ''}`}
                            onClick={() => setMode('login')}
                        >
                            Login
                        </button>
                        <button
                            className={`${styles.tab} ${mode === 'register' ? styles.active : ''}`}
                            onClick={() => setMode('register')}
                        >
                            Register
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        {mode === 'guest' && (
                            <>
                                <p className={styles.formHint}>
                                    Start editing immediately as a guest
                                </p>
                                <input
                                    type="text"
                                    placeholder="Your name (optional)"
                                    value={guestName}
                                    onChange={(e) => setGuestName(e.target.value)}
                                    className={styles.input}
                                />
                            </>
                        )}

                        {mode === 'login' && (
                            <input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.input}
                                required
                            />
                        )}

                        {mode === 'register' && (
                            <>
                                <input
                                    type="text"
                                    placeholder="Your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={styles.input}
                                    required
                                />
                                <input
                                    type="email"
                                    placeholder="Email address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={styles.input}
                                    required
                                />
                            </>
                        )}

                        {error && <p className={styles.error}>{error}</p>}

                        <button
                            type="submit"
                            className={`btn btn-primary ${styles.submitBtn}`}
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="loading-spinner" />
                            ) : mode === 'guest' ? (
                                'Start Editing →'
                            ) : mode === 'login' ? (
                                'Login →'
                            ) : (
                                'Create Account →'
                            )}
                        </button>
                    </form>
                </div>
            </div>

            <div className={styles.techStack}>
                <h3>Powered by</h3>
                <div className={styles.techLogos}>
                    <span className={styles.tech}>Yjs (CRDTs)</span>
                    <span className={styles.tech}>Socket.io</span>
                    <span className={styles.tech}>Redis Pub/Sub</span>
                    <span className={styles.tech}>MongoDB</span>
                </div>
            </div>
        </div>
    );
}

export default Home;
