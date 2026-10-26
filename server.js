const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let queue = [];

io.on('connection', (socket) => {
  console.log('User:', socket.id);

  socket.on('find-partner', () => {
    if(queue.length > 0){
      let partner = queue.shift();
      if(partner.connected){
        socket.partner = partner.id;
        partner.partner = socket.id;
        io.to(socket.id).emit('matched', { initiator: true });
        io.to(partner.id).emit('matched', { initiator: false });
      } else {
        queue.push(socket);
      }
    } else {
      queue.push(socket);
      socket.emit('waiting');
    }
  });

  socket.on('offer', data => io.to(data.to).emit('offer', data));
  socket.on('answer', data => io.to(data.to).emit('answer', data));
  socket.on('ice-candidate', data => io.to(data.to).emit('ice-candidate', data));
  socket.on('chat', data => { if(socket.partner) io.to(socket.partner).emit('chat', data) });

  socket.on('next', () => {
    if(socket.partner){
      io.to(socket.partner).emit('partner-left');
      let p = io.sockets.sockets.get(socket.partner);
      if(p) p.partner = null;
    }
    socket.partner = null;
    socket.emit('searching');
    // re-queue
    if(queue.length > 0){
      let partner = queue.shift();
      socket.partner = partner.id;
      partner.partner = socket.id;
      io.to(socket.id).emit('matched', { initiator: true });
      io.to(partner.id).emit('matched', { initiator: false });
    } else {
      queue.push(socket);
    }
  });

  socket.on('disconnect', () => {
    queue = queue.filter(s => s.id !== socket.id);
    if(socket.partner) io.to(socket.partner).emit('partner-left');
  });
});

server.listen(3000, () => console.log('Server on 3000'));
