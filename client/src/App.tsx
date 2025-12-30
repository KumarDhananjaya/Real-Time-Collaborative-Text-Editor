import { Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './contexts/UserContext';
import Header from './components/Header';
import Home from './pages/Home';
import DocumentList from './pages/DocumentList';
import Editor from './pages/Editor';

function App() {
    return (
        <UserProvider>
            <div className="app">
                <Header />
                <main style={{ flex: 1, overflow: 'hidden' }}>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/documents" element={<DocumentList />} />
                        <Route path="/doc/:docId" element={<Editor />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
            </div>
        </UserProvider>
    );
}

export default App;
