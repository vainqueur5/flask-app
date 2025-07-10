const socket = io();
let localStream, peerConnection;
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const userList = document.getElementById('userList');

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
});

socket.on('user_list', users => {
    userList.innerHTML = '<option disabled selected>Choisir un utilisateur</option>';
    users.forEach(user => {
        if (user !== username) {
            const option = document.createElement('option');
            option.value = user;
            option.text = user + " 🟢";
            userList.appendChild(option);
        }
    });
});

function startCall() {
    const target = userList.value;
    if (!target) return alert("Choisissez un utilisateur");

    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', { target, candidate: event.candidate });
        }
    };

    peerConnection.createOffer().then(offer => {
        return peerConnection.setLocalDescription(offer);
    }).then(() => {
        socket.emit('offer', { target, sdp: peerConnection.localDescription });
    });
}

socket.on('offer', data => {
    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', { target: data.from, candidate: event.candidate });
        }
    };

    peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
        return peerConnection.createAnswer();
    }).then(answer => {
        return peerConnection.setLocalDescription(answer);
    }).then(() => {
        socket.emit('answer', { target: data.from, sdp: peerConnection.localDescription });
    });
});

socket.on('answer', data => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
});

socket.on('candidate', candidate => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});
