const express = require('express')
const fs = require('fs')
const { default: mongoose } = require('mongoose')
const cloudinary = require('cloudinary').v2;
const auth = require('../middleware/auth')

const Chat = require('../models/Chat')
const User = require('../models/User')

const router = express.Router()

// @route    POST api/chats
// @desc     Create new chat or add message to existing chat
// @access   private

router.post('/', auth, async (req, res) => {

    const { userId, text } = req.body

    const image = req.files?.image

    if (!userId) {
        return res.status(400).json('User not found.')
    }

    if (!text?.trim() && !image) {
        return res.status(400).json('Write a message or provide an image.')
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json('User not found.')
    }

    try {

        const receiver = await User.findById(userId)

        if (!receiver) {
            return res.status(400).json('User not found.')
        }

        if (userId === req.user.id) {
            return res.status(400).json('Message cannot be sent to yourself.')
        }

        const newMessage = {}

        newMessage.sender = req.user.id

        if (text) newMessage.text = text

        if (image) {

            if (fs.statSync(image.tempFilePath).size / (1024 * 1024) > 1) {
                fs.unlink(image.tempFilePath, (err) => {
                    if (err) {
                        console.log(err);
                    }
                    console.log('Local file deleted successfully');
                });
                return res.status(400).json('Image size must be less than 1mb.')
            }

            const imageURL = await cloudinary.uploader.upload(image.tempFilePath)

            fs.unlink(image.tempFilePath, (err) => {
                if (err) {
                    console.log(err);
                }
            });
            newMessage.image = imageURL.secure_url
            newMessage.imagePublicId = imageURL.public_id
        }

        const chat = await Chat.findOne({
            $and: [
                { isGroupChat: false },
                { users: { $all: [req.user.id, userId] } }
            ]
        })

        if (chat) {

            const response = await Chat.findByIdAndUpdate(chat._id,
                {
                    messages: [...chat.messages, newMessage]
                },
                { new: true })
                .populate('users', '_id name profilePicture')
                .populate('messages.sender', '_id name profilePicture')

            return res.json(response)
        }

        else {
            // Build new chat
            const newChat = new Chat({
                users: [req.user.id, userId],
                messages: [
                    newMessage
                ]
            })

            await newChat.save()

            await (await newChat.populate('users', '_id name profilePicture')).populate('messages.sender', '_id name profilePicture')

            res.json(newChat)
        }
    }
    catch (error) {
        console.error(error.message)
        res.status(500).json('Server error')
    }
}
)

// @route    POST api/chats/group
// @desc     Create new group
// @access   private

router.post('/group', auth, async (req, res) => {

    const { userIds, groupName } = req.body

    const groupPhoto = req.files?.groupPhoto

    if (userIds?.split(',').length < 2) {
        return res.status(400).json('Please add atleast two other participants.')
    }

    if (!groupName?.trim()) {
        return res.status(400).json('Please choose a group name.')
    }

    let userIdsArray = userIds.split(',').map(id => id.trim())

    if (userIdsArray.includes(req.user.id)) {
        return res.status(400).json('You are already in the group.')
    }

    const idErrors = []
    userIdsArray.forEach(id => {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            idErrors.push(id)
        }
    });

    if (idErrors.length) {
        return res.status(400).json('User/s not found.')
    }

    userIdsArray.push(req.user.id)

    try {
        const group = await Chat.findOne({
            $and: [
                { isGroupChat: true },
                { users: { $all: userIdsArray } }
            ]
        })

        if (group) {
            return res.status(400).json('A group with these participants already exist.')
        }

        const newGroupFields = {}

        newGroupFields.users = userIdsArray
        newGroupFields.isGroupChat = true
        newGroupFields.groupName = groupName
        newGroupFields.groupAdmin = req.user.id

        if (groupPhoto) {

            if (fs.statSync(groupPhoto.tempFilePath).size / (1024 * 1024) > 1) {
                fs.unlink(groupPhoto.tempFilePath, (err) => {
                    if (err) {
                        console.log(err);
                    }
                    console.log('Local file deleted successfully');
                });

                return res.status(400).json('Image size must be less than 1mb.')
            }

            const imageURL = await cloudinary.uploader.upload(groupPhoto.tempFilePath)

            fs.unlink(groupPhoto.tempFilePath, (err) => {
                if (err) {
                    console.log(err);
                }
            });
            newGroupFields.groupPhoto = imageURL.secure_url
            newGroupFields.groupPhotoPublicId = imageURL.public_id
        }

        else {
            newGroupFields.groupPhoto = 'https://icon-library.com/images/persons-icon/persons-icon-11.jpg'
        }

        const newGroup = new Chat(newGroupFields)

        await newGroup.save()

        await (await newGroup.populate('users', '_id name profilePicture')).populate('groupAdmin', '_id name profilePicture')

        res.json(newGroup)
    }
    catch (error) {
        console.error(error.message)
        res.status(500).json('Server error')
    }
}
)


