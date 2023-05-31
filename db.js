const mongoose = require('mongoose')
require('dotenv').config()

const connectToDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI)

        console.log('Connected to Mongodb successfully')
    }
    catch (err) {
        console.error(err.message)
        process.exit(1)
    }
}

module.exports = connectToDb