const { default: mongoose } = require("mongoose");

const ChatSchema = new mongoose.Schema({
    users: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user'
        }
    ],
    isGroupChat: {
        type: Boolean,
        default: false
    },
    groupName: {
        type: String
    },
    groupPhoto: {
        type: String
    },
    groupPhotoPublicId: {
        type: String
    },
    groupAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    messages: [
        {
            sender: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'user'
            },
            text: {
                type: String,
                trim: true
            },
            image: {
                type: String
            },
            imagePublicId: {
                type: String
            },
            date: {
                type: Date,
                default: Date.now
            }
        }
    ]
},
    {
        timestamps: true
    }
)

module.exports = Chat = mongoose.model('chat', ChatSchema)