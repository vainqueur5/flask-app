let localStream, peer;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  localStream = stream;
  localVideo.srcObject = stream;
});

socket.on('user_list', users => {
  const container = document.getElementById('users');
  container.innerHTML = '';
  users.forEach(user => {
    if (user !== username) {
      const div = document.createElement('div');
      div.className = 'online';
      div.textContent = user;
      div.onclick = () => callUser(user);
      container.appendChild(div);
    }
  });
});

function createPeerConnection(to) {
  peer = new RTCPeerConnection();
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  peer.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket.emit('ice_candidate', { to, candidate });
    }
  };

  peer.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  return peer;
}

function callUser(user) {
  const pc = createPeerConnection(user);
  pc.createOffer().then(offer => {
    pc.setLocalDescription(offer);
    socket.emit('call_user', { to: user, offer });
  });
}

socket.on('incoming_call', data => {
  const accept = confirm(`Appel entrant de ${data.from}. Accepter ?`);
  if (!accept) return;

  const pc = createPeerConnection(data.from);
  pc.setRemoteDescription(new RTCSessionDescription(data.offer));
  pc.createAnswer().then(answer => {
    pc.setLocalDescription(answer);
    socket.emit('answer_call', { to: data.from, answer });
  });
});

socket.on('call_answered', data => {
  peer.setRemoteDescription(new RTCSessionDescription(data.answer));
});

socket.on('ice_candidate', data => {
  peer.addIceCandidate(new RTCIceCandidate(data.candidate));
});
