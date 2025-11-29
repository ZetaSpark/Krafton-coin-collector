// --- Config ---
const SERVER_URL = "ws://localhost:8080";

// We render at serverTime - INTERP_DELAY_MS (buffered interpolation)
const INTERP_DELAY_MS = 180;

// --- DOM elements ---
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const scoresEl = document.getElementById("scores");

// --- State ---
let socket = null;
let yourId = null;
let world = { width: canvas.width, height: canvas.height };
let lagMs = 0;

// For interpolation, we maintain per-player arrays of snapshots
// snapshot: { time, x, y, score }
const playerBuffers = new Map(); // id -> [snapshots]
let coinList = []; // { id, x, y }

// Track approximate offset between server clock and local clock
let serverTimeOffset = 0; // serverTime ~ Date.now() + serverTimeOffset

// Input state
const inputState = {
  up: false,
  down: false,
  left: false,
  right: false
};

// --- Setup WebSocket ---
function connect() {
  socket = new WebSocket(SERVER_URL);

  socket.onopen = () => {
    statusEl.textContent = "Connected. Waiting for game state...";
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleServerMessage(msg);
  };

  socket.onclose = () => {
    statusEl.textContent = "Disconnected from server.";
  };

  socket.onerror = (err) => {
    console.error("WebSocket error", err);
  };
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case "init":
      yourId = msg.yourId;
      world = msg.world || world;
      lagMs = msg.lagMs || 0;
      statusEl.textContent = `Connected as Player ${yourId}. Open another tab for 2-player demo.`;
      break;

    case "player_count":
      // You can show "waiting" text when <2 players
      if (msg.count < 2) {
        statusEl.textContent = `Waiting for players... (${msg.count}/2)`;
      } else {
        statusEl.textContent = `Players connected: ${msg.count}`;
      }
      break;

    case "state":
      handleStateSnapshot(msg);
      break;

    default:
      break;
  }
}

function handleStateSnapshot(snapshot) {
  const { serverTime, players, coins } = snapshot;

  // Update serverTimeOffset (simple moving average)
  const localNow = Date.now();
  const newOffset = serverTime - localNow;
  serverTimeOffset = 0.9 * serverTimeOffset + 0.1 * newOffset;

  // Update coins (no interpolation needed for coins)
  coinList = coins;

  // Update per-player buffers
  for (const p of players) {
    if (!playerBuffers.has(p.id)) {
      playerBuffers.set(p.id, []);
    }
    const buf = playerBuffers.get(p.id);
    buf.push({
      time: serverTime,
      x: p.x,
      y: p.y,
      score: p.score
    });

    // Keep buffer short
    while (buf.length > 50) {
      buf.shift();
    }
  }

  // Clean up buffers for players no longer present
  const presentIds = new Set(players.map((p) => p.id));
  for (const id of playerBuffers.keys()) {
    if (!presentIds.has(id)) {
      playerBuffers.delete(id);
    }
  }

  // Update scores display
  updateScores(players);
}

function updateScores(players) {
  players.sort((a, b) => b.score - a.score);
  const lines = players.map((p) => {
    const me = p.id === yourId ? " (You)" : "";
    return `Player ${p.id}${me}: ${p.score}`;
  });
  scoresEl.textContent = lines.join(" | ");
}

// --- Input Handling ---
window.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "w":
    case "ArrowUp":
      inputState.up = true; break;
    case "s":
    case "ArrowDown":
      inputState.down = true; break;
    case "a":
    case "ArrowLeft":
      inputState.left = true; break;
    case "d":
    case "ArrowRight":
      inputState.right = true; break;
    default:
      return;
  }
  e.preventDefault();
  sendInput();
});

window.addEventListener("keyup", (e) => {
  switch (e.key) {
    case "w":
    case "ArrowUp":
      inputState.up = false; break;
    case "s":
    case "ArrowDown":
      inputState.down = false; break;
    case "a":
    case "ArrowLeft":
      inputState.left = false; break;
    case "d":
    case "ArrowRight":
      inputState.right = false; break;
    default:
      return;
  }
  e.preventDefault();
  sendInput();
});

let lastSentInput = { up: false, down: false, left: false, right: false };

function sendInput() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  // Optional small optimization: only send when changed
  const changed =
    inputState.up !== lastSentInput.up ||
    inputState.down !== lastSentInput.down ||
    inputState.left !== lastSentInput.left ||
    inputState.right !== lastSentInput.right;

  if (!changed) return;

  lastSentInput = { ...inputState };

  const msg = {
    type: "input",
    up: inputState.up,
    down: inputState.down,
    left: inputState.left,
    right: inputState.right
  };

  socket.send(JSON.stringify(msg));
}

// --- Interpolation helpers ---
function getInterpolatedPlayerState(id, renderTime) {
  const buf = playerBuffers.get(id);
  if (!buf || buf.length === 0) return null;

  // If renderTime is before earliest, just snap to earliest
  if (renderTime <= buf[0].time) {
    return buf[0];
  }

  // If after latest, snap to latest
  const last = buf[buf.length - 1];
  if (renderTime >= last.time) {
    return last;
  }

  // Find two snapshots that enclose renderTime
  for (let i = 0; i < buf.length - 1; i++) {
    const a = buf[i];
    const b = buf[i + 1];
    if (renderTime >= a.time && renderTime <= b.time) {
      const t = (renderTime - a.time) / (b.time - a.time);
      // Linear interpolation
      return {
        time: renderTime,
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        score: b.score
      };
    }
  }

  // Fallback
  return last;
}

// --- Rendering ---
function render() {
  requestAnimationFrame(render);

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw border
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  // Compute target server time to render (buffered)
  const localNow = Date.now();
  const approxServerNow = localNow + serverTimeOffset;
  const renderTime = approxServerNow - INTERP_DELAY_MS;

  // Draw coins
  for (const coin of coinList) {
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd700"; // gold-ish
    ctx.fill();
  }

  // Draw players
  for (const [id, buf] of playerBuffers.entries()) {
    const state = getInterpolatedPlayerState(id, renderTime);
    if (!state) continue;

    const isYou = id === yourId;

    ctx.beginPath();
    ctx.arc(state.x, state.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = isYou ? "#4caf50" : "#2196f3"; // you: green, others: blue
    ctx.fill();

    // Outline local player
    if (isYou) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }

    // Draw player id
    ctx.fillStyle = "#fff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`P${id}`, state.x, state.y - 22);
  }

  // If we only have one player, show hint to open another tab
  if (playerBuffers.size <= 1) {
    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Open another browser tab to connect Player 2", canvas.width / 2, 30);
  }
}

// --- Start everything ---
connect();
requestAnimationFrame(render);
