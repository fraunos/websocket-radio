const Koa = require('koa')
const IO = require('koa-socket-2')
const ytdl = require('youtube-dl-exec')
const fs = require('fs')

let idCounter = 0
let users = [];
let currentTrack = null
let playlist = []

const app = new Koa()
const io = new IO()
const host = process.env.HOST || '0.0.0.0'
const port = process.env.PORT || 3002


app.use(async ctx => {
  if (ctx.originalUrl === "/") {
    ctx.type = 'html'
    ctx.status = 200
    ctx.body = fs.readFileSync('index.html', {
      'encoding': 'utf8'
    })

  }
})

io.attach(app)

io.on('connect', ctx => {
  console.log(`a user connected ${ctx.handshake.query.username}`)
  const user = {
    id: ctx.id,
    username: ctx.handshake.query.username,
    connected: true,
    playlist: [],
    color: randomColor()
  }
  users.push(user)
  io.broadcast('updateUsers', getConnectedUsers().map(i => i.username))

  console.log('currentTrack')
  console.log(currentTrack)

  if (ctx.emit) {
    ctx.emit('updatePlaylist', playlist)
    ctx.emit('updateCurrentTrack', currentTrack)
    ctx.emit('updateUsers', getConnectedUsers().map(i => i.username))
    ctx.emit('updateUserColor', user.color)
  }
})


io.on('disconnect', (ctx, data) => {
  console.log(ctx)
  console.log(data)
  console.log(`a user disconnected ${getUser(ctx.socket.id).username}`)
  users.find(i => i.id === ctx.socket.id).connected = false;
  io.broadcast('updateUsers', getConnectedUsers().map(i => i.username))
})

setInterval(() => {
  io.broadcast('timesync', new Date())


}, 1000);

io.on('sendPlaylistItem', async function(ctx, data) {
  console.log(`user ${ctx.socket.id} sent ${data}`)
  let info = await ytdl(data, {
    dumpSingleJson: true,
    noCheckCertificates: true,
    noWarnings: true,
    format: ['ba'],
    addHeader: [
      'referer:youtube.com',
      'user-agent:googlebot'
    ]
  })

  if (info.length > 1) {
    for (let trackInfo of info) {
      getUser(ctx.socket.id).playlist.push(createPlaylistItem(ctx.socket.id, trackInfo))
    }
  } else {
    getUser(ctx.socket.id).playlist.push(createPlaylistItem(ctx.socket.id, info))
  }
  console.log(getUser(ctx.socket.id).playlist.length)
  console.log(getUser(ctx.socket.id).playlist)
  playlist = shufflePlaylist()
  if (!currentTrack || currentTrack.played) updateCurrentTrack()
  io.broadcast('updatePlaylist', playlist)

})


app.listen(port, host)
console.log('Server listening on http://' + host + ':' + port) // eslint-disable-line no-console


function createPlaylistItem(user, info) {
  const { title, requested_downloads, original_url, thumbnail, duration, duration_string } = info
  return {
    title,
    url: requested_downloads[0].url,
    color: getUser(user).color,
    original_url,
    thumbnail,
    duration: duration * 1000,
    duration_string,
    played: false,
    id: idCounter++
  }
}

function getConnectedUsers() {
  return users.filter(i => i.connected)
}
function getUser(id) {
  return users.find(i => i.id === id)
}
function shufflePlaylist() {
  const maxListLength = users.map(i => i.playlist.length).sort().pop()
  const playlists = users.map(i => i.playlist)
  let playlist = []
  for (let i = 0; i < maxListLength; i++) {
    for (let userPlaylist of playlists) {
      let userPlaylistItem = userPlaylist[i]
      if (userPlaylistItem) {
        playlist.push(userPlaylistItem)
      }
    }
  }
  return playlist.sort((a, b) => b.played - a.played)
}
function randomColor() {
  return "#" + (Math.floor(Math.random() * 16777215).toString(16));
}
function updateCurrentTrack() {
  if (currentTrack?.played) {
    console.log('setting current track as played')
    currentTrack = {}
    io.broadcast('updateCurrentTrack', currentTrack)
  }
  let track = playlist.find(i => !i.played)
  if (!track) return

  track.timestamp = Date.now()

  currentTrack = track

  io.broadcast('updateCurrentTrack', currentTrack)
  console.log(`Playing next song in ${track.duration + 1000} miliseconds`)
  setTimeout(() => {
    currentTrack.played = true
    updateCurrentTrack()

  }, track.duration + 1000)
}
