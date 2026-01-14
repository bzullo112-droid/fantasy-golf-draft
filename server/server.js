const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static(path.join(__dirname, "../web")));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const DRAFTERS = ["Carter","Ethan","Dominic","Matt","Brian","Adam","Nick"];
const PICKS_PER_DRAFTER = 6;
const TOTAL_PICKS = DRAFTERS.length * PICKS_PER_DRAFTER;

let room = {
  status: "lobby",
  currentPick: 1,
  pickEndsAt: null,
  players: [],
  picks: []
};
function resetRoom(keepPlayers = true) {
  room.status = "lobby";
  room.currentPick = 1;
  room.pickEndsAt = null;
  room.picks = [];
  if (!keepPlayers) room.players = [];
}
function drafterForPick(pick) {
  const round = Math.floor((pick - 1) / DRAFTERS.length) + 1;
  const index = (pick - 1) % DRAFTERS.length;
  return round % 2 === 1 ? DRAFTERS[index] : DRAFTERS[DRAFTERS.length - 1 - index];
}
let autoPickInterval = null;
io.on("connection", (socket) => {
  socket.emit("state", room);

  socket.on("loadPlayers", (players) => {
    room.players = players;
    io.emit("state", room);
  });
socket.on("resetDraft", (keepPlayers) => {
  resetRoom(keepPlayers !== false); // default = true
  io.emit("state", room);
});
  socket.on("startDraft", () => {
    room.status = "live";
    room.currentPick = 1;
    room.pickEndsAt = Date.now() + 120000;
    io.emit("state", room);
// AUTO PICK when timer runs out
if (autoPickInterval) clearInterval(autoPickInterval);
  autoPickInterval = setInterval(() => {
  if (room.status !== "live") return;
  if (!room.pickEndsAt) return;
  if (Date.now() < room.pickEndsAt) return;

  // Pick top available player
  const drafted = new Set(room.picks.map(p => p.player));
  const next = room.players.find(p => !drafted.has(p));
  if (!next) return;

  room.picks.push({
    pick: room.currentPick,
    drafter: drafterForPick(room.currentPick),
    player: next
  });

  room.currentPick++;

  if (room.currentPick > TOTAL_PICKS) {
    room.status = "done";
    room.pickEndsAt = null;
  } else {
    room.pickEndsAt = Date.now() + 120000;
  }

  io.emit("state", room);
}, 1000);

  });

  socket.on("pick", (player) => {
    if (room.status !== "live") return;
    room.picks.push({ pick: room.currentPick, drafter: drafterForPick(room.currentPick), player });
    room.currentPick++;

    if (room.currentPick > TOTAL_PICKS) {
      room.status = "done";
      room.pickEndsAt = null;
    } else {
      room.pickEndsAt = Date.now() + 120000;
    }
    io.emit("state", room);
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Draft server running on port ${PORT}`);
});
