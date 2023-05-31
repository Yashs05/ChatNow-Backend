const express = require('express')
const connectToDb = require('./db')
const fileUpload = require('express-fileupload')
const cors = require('cors')
const cloudinary = require('cloudinary').v2;
require('dotenv').config()
const { Server } = require('socket.io')

const app = express()

// Connect to database
connectToDb()

// Initialize middleware
app.use(express.json({ extended: false, limit: '50mb' }))

app.use(fileUpload({
    useTempFiles: true,
}))

app.use(cors())

// Configuration 
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

// Routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/users', require('./routes/users'))
app.use('/api/chats', require('./routes/chats'))

const PORT = process.env.PORT || 5000

const server = app.listen(PORT, () => {
    console.log(`Server started at port ${PORT}`)
})

const io = new Server(server, {
    cors: true,
    pingTimeout: 10000,
    origins: ['exp://192.168.1.7:19000']
})

io.on('connection', socket => {

    socket.on('join', userId => {
        socket.join(userId)
        console.log(`${userId} joined`)
    })

    socket.on('new message', (chat, userId) => {

        chat.users.forEach(user => {
            if (user._id === userId) return;

            socket.in(user._id).emit('message received', chat)
        })
    })

    socket.on('new group', group => {

        group.users.forEach(user => {
            if (user._id === group.groupAdmin.toString()) return;

            socket.in(user._id).emit('group created', group)
        })
    })

    socket.on('edit group', group => {

        group.users.forEach(user => {
            if (user._id === group.groupAdmin.toString()) return;

            socket.in(user._id).emit('group edited', group)
        })
    })

    socket.on('group photo remove', group => {

        group.users.forEach(user => {
            if (user._id === group.groupAdmin.toString()) return;

            socket.in(user._id).emit('group photo removed', group)
        })
    })

    socket.on('add to group', (group, id) => {

        group.users.forEach(user => {
            if (user._id === group.groupAdmin.toString()) return;

            if (user._id === id) {
                socket.in(user._id).emit('added to group', group)
            }
            else {
                socket.in(user._id).emit('other user added to group', group)
            }
        })
    })

    socket.on('remove from group', (group, userId) => {

        group.users.forEach(user => {
            if (user._id === group.groupAdmin.toString()) return;

            if (user._id === id) {
                socket.in(userId).emit('removed from group', group)
            }
            else {
                socket.in(user._id).emit('other user removed from group', group)
            }
        })
    })

    socket.on('leave group', group => {

        group.users.forEach(user => {
            if (user._id === group.groupAdmin.toString()) return;

            socket.in(user._id).emit('user left', group)
        })
    })

    socket.on('typing', (chat, userId, name) => {

        chat.users.forEach(user => {
            if (user._id === userId) return;

            socket.in(user._id).emit('typing started', true, name)
        })
    })

    socket.on('stop typing', (chat, userId) => {

        chat.users.forEach(user => {
            if (user._id === userId) return;

            socket.in(user._id).emit('typing stopped', false)
        })
    })

    socket.on('disconnect', () => {
        console.log('user disconnected');
    })
})

app.get('/', (req, res) => {
    res.send('Api running')
})

