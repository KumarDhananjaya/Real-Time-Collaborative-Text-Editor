# Architecture Documentation

## 1. High-Level Design (HLD)

### System Overview
The Real-Time Collaborative Text Editor is a distributed application designed to allow multiple users to edit documents simultaneously with eventual consistency. It leverages **CRDTs (Conflict-free Replicated Data Types)** for decentralized conflict resolution and **WebSockets** for real-time communication.

### Core Components
1.  **Client (Frontend)**: React application using `Quill` editor and `Yjs` for state management. Connects via `Socket.io` to the server.
2.  **Server (Backend)**: Node.js/Express server that acts as a signaling relay for Yjs updates and manages persistence.
3.  **Redis (Pub/Sub & Cache)**:
    *   **Pub/Sub**: Synchronizes document updates across multiple server instances (scalability).
    *   **Cache**: Stores the "hot" state of active documents in memory for fast access.
4.  **MongoDB (Persistence)**: Durable storage for document snapshots and user metadata.

### Architecture Diagram

```mermaid
graph TD
    UserA["User A (Client)"] -- "WebSocket" --> Server1["Server Instance 1"]
    UserB["User B (Client)"] -- "WebSocket" --> Server1
    UserC["User C (Client)"] -- "WebSocket" --> Server2["Server Instance 2"]

    subgraph "Backend Layer"
        Server1
        Server2
    end

    subgraph "Data Layer"
        Redis[("Redis (Pub/Sub & Cache)")]
        MongoDB[("MongoDB (Persistence)")]
    end

    Server1 -- "Sync/Updates" --> Redis
    Server2 -- "Sync/Updates" --> Redis
    Redis -- "Broadcast" --> Server1
    Redis -- "Broadcast" --> Server2

    Server1 -- "Persist State" --> MongoDB
    Server2 -- "Persist State" --> MongoDB
```

---

## 2. Low-Level Design (LLD)

### Data Conflict Resolution (CRDTs)
We use **Yjs** as the underlying CRDT library.
*   **Document State**: Each document is a `Y.Doc`.
*   **Text syncing**: The content is stored in a `Y.Text` type named `"quill"`.
*   **Awareness**: User cursors and presence are handled by `y-protocols/awareness`.

### Database Schema (MongoDB)
*   **User**: `_id`, `email`, `name`, `avatar`, `color`, `isGuest`.
*   **Document**: 
    *   `_id`: UUID
    *   `title`: String
    *   `owner`: Ref(User)
    *   `collaborators`: [Ref(User)]
    *   `state`: Buffer (Binary Yjs snapshot)
    *   `version`: Number

### Redis Data Structures
1.  **Document State Cache**: 
    *   Key: `doc:{docId}:state`
    *   Value: Binary update encoding of the Yjs document.
2.  **Pub/Sub Channel**:
    *   Channel: `doc-sync`
    *   Message: JSON `{ docId: string, update: string (base64) }`

### API & WebSocket Events

#### HTTP API
*   `POST /api/auth/login`: Authenticate user.
*   `GET /api/documents`: List user documents.
*   `POST /api/documents`: Create new document.
*   `GET /api/documents/:id`: Get document metadata.

#### Socket.io Events
| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `join-document` | Client -> Server | `{ docId }` | User joins a doc room. |
| `yjs-update` | Bidirectional | `{ update }` | Incremental Yjs binary update. |
| `awareness-update` | Bidirectional | `{ update }` | Cursor/Selection updates. |

---

## 3. Sequence Diagrams

### 1. User Joins Document
```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Redis
    participant DB as MongoDB

    Client->>Server: Connect (Socket.io)
    Client->>Server: emit('join-document', { docId })
    
    Server->>Redis: GET doc:{docId}:state
    alt Cache Hit
        Redis-->>Server: binaryState
    else Cache Miss
        Server->>DB: FindOne({ _id: docId })
        DB-->>Server: docSnapshot
        Server->>Redis: SET doc:{docId}:state
    end

    Server-->>Client: emit('sync-step-1', binaryState)
    Client-->>Server: emit('sync-step-2', missingUpdates)
    Server-->>Client: emit('awareness-update')
```

### 2. Real-Time Editing Flow
```mermaid
sequenceDiagram
    participant UserA as Client A
    participant Server
    participant Redis
    participant UserB as Client B

    UserA->>UserA: Type "Hello" (Local Update)
    UserA->>Server: emit('yjs-update', updateVector)
    
    par Broadcast to Room
        Server->>UserB: emit('yjs-update', updateVector)
    and Sync across Servers
        Server->>Redis: PUBLISH 'doc-sync' { docId, update }
    end
    
    UserB->>UserB: Apply Update (Merge CRDT)
```
