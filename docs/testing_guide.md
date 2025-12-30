# Testing Guide

## 1. How to Test Manually (Walkthrough)

Follow these steps to verify the application is working correctly.

### Prerequisites
1.  Ensure Redis and MongoDB are running (Use Docker Desktop or `docker-compose up -d`).
2.  Start the development servers: `npm run dev` in the root directory.
3.  Open http://localhost:5173 in your browser.

### Scenario A: Basic Editing (Single User)
1.  **Guest Login**: Click **Start Editing**. You should be redirected to a new document list or dashboard.
2.  **Create Document**: Click **+ New Document**.
3.  **Edit**: Type some text. Verify that the "Saved" indicator appears in the top right (if implemented) or that no errors occur in the console.
4.  **Refresh**: Refresh the page. The content should persist.

### Scenario B: Real-Time Collaboration (Multi-User)
1.  **Setup**: Open the **same document URL** in two different browser windows (Incognito mode works best to simulate distinct users).
2.  **Verify Presence**:
    *   Check the top bar: You should see two avatars (one for you, one for the other "guest").
    *   Move the cursor in Window A; verify you see the name tag and cursor move in Window B.
3.  **Concurrent Editing**:
    *   Type "Hello" in Window A. Watch it appear instantly in Window B.
    *   Type "World" in Window B. Watch it appear in Window A.
    *   **Conflict Test**: Try typing in the exact same location in both windows simultaneously. The text should converge to a consistent state (e.g., "Hello World" or mixed, but identical on both screens).

### Scenario C: Offline/Reconnection
1.  **Go Offline**: In Window A, disconnect the internet or stop the server (Ctrl+C).
2.  **Offline Edit**: Type "Offline change" in Window A.
3.  **Reconnect**: Restart the server `npm run dev`.
4.  **Verify Sync**: The "Offline change" should sync to Window B once the socket reconnects.

---

## 2. Automated Testing

### Running Unit Tests
The project is set up with `vitest` for server-side testing.

```bash
# Run server tests
cd server
npm run test
```

### Integration Tests
To run integration tests that verify database and Redis interactions:

```bash
cd server
npm run test:integration
```
*(Note: Ensure DB/Redis are running before executing integration tests)*

---

## 3. Common Issues & Troubleshooting

*   **"Socket connection failed"**: Check if port 3001 is blocked or if the server crashed.
*   **"Missing environment variables"**: Ensure `.env` exists in the server directory.
*   **"Module not found"**: Run `npm install` in the root directory to fix hoisting issues.
