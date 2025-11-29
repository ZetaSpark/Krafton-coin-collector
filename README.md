# Krafton – Associate Game Developer Assignment

A real-time **multiplayer coin-collector game** with:

- **Server-authoritative gameplay**
- **WebSockets** for real-time communication  
- **~200ms simulated latency** (100ms incoming + 100ms outgoing)
- **Client-side interpolation** for smooth movement
- **HTML5 Canvas** rendering  
- **Pure JavaScript — no game engine or networking middleware**
---

## 🚀 Features

### ✔ Server Authority  
- Clients **only send intent** (move up/down/left/right).  
- Server updates:
  - Player positions  
  - Coin positions  
  - Collision detection  
  - Scoring  

### ✔ Network Delay Simulation  
- Incoming messages are delayed by **100 ms**  
- Outgoing messages are delayed by **100 ms**  
- Effective round trip latency ≈ **200 ms**

### ✔ Client-Side Interpolation  
Clients render players at  
**serverTime − interpolationDelay (≈180ms)**  
to smooth out jitter due to latency.

### ✔ Coin Collection & Score Sharing  
Whenever a player touches a coin:
- Server removes the coin
- Server increases that player’s score
- All clients see the updated score immediately

### ✔ Simple Lobby Behavior  
If only one player is connected, client displays:  
> “Open another browser tab to connect Player 2”

## 🧭 How to Run the Project

### 1️⃣ Start the Server (Node.js)

Open a terminal inside the `server` folder:

```bash
cd server
npm install
npm start
```

### 2️⃣ Start the Client (Local Web Server)

Open another terminal inside the **client** folder:

```bash
cd client
python -m http.server 8000
```

3️⃣ Open the Game in Your Browser

Open TWO or more tabs or windows:

Tab 1: http://localhost:8000
Tab 2: http://localhost:8000

Each tab represents one player.



