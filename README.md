# Krafton – Associate Game Developer Assignment  
### Multiplayer State Synchronization • Node.js Server • HTML5 Canvas Client

This project implements the assignment requirements for the **Associate Game Developer** role at **Krafton**.  
It creates a simple real-time **multiplayer coin-collector game** with:

- **Server-authoritative state**
- **WebSockets** for real-time networking
- **Interpolation** on clients for smooth movement
- **~200ms simulated latency** (100ms each direction)
- **No networking/game engine** used — everything is implemented manually.

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

---

## 📦 Folder Structure

