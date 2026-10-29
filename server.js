const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || '*' } });

app.use(express.static('public'));

// ICE config: STUN by default. Add a TURN server via env vars so calls work
// behind mobile networks / strict NATs (TURN_URL, TURN_USERNAME, TURN_CREDENTIAL).
app.get('/ice-config', (req, res) => {
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL.split(','),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    });
  }
  res.json({ iceServers });
});

app.get('/online', (req, res) => res.json({ online: io.engine.clientsCount }));

let queue = []; // socket ids waiting for a partner

function removeFromQueue(id) {
  queue = queue.filter(x => x !== id);
}

function unpair(socket, notify = true) {
  const pid = socket.partner;
  socket.partner = null;
  if (!pid) return;
  const p = io.sockets.sockets.get(pid);
  if (p && p.partner === socket.id) {
    p.partner = null;
    if (notify) {
      p.emit('partner-left');
      findPartner(p); // put the remaining user back into matching
    }
  }
}

function findPartner(socket) {
  if (!socket.connected) return;
  removeFromQueue(socket.id);
  unpair(socket, true);

  while (queue.length > 0) {
    const pid = queue.shift();
    const partner = io.sockets.sockets.get(pid);
    if (!partner || !partner.connected || partner.id === socket.id || partner.partner) continue;
    socket.partner = partner.id;
    partner.partner = socket.id;
    socket.emit('matched', { partner: partner.id, initiator: true });
    partner.emit('matched', { partner: socket.id, initiator: false });
    return;
  }
  queue.push(socket.id);
  socket.emit('waiting');
}

io.on('connection', (socket) => {
  socket.partner = null;
  io.emit('online', io.engine.clientsCount);

  socket.on('find-partner', () => findPartner(socket));

  // Signaling relay: only allowed between currently matched partners.
  const relay = (event) => (data) => {
    if (!data || data.to !== socket.partner) return;
    io.to(data.to).emit(event, { ...data, from: socket.id });
  };
  socket.on('offer', relay('offer'));
  socket.on('answer', relay('answer'));
  socket.on('ice-candidate', relay('ice-candidate'));

  socket.on('chat', (data) => {
    if (!socket.partner || !data || typeof data.text !== 'string') return;
    io.to(socket.partner).emit('chat', { text: data.text.slice(0, 500) });
  });

  socket.on('report', () => {
    console.log('REPORT: user', socket.id, 'reported partner', socket.partner);
  });

  socket.on('next', () => {
    const old = socket.partner;
    unpair(socket, true);
    if (old) socket.emit('searching');
    findPartner(socket);
  });

  socket.on('disconnect', () => {
    removeFromQueue(socket.id);
    unpair(socket, true);
    io.emit('online', io.engine.clientsCount);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server on ' + PORT));