// @route    PUT api/chats/group/newMessage
// @desc     Add new group message
// @access   private

router.put('/group/newMessage', auth, async (req, res) => {

    const { groupId, text } = req.body

    const image = req.files?.image

    if (!text?.trim() && !image) {
        return res.status(400).json('Write a message or provide an image.')
    }

    try {
        const group = await Chat.findById(groupId)

        if (!group) {
            return res.status(400).json('Group not found.')
        }

        const newMessage = {}

        newMessage.sender = req.user.id

        if (text) newMessage.text = text

        if (image) {

            if (fs.statSync(image.tempFilePath).size / (1024 * 1024) > 1) {
                fs.unlink(image.tempFilePath, (err) => {
                    if (err) {
                        console.log(err);
                    }
                    console.log('Local file deleted successfully');
                });

                return res.status(400).json('Image size must be less than 1mb.')
            }

            const imageURL = await cloudinary.uploader.upload(image.tempFilePath)

            fs.unlink(image.tempFilePath, (err) => {
                if (err) {
                    console.log(err);
                }
            });
            newMessage.image = imageURL.secure_url
            newMessage.imagePublicId = imageURL.public_id
        }

        const response = await Chat.findByIdAndUpdate(group._id,
            {
                messages: [...group.messages, newMessage]
            },
            { new: true })
            .populate('users', '_id name profilePicture')
            .populate('messages.sender', '_id name profilePicture')
            .populate('groupAdmin', '_id name profilePicture')
            .sort({ updatedAt: -1 })

        return res.json(response)
    }
    catch (error) {
        console.error(error.message)
        res.status(500).json('Server error')
    }
}
)

// @route    PUT api/chats/group/addUser
// @desc     Add user to group
// @access   private

router.put('/group/addUser', auth, async (req, res) => {

    const { groupId, userId } = req.body

    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
        return res.status(400).json('Group not found.')
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json('User not found')
    }

    try {
        const group = await Chat.findById(groupId)

        if (!group) {
            return res.status(400).json('Group not found.')
        }

        const user = await User.findById(userId)

        if (!user) {
            return res.status(400).json('User not found.')
        }

        if (group.users.includes(userId)) {
            return res.status(400).json('Participant is already in the group.')
        }

        if (req.user.id !== group.groupAdmin.toString()) {
            return res.status(400).json('Only group admin can add participants.')
        }

        const response = await Chat.findByIdAndUpdate(group._id,
            {
                users: [...group.users, userId]
            },
            { new: true }
        ).populate('users', '_id name profilePicture')
            .populate('messages.sender', '_id name profilePicture')
            .populate('groupAdmin', '_id name profilePicture')
            .sort({ updatedAt: -1 })

        res.json(response)

    } catch (error) {
        console.error(error.message)
        res.status(500).json('Server error')
    }
})

// @route    PUT api/chats/group/removeUser
// @desc     Remove user from group
// @access   private

router.put('/group/removeUser', auth, async (req, res) => {

    const { groupId, userId } = req.body

    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
        return res.status(400).json('Group not found.')
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json('User not found')
    }

    try {
        const group = await Chat.findById(groupId)

        if (!group) {
            return res.status(400).json('Group not found')
        }

        const user = await User.findById(userId)

        if (!user) {
            return res.status(400).json('User not found.')
        }

        if (req.user.id !== group.groupAdmin.toString()) {
            return res.status(400).json('Only group admin can remove participants.')
        }

        const response = await Chat.findByIdAndUpdate(group._id,
            {
                users: group.users.filter(user => user.toString() !== userId)
            },
            { new: true }
        ).populate('users', '_id name profilePicture')
            .populate('messages.sender', '_id name profilePicture')
            .populate('groupAdmin', '_id name profilePicture')
            .sort({ updatedAt: -1 })

        res.json(response)

    } catch (error) {
        console.error(error.message)
        res.status(500).json('Server error')
    }
})


