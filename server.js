
const Koa = require('koa')
const IO = require('koa-socket-2')
const ytdl = require('youtube-dl')
const fs = require('fs')

var playlist = []
var idCounter = 0
var timeAvailable = null

async function start() {
  const app = new Koa()
  const io = new IO()
  const host = process.env.HOST || '0.0.0.0'
  const port = process.env.PORT || 3000
  
  let usersCount = 0;

  app.use(async (ctx, next) => {
    // await next()
    ctx.type = 'html'
    ctx.status = 200 // koa defaults to 404 when it sees that status is unset
    ctx.body = fs.readFileSync('index.html', {'encoding': 'utf8'})

    // return new Promise((resolve, reject) => {
    //   ctx.res.on('close', resolve)
    //   ctx.res.on('finish', resolve)
    // })
  })
  io.attach(app)
  
  io.use(async (ctx, next)=> {
      console.log(ctx);
      await next()
  })

  io.on('connect', ctx => {
    console.log('a user connected')
    usersCount++;
    console.log(usersCount);
    io.broadcast('updateUserCount', usersCount)
    
    if (ctx.emit) {
        console.log("dupa");
        ctx.emit('updatePlaylist', playlist)
        ctx.emit('updateUserCount', usersCount)
    }
  })
  
  
    io.on('disconnect', (ctx, data) => {
      console.log('a user disconnected')
      usersCount--;
      io.broadcast('updateUserCount', usersCount)
      
      console.log(ctx.socket);
      if (ctx.socket) {
          ctx.socket.volatile.emit('updatePlaylist', playlist)
      }
    })
  io.on('sendPlaylistItem', async function (ctx, data) {
    console.log(data)
    let info = await getInfo(data)

    if (info.length>1) {
      for (let trackInfo of info) {
        playlist.push(createPlaylistItem(trackInfo))
      }
    } else {
      playlist.push(createPlaylistItem(info))
    }
    console.log(playlist)
    io.broadcast('updatePlaylist', playlist)
  })
  app.listen(port, host)
  console.log('Server listening on ' + host + ':' + port) // eslint-disable-line no-console
}

start()

function getInfo(data) {
  return new Promise((resolve, reject) => {
    ytdl.getInfo(data, function (err, info) {
      console.log(info);
      resolve(info)
    })
  })
}
function createPlaylistItem(info) {
  let timestamp = new Date().getTime()
  let playTime
  if (timeAvailable > timestamp) {
      playTime = timeAvailable
  } else {
    playTime = timestamp
  }
  timeAvailable = playTime + info._duration_raw * 1000
  return {start: 0, info: info, timestamp: timestamp, playTime: playTime, endTime: timeAvailable, id: idCounter++}
}
