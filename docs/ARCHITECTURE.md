# BitTorrent Protocol & Client Architecture

> Contributed by @Amritesh786

## System Overview

This monorepo implements a full-featured BitTorrent P2P client and tracker suite conforming to the **BitTorrent Protocol Specification (BEP 3)** and **Compact Peer Lists (BEP 23)**, with an integrated modern Web Client dashboard.

```mermaid
flowchart TD
    WebUI["Modern Web UI (:5173 / :3000)<br>Mobile & Desktop Responsive"]
    ClientAPI["Express Client Engine (:3000)<br>Upload / Download / Status"]
    P2PEngine["BitTorrent P2P Wire Engine<br>Choke, Unchoke, Have, Bitfield"]
    Tracker["BEP 3 HTTP Tracker (:4000 / /announce)<br>Compact Binary 6-byte Peers"]

    WebUI <-->|REST API & Streaming| ClientAPI
    ClientAPI <-->|P2P Wire Protocol| P2PEngine
    P2PEngine <-->|Announce HTTP GET| Tracker
    P2PEngine <-->|TCP Chunks (256 KB)| SwarmPeers["Connected Swarm Peers"]
```

---

## Core Components

### 1. Web Client Dashboard (`apps/web`)
* **Responsive Dark-Mode Interface**: Tailored for both desktop browsers and mobile devices (iOS Safari & Android Chrome).
* **Direct File Pickers**: Native `<input type="file">` controls trigger mobile Photo/Document pickers and desktop file explorer dialogs.
* **Direct Downloads**: Allows saving completed or seeded files directly to your phone/PC storage with one tap.
* **Real-time Live Polling**: Dynamically refreshes download speeds, piece counts, and swarm peer counts every second.

### 2. Client Engine (`apps/client`)
* **Download Manager**: Manages concurrent chunk downloads using round-robin peer worker pools.
* **Piece Storage & Verification**: Stores verified 256 KB piece chunks under `.pieces/` and verifies every piece using SHA-1 hashes before assembly.
* **Simultaneous Seed-While-Download**: Peer servers are launched concurrently with downloads, immediately broadcasting `HAVE` messages and uploading completed pieces to peers.
* **Auto-Port Allocation**: Dynamically finds and assigns free TCP ports (5016 - 5999), avoiding manual port configuration or port collision.

### 3. Tracker Server (`apps/tracker-server`)
* **BEP 3 GET Announce**: Parses URL-encoded 20-byte `info_hash` and `peer_id` parameters.
* **BEP 23 Compact Format**: Packs peers into 6-byte binary representations (4-byte IPv4 + 2-byte Port in Big Endian format).
* **Embedded Fallback**: An embedded tracker is mounted directly onto the client backend (`/announce`), enabling 1-service deployment on cloud hosts like Render and Railway.

---

## Data Directories Structure

All runtime data is strictly consolidated under the root `data/` directory:
* `data/torrents/`: Stores `.torrent` bencoded metadata files.
* `data/uploads/`: Stores files uploaded directly from mobile or laptop devices.
* `data/downloads/`: Stores completed, assembled files.
* `data/downloads/.pieces/`: Stores individual verified 256 KB piece files.
