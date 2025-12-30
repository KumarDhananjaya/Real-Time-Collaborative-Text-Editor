# Real-Time Collaborative Text Editor

A Google Docs-style collaborative text editor where multiple users can edit the same document simultaneously with automatic conflict resolution using CRDTs.

![Architecture](https://img.shields.io/badge/Architecture-CRDT-blue)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Socket.io-green)
![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Quill-purple)

## 🌟 Features

- **Real-time Collaboration**: Multiple users editing simultaneously with instant synchronization
- **Conflict-free Merging**: Using CRDTs (Yjs) for automatic conflict resolution
- **Live Cursors**: See other users' cursor positions in real-time
- **Cross-server Sync**: Redis Pub/Sub enables horizontal scaling
- **Persistent Storage**: Documents auto-save to MongoDB
- **Hot State Caching**: Redis keeps active documents in memory for speed
- **Guest Access**: Quick start without registration

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Client 1   │     │  Client 2   │     │  Client N   │
│  (Yjs+Quill)│     │  (Yjs+Quill)│     │  (Yjs+Quill)│
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │ WebSocket         │ WebSocket         │ WebSocket
       └──────────────┬────┴───────────────────┘
                      ▼
              ┌───────────────┐
              │ Load Balancer │
              └───────┬───────┘
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│   Server 1    │◄─────────►│   Server 2    │
│ (Socket.io)   │  Redis    │ (Socket.io)   │
└───────┬───────┘  Pub/Sub  └───────┬───────┘
        │                           │
        └─────────────┬─────────────┘
                      ▼
        ┌─────────────────────────┐
        │        Redis            │
        │  (Hot State + Pub/Sub)  │
        └─────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │       MongoDB           │
        │   (Document Snapshots)  │
        └─────────────────────────┘
```

## 🔧 Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **CRDT Engine** | Yjs | Conflict-free data synchronization |
| **WebSocket** | Socket.io | Real-time bidirectional communication |
| **Pub/Sub** | Redis | Cross-server message broadcasting |
| **Cache** | Redis | Hot document state storage |
| **Database** | MongoDB | Persistent document snapshots |
| **Frontend** | React + Quill | Rich text editing UI |
| **API** | Express | REST endpoints for metadata |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm or yarn

### 1. Clone and Install

```bash
git clone <repository-url>
cd Real-Time-Collaborative-Text-Editor
npm install
```

### 2. Start Infrastructure

```bash
# Start Redis and MongoDB
npm run docker:up
```

### 3. Configure Environment

```bash
# Copy example env file
cp server/.env.example server/.env
```

### 4. Run Development Servers

```bash
# Start both server and client
npm run dev

# Or separately:
npm run dev:server  # Backend on http://localhost:3001
npm run dev:client  # Frontend on http://localhost:5173
```

### 5. Open the App

Navigate to `http://localhost:5173` in your browser.

## 📁 Project Structure

```
├── server/                 # Backend
│   ├── src/
│   │   ├── config/        # Environment, Redis, MongoDB setup
│   │   ├── crdt/          # Yjs document management
│   │   ├── socket/        # WebSocket handlers
│   │   ├── api/           # REST endpoints
│   │   └── models/        # MongoDB schemas
│   └── package.json
│
├── client/                 # Frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # User auth context
│   │   ├── pages/         # Home, Documents, Editor
│   │   └── lib/           # Utilities
│   └── package.json
│
├── shared/                 # Shared types
│   └── src/index.ts
│
└── docker-compose.yml      # Redis + MongoDB
```

## 🔍 How It Works

### CRDT (Conflict-free Replicated Data Types)

Instead of saving the whole text, we treat edits as a stream of operations:

```
Bad way:  Save "Hello World" → Conflicts when two users type at same position
Good way: User A: insert('H', pos=0) → Mergeable operations
          User B: insert('W', pos=0) → Both operations preserved
```

Yjs handles this complexity, ensuring all clients eventually converge to the same state regardless of network delays or concurrent edits.

### Sync Protocol

1. **Client connects** → Joins document room via WebSocket
2. **Initial sync** → Server sends current document state
3. **Local edit** → Client creates Yjs update, sends to server
4. **Server broadcasts** → Update sent to all clients in room + Redis Pub/Sub
5. **Other servers** → Receive via Redis, broadcast to their clients
6. **Persistence** → Every 30s, server snapshots to MongoDB

### Awareness Protocol

Cursor positions and selections are synced using Yjs awareness:

```typescript
awareness.setLocalStateField('cursor', { index: 10, length: 0 });
// All other clients see your cursor in real-time
```

## 🛠️ API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents` | List user's documents |
| POST | `/api/documents` | Create new document |
| GET | `/api/documents/:id` | Get document metadata |
| PATCH | `/api/documents/:id` | Update title/settings |
| DELETE | `/api/documents/:id` | Delete document |
| POST | `/api/users/register` | Register user |
| POST | `/api/users/login` | Login user |
| POST | `/api/users/guest` | Create guest session |

## 🔌 WebSocket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-document` | `docId` | Join a document room |
| `leave-document` | `docId` | Leave a document room |
| `yjs-update` | `docId, update[]` | Send Yjs update |
| `awareness-update` | `docId, state[]` | Send cursor/selection |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `yjs-update` | `update[]` | Receive Yjs update |
| `awareness-update` | `state[]` | Receive awareness state |
| `user-joined` | `{id, name, color}` | New collaborator joined |
| `user-left` | `userId` | Collaborator left |

## 🧪 Testing

```bash
# Run unit tests
cd server && npm test

# Run integration tests
cd server && npm run test:integration
```

### Manual Testing

1. Open document in two browser tabs
2. Type in both tabs simultaneously
3. Verify both see each other's changes instantly
4. Check cursor positions sync correctly

## 📈 Scaling

For production with multiple servers:

1. **Load Balancer**: Use sticky sessions or configure Socket.io with Redis adapter
2. **Redis Cluster**: For high availability
3. **MongoDB Replica Set**: For data redundancy
4. **Horizontal Scaling**: Add more server instances behind load balancer

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details.