// @route        PUT api/chats/group
// @description  Edit group
// @access       Private

router.put('/group', auth,
    async (req, res) => {
        const { name, id } = req.body

        const photo = req.files?.photo

        if (!id.trim()) {
            return res.status(400).json('Group not found.')
        }

        try {
            let group = await Chat.findById(id)

            if (!group) {
                return res.status(400).json('Group not found.')
            }

            if (req.user.id !== group.groupAdmin.toString()) {
                return res.status(400).json('Only group admin can edit group details.')
            }

            if (name !== undefined && (!name.trim() || name.length > 50)) {
                return res.status(400).json('Group name length should be 1-50 characters.')
            }

            const groupFields = {}

            if (name) groupFields.groupName = name

            // Check if photo is sent or not
            if (photo) {

                if (fs.statSync(photo.tempFilePath).size / (1024 * 1024) > 1) {
                    fs.unlink(photo.tempFilePath, (err) => {
                        if (err) {
                            console.log(err);
                        }
                        console.log('Local file deleted successfully');
                    });

                    return res.status(400).json('Image size must be less than 1mb.')
                }

                const photoURL = await cloudinary.uploader.upload(photo.tempFilePath)

                fs.unlink(photo.tempFilePath, (err) => {
                    console.log('Local file deleted')
                    if (err) {
                        console.log(err);
                    }
                });

                if (group.groupPhotoPublicId) {
                    await cloudinary.uploader.destroy(group.groupPhotoPublicId);
                }

                groupFields.groupPhoto = photoURL.secure_url
                groupFields.groupPhotoPublicId = photoURL.public_id
            }

            group = await Chat.findByIdAndUpdate(id, { $set: groupFields }, { new: true })
                .populate('users', '_id name profilePicture')
                .populate('messages.sender', '_id name profilePicture')
                .populate('groupAdmin', '_id name profilePicture')
                .sort({ updatedAt: -1 })

            res.status(200).json(group)

        } catch (error) {
            console.error(error.message)
            return res.status(500).json('Server error. Please try again later.')
        }
    }
)

// @route        PUT api/chats/group/removephoto
// @description  Remove group photo
// @access       Private

router.put('/group/removephoto', auth,
    async (req, res) => {
        const { id, photoPublicId } = req.body

        try {
            let group = await Chat.findById(id)

            if (req.user.id !== group.groupAdmin.toString()) {
                return res.status(400).json('Only group admin can remove photo.')
            }

            const groupFields = {
                groupPhoto: 'https://icon-library.com/images/persons-icon/persons-icon-11.jpg'
            }

            await cloudinary.uploader.destroy(photoPublicId);

            group = await Chat.findByIdAndUpdate(id, { $set: groupFields }, { new: true })
                .populate('users', '_id name profilePicture')
                .populate('messages.sender', '_id name profilePicture')
                .populate('groupAdmin', '_id name profilePicture')
                .sort({ updatedAt: -1 })

            res.status(200).json(group)

        } catch (error) {
            console.error(error.message)
            return res.status(500).json('Server error. Please try again later.')
        }
    }
)

// @route    PUT api/chats/group/leavegroup/:id
// @desc     Leave group
// @access   private

router.put('/group/leavegroup/:id', auth, async (req, res) => {
    try {
        const group = await Chat.findById(req.params.id)

        if (!group) {
            return res.status(400).json('Group not found.')
        }

        let groupFields = {}

        groupFields.users = group.users.filter(item => item._id.toString() !== req.user.id)
        groupFields.groupAdmin = groupFields.users[0]

        const response = await Chat.findByIdAndUpdate(req.params.id, { $set: groupFields }, { new: true })

        res.status(200).json(response)

    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(400).json('Group not found')
        }
        res.status(500).json('Server error')
    }
})

// @route    GET api/chats
// @desc     Get all chats
// @access   private

router.get('/', auth, async (req, res) => {

    try {
        const chats = await Chat.find({ 'users': req.user.id })
            .populate('users', '_id name profilePicture')
            .populate('messages.sender', '_id name profilePicture')
            .populate('groupAdmin', '_id name profilePicture')
            .sort({ updatedAt: -1 })

        res.json(chats)

    } catch (error) {
        console.error(error.message)
        res.status(500).json('Server error')
    }
})

module.exports = router