const { default: mongoose } = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String
    },
    status: {
        type: String,
        default: 'Available'
    },
    profilePicture: {
        type: String,
        default: 'https://icon-library.com/images/my-profile-icon-png/my-profile-icon-png-14.jpg'
    },
    profilePicturePublicID: {
        type: String
    },
},
    {
        timestamps: true
    }
)

module.exports = User = mongoose.model('user', UserSchema)