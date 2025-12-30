import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import styles from './Header.module.css';

function Header() {
    const { user, logout } = useUser();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <Link to="/" className={styles.logo}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="url(#gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 2V8H20" stroke="url(#gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16 13H8" stroke="url(#gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16 17H8" stroke="url(#gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 9H9H8" stroke="url(#gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <defs>
                            <linearGradient id="gradient" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#667eea" />
                                <stop offset="1" stopColor="#764ba2" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <span>CollabEdit</span>
                </Link>

                <nav className={styles.nav}>
                    {user && (
                        <>
                            <Link to="/documents" className={styles.navLink}>
                                Documents
                            </Link>
                        </>
                    )}
                </nav>

                <div className={styles.actions}>
                    {user ? (
                        <div className={styles.userMenu}>
                            <div className={styles.userInfo}>
                                <div
                                    className={styles.avatar}
                                    style={{ backgroundColor: user.color }}
                                >
                                    {user?.name?.charAt(0).toUpperCase()}
                                </div>
                                <span className={styles.userName}>{user.name}</span>
                                {user.isGuest && <span className={styles.guestBadge}>Guest</span>}
                            </div>
                            <button onClick={handleLogout} className="btn btn-ghost">
                                Logout
                            </button>
                        </div>
                    ) : (
                        <Link to="/" className="btn btn-primary">
                            Get Started
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}

export default Header;
