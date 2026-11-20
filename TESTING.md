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

