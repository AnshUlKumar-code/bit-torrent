# Tracker Server Testing Report

## Test 1: Health Check API

**Endpoint:** GET /api/health

**Purpose:** To verify that the tracker server is running properly.

**Expected Result:**
- HTTP Status Code: 200 OK
- success: true
- Message: Tracker server is running

**Actual Result:**
- Server responded successfully.
- Health check endpoint returned the expected response.

**Status:** PASS

## Testing Environment
- Runtime: Node.js
- Framework: Express.js
- Server Port: 4000


## Test 2: Peer Registry Unit Testing

**Purpose:** To verify that the PeerRegistry service manages torrent peers correctly.

**Test Cases:**

1. **Add and Retrieve Peer**
   - Adds a peer to a torrent.
   - Verifies that the peer is returned successfully.
   - Status: PASS

2. **Exclude Requesting Peer**
   - Adds a peer to a torrent.
   - Checks that the requesting peer is not returned in the peer list.
   - Status: PASS

3. **Remove Expired Peers**
   - Adds a peer to a torrent.
   - Simulates expiration after 3 minutes.
   - Verifies that the expired peer is removed.
   - Status: PASS

**Testing Command:**
```bash
node --test test/PeerRegistry.test.js
```

**Actual Result:**
- Total Tests: 3
- Passed: 3
- Failed: 0

**Overall Status:** PASS

**Testing Environment:**
- Runtime: Node.js v24.14.0
- Testing Framework: Node.js built-in test runner
- Module: PeerRegistry
