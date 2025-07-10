import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template
from flask_socketio import SocketIO
import os, json



app = Flask(__name__)
socketio = SocketIO(app, async_mode='eventlet')

@app.route('/')
def index():
    return 'Hello, Render with Flask-SocketIO + eventlet!'

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)
connected_users = {}

USERS_FILE = "users.json"

def load_users():
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'w') as f:
            json.dump({}, f)
    with open(USERS_FILE, 'r') as f:
        return json.load(f)

def save_user(username, password):
    users = load_users()
    users[username.lower()] = password
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f)

@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username'].lower()
        password = request.form['password']
        users = load_users()
        if username in users and users[username] == password:
            session['username'] = username
            return redirect(url_for('chat'))
        else:
            return "Identifiants incorrects"
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username'].lower()
        password = request.form['password']
        users = load_users()
        if username in users:
            return "Ce nom d'utilisateur existe déjà"
        save_user(username, password)
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/chat')
def chat():
    if 'username' not in session:
        return redirect('/')
    return render_template('chat.html', username=session['username'])

@app.route('/logout')
def logout():
    username = session.get('username')
    if username and username in connected_users:
        del connected_users[username]
    session.pop('username', None)
    return redirect('/')

@socketio.on('connect')
def handle_connect():
    username = session.get('username')
    if username:
        connected_users[username] = request.sid
        emit('user_list', list(connected_users.keys()), broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    for user, sid in list(connected_users.items()):
        if sid == request.sid:
            del connected_users[user]
            break
    emit('user_list', list(connected_users.keys()), broadcast=True)

@socketio.on('offer')
def handle_offer(data):
    target_sid = connected_users.get(data['target'])
    if target_sid:
        emit('offer', {'sdp': data['sdp'], 'from': session['username']}, room=target_sid)

@socketio.on('answer')
def handle_answer(data):
    target_sid = connected_users.get(data['target'])
    if target_sid:
        emit('answer', {'sdp': data['sdp']}, room=target_sid)

@socketio.on('candidate')
def handle_candidate(data):
    target_sid = connected_users.get(data['target'])
    if target_sid:
        emit('candidate', data['candidate'], room=target_sid)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=int(os.environ.get("PORT", 5000)))
