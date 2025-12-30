# Interview Questions & Answers

## Core Concepts

### Q1: Why did you verify this architecture (CRDTs) over Operational Transformation (OT)?
**Answer**: 
*   **Decentralization**: CRDTs (like Yjs) allow for conflict resolution without a central authority acting as the source of truth for every operation. This makes them better suited for peer-to-peer or distributed systems.
*   **Complexity**: OT requires a complex central server to transform operations from all clients. CRDTs handle this mathematically on each client, simplifying the backend to just a message relay.
*   **Offline Support**: CRDTs handle offline edits gracefully. You simply apply the stored operations when the connection is restored, and they merge automatically.

### Q2: How does Yjs handle conflicts?
**Answer**: Yjs uses a doubly-linked list of items (characters/blocks). Each item has a unique ID (ClientID + Clock). When two users insert text at the same position, Yjs uses the Item IDs to deterministically order them. Since the ordering rule is identical on all clients, the document converges to the same state everywhere.

### Q3: Why use Redis Pub/Sub?
**Answer**: 
*   **Scalability**: WebSocket servers are stateful (sticky connections). If User A is on Server 1 and User B is on Server 2, they cannot communicate directly. Redis Pub/Sub acts as a message bus to bridge these servers. When User A updates, Server 1 publishes to Redis, and Server 2 (subscribed) receives it and forwards it to User B.

---

## System Design

### Q4: How would you scale this application to 1 million users?
**Answer**:
1.  **Horizontal Scaling**: Add more Node.js server instances behind a Load Balancer (Nginx/AWS ALB).
2.  **Sticky Sessions**: Configure the LB to use sticky sessions so a user stays connected to the same WebSocket server during a session.
3.  **Redis Cluster**: Use Redis Cluster for Pub/Sub to handle the high throughput of messages.
4.  **Sharding**: If a single document becomes too large or active ("hot document"), standard scaling might fail. We might need to shard the Yjs document itself or limit the number of active collaborators per document.
5.  **Database**: Offload historical snapshots to cold storage (S3) and keep only active metadata in MongoDB/Postgres.

### Q5: What happens if the server crashes?
**Answer**:
*   **Data Safety**: Since clients hold a copy of the CRDT state, no data is lost immediately.
*   **Persistence**: We periodically save snapshots to MongoDB.
*   **Recovery**: When the server restarts (or clients reconnect to a new server), clients invoke a "sync step" where they exchange state vectors with the server to upload any unsaved changes and download missed updates.

---

## Code & Implementation

### Q6: Why use `socket.io` instead of raw `ws`?
**Answer**: Socket.io provides automatic fallback (long-polling) if WebSockets are blocked, automatic reconnection logic, and "Rooms" abstraction which is perfect for isolating document edits (one room per document).

### Q7: Explain the folder structure (Monorepo).
**Answer**: We used a monorepo workspace for code sharing.
*   `server`: Backend API and WebSocket logic.
*   `client`: React frontend.
*   `shared`: TypeScript interfaces (types) shared between both. This ensures type safety for API requests and socket events—if I change a type in the backend, the frontend build will fail if not updated.
