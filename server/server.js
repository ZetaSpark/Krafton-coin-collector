import WebSocket, { WebSocketServer } from "ws";

// Config 
const PORT = 8080;
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;
const PLAYER_RADIUS = 15;
const COIN_RADIUS = 8;
const PLAYER_SPEED = 220; // pixels per second
const TICK_RATE = 30; // ticks per second
const COIN_SPAWN_INTERVAL_MS = 2000; // spawn every 2s
const LAG_MS = 100; // artificial latency each direction (~200ms)

// --- Game State ---
let nextPlayerId = 1;
let nextCoinId = 1;
const players = new Map(); // id -> { id, x, y, vx, vy, score, input, ws }
const coins = new Map();   // id -> { id, x, y }
let lastUpdateTime = Date.now();

// --- WebSocket Server ---
const wss = new WebSocketServer({ port: PORT }, () => {
  console.log(`Game server running on ws://localhost:${PORT}`);
});

// Helper: send JSON with artificial lag
function sendWithLag(ws, msgObj) {
  const data = JSON.stringify(msgObj);
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }, LAG_MS);
}

// Helper: random position
function randomPosition(margin = 30) {
  return {
    x: margin + Math.random() * (WORLD_WIDTH - 2 * margin),
    y: margin + Math.random() * (WORLD_HEIGHT - 2 * margin)
  };
}

// Create a new player entry
function createPlayer(ws) {
  const id = nextPlayerId++;
  const pos = randomPosition();
  const player = {
    id,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    score: 0,
    input: { up: false, down: false, left: false, right: false },
    ws
  };
  players.set(id, player);
  return player;
}

// Remove player on disconnect
function removePlayerBySocket(ws) {
  for (const [id, p] of players.entries()) {
    if (p.ws === ws) {
      players.delete(id);
      break;
    }
  }
}

// --- Networking: Connection Handling ---
wss.on("connection", (ws) => {
  console.log("Client connected");

  // Create player
  const player = createPlayer(ws);
  const playerId = player.id;

  // Send init message
  sendWithLag(ws, {
    type: "init",
    yourId: playerId,
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    lagMs: LAG_MS
  });

  // Lobby-ish info: we can optionally notify how many players are connected
  broadcast({
    type: "player_count",
    count: players.size
  });

  // Handle messages with artificial lag
  ws.on("message", (raw) => {
    const msgStr = raw.toString();

    setTimeout(() => {
      let msg;
      try {
        msg = JSON.parse(msgStr);
      } catch (e) {
        console.warn("Invalid JSON from client:", e);
        return;
      }
      handleClientMessage(ws, msg);
    }, LAG_MS);
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    removePlayerBySocket(ws);
    broadcast({
      type: "player_count",
      count: players.size
    });
  });
});

// Broadcast helper
function broadcast(msgObj) {
  const data = JSON.stringify(msgObj);
  for (const p of players.values()) {
    if (p.ws.readyState === WebSocket.OPEN) {
      setTimeout(() => {
        p.ws.send(data);
      }, LAG_MS);
    }
  }
}

// Handle client messages (only intent)
function handleClientMessage(ws, msg) {
  if (!msg || typeof msg !== "object") return;

  // Find which player this socket belongs to
  let player = null;
  for (const p of players.values()) {
    if (p.ws === ws) {
      player = p;
      break;
    }
  }
  if (!player) return;

  switch (msg.type) {
    case "input":
      // Expected: { type: "input", up, down, left, right }
      player.input.up = !!msg.up;
      player.input.down = !!msg.down;
      player.input.left = !!msg.left;
      player.input.right = !!msg.right;
      break;

    default:
      // ignore unknown messages
      break;
  }
}

// --- Game Loop ---
function gameLoop() {
  const now = Date.now();
  const dt = (now - lastUpdateTime) / 1000; // seconds
  lastUpdateTime = now;

  // Update player velocities & positions from their inputs
  for (const player of players.values()) {
    let dx = 0;
    let dy = 0;
    if (player.input.up) dy -= 1;
    if (player.input.down) dy += 1;
    if (player.input.left) dx -= 1;
    if (player.input.right) dx += 1;

    // Normalize direction to length 1 if diagonal
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    player.vx = dx * PLAYER_SPEED;
    player.vy = dy * PLAYER_SPEED;

    // Integrate position
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Clamp to world bounds
    player.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, player.x));
    player.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, player.y));
  }

  // Collision detect players vs coins
  for (const player of players.values()) {
    for (const [coinId, coin] of coins.entries()) {
      const dist = Math.hypot(player.x - coin.x, player.y - coin.y);
      if (dist <= PLAYER_RADIUS + COIN_RADIUS) {
        // Coin collected
        coins.delete(coinId);
        player.score += 1;
      }
    }
  }

  // Broadcast game state snapshot
  const snapshot = {
    type: "state",
    serverTime: now,
    players: [],
    coins: []
  };

  for (const p of players.values()) {
    snapshot.players.push({
      id: p.id,
      x: p.x,
      y: p.y,
      score: p.score
    });
  }

  for (const c of coins.values()) {
    snapshot.coins.push({
      id: c.id,
      x: c.x,
      y: c.y
    });
  }

  broadcast(snapshot);
}

// --- Coin Spawner ---
function spawnCoin() {
  const pos = randomPosition();
  const coin = {
    id: nextCoinId++,
    x: pos.x,
    y: pos.y
  };
  coins.set(coin.id, coin);
}

// Start loops
setInterval(gameLoop, 1000 / TICK_RATE);
setInterval(spawnCoin, COIN_SPAWN_INTERVAL_MS);
