const fs = require('fs')
const express = require('express');
const { check, validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config()

const router = express.Router()

const User = require('../models/User');
const auth = require('../middleware/auth');

// @route        POST api/users
// @description  Register user
// @access       Public

router.post('/', [
    check('name').trim().notEmpty(),
    check('email').isEmail(),
    check('username').trim().notEmpty(),
    check('password').matches(/^(?=.*\d)(?=.*[a-zA-Z]).{6,15}$/)
],
    async (req, res) => {
        const errors = validationResult(req)

        if (!errors.isEmpty()) {
            return res.status(400).json('Please enter correct details.')
        }

        const { name, email, username, password } = req.body

        const profilePicture = req.files?.profilePicture

        try {
            let user = await User.findOne({ email: email })

            if (user) {
                return res.status(400).json('Email provided is already registered.')
            }

            if (user && user.username === username) {
                return res.status(400).json(`Username ${user.username} is not available.`)
            }

            // Check if photo is sent or not
            if (profilePicture) {

                if (fs.statSync(profilePicture.tempFilePath).size / (1024 * 1024) > 1) {
                    fs.unlink(profilePicture.tempFilePath, (err) => {
                        if (err) {
                            console.log(err);
                        }
                        console.log('Local file deleted successfully');
                    });

                    return res.status(400).json('Image size must be less than 1mb.')
                }

                const profilePictureURL = await cloudinary.uploader.upload(profilePicture.tempFilePath)

                fs.unlink(profilePicture.tempFilePath, (err) => {
                    console.log('Local file deleted')
                    if (err) {
                        console.log(err);
                    }
                });

                // Create user instance with photo
                user = new User({
                    name,
                    email,
                    username,
                    password,
                    profilePicture: profilePictureURL.secure_url,
                    profilePicturePublicID: profilePictureURL.public_id
                })
            }
            else {
                // Create user instance with default photo
                user = new User({
                    name,
                    email,
                    username,
                    password
                })
            }

            // Encrypt password
            const salt = await bcrypt.genSalt(10)

            user.password = await bcrypt.hash(password, salt)

            // Save user to database
            await user.save()

            // Return jsonwebtoken
            const payload = {
                user: {
                    id: user.id
                }
            }

            jwt.sign(payload,
                process.env.JWT_SECRET,
                { expiresIn: '7d' },
                (err, token) => {
                    if (err) throw err;
                    res.json({ token })
                })

        } catch (error) {
            console.error(error.message)
            return res.status(500).json('Server error. Please try again later.')
        }
    }
)

// @route        PUT api/users
// @description  Edit user
// @access       Private

router.put('/', auth,
    async (req, res) => {
        const { name, username, status } = req.body

        const profilePicture = req.files?.profilePicture

        try {
            let user = await User.findById(req.user.id)

            if (!user) {
                return res.status(400).json('User not found.')
            }

            if (name !== undefined && (!name.trim() || name.length > 25)) {
                return res.status(400).json('Name length should be 1-25 characters.')
            }

            if (username !== undefined && (!username.trim() || username.length > 25)) {
                return res.status(400).json('Username length should be 1-25 characters.')
            }

            if (status !== undefined && (!status.trim() || status.length > 100)) {
                return res.status(400).json('Name length should be 1-100 characters.')
            }

            const userFields = {}

            if (name) userFields.name = name
            if (username) {
                const check = await User.findOne({ username: username })

                if (check) {
                    return res.status(400).json('Username is already taken.')
                }

                userFields.username = username
            }
            if (status) userFields.status = status

            // Check if photo is sent or not
            if (profilePicture) {

                if (fs.statSync(profilePicture.tempFilePath).size / (1024 * 1024) > 1) {
                    fs.unlink(profilePicture.tempFilePath, (err) => {
                        if (err) {
                            console.log(err);
                        }
                        console.log('Local file deleted successfully');
                    });

                    return res.status(400).json('Image size must be less than 1mb.')
                }

                const profilePictureURL = await cloudinary.uploader.upload(profilePicture.tempFilePath)

                fs.unlink(profilePicture.tempFilePath, (err) => {
                    console.log('Local file deleted')
                    if (err) {
                        console.log(err);
                    }
                });

                if (user.profilePicturePublicID) {
                    await cloudinary.uploader.destroy(user.profilePicturePublicID);
                }

                userFields.profilePicture = profilePictureURL.secure_url
                userFields.profilePicturePublicID = profilePictureURL.public_id
            }

            user = await User.findByIdAndUpdate(req.user.id, { $set: userFields }, { new: true }).select('-password')

            res.status(200).json(user)

        } catch (error) {
            console.error(error.message)
            return res.status(500).json('Server error. Please try again later.')
        }
    }
)

// @route        PUT api/users/removephoto
// @description  Remove profile picture
// @access       Private

router.put('/removephoto', auth,
    async (req, res) => {
        const { profilePicturePublicID } = req.body

        try {
            let user = await User.findById(req.user.id)

            const userFields = {
                profilePicture: 'https://icon-library.com/images/my-profile-icon-png/my-profile-icon-png-14.jpg'
            }

            await cloudinary.uploader.destroy(profilePicturePublicID);

            user = await User.findByIdAndUpdate(req.user.id, { $set: userFields }, { new: true }).select('-password')

            res.status(200).json(user)

        } catch (error) {
            console.error(error.message)
            return res.status(500).json('Server error. Please try again later.')
        }
    }
)

// @route        GET api/users
// @description  Get users
// @access       Public

router.get('/', auth, async (req, res) => {

    const keyword = req.query.search

    let users;

    try {
        if (keyword) {
            users = await User.find({
                $or: [
                    { name: { $regex: keyword, $options: 'i' } },
                    { username: { $regex: keyword, $options: 'i' } }
                ]
            }).select('_id name username profilePicture')
        }
        else {
            users = await User.find().select('_id name username profilePicture')
        }

        const response = users.filter(item => item._id.toString() !== req.user.id)

        res.json(response)
    } catch (error) {
        console.error(error.message)
        res.status(500).json('Server error.')
    }
})

// @route        GET api/users/:id
// @description  Get user by id
// @access       Public

router.get('/:id', async (req, res) => {

    try {
        const user = await User.findById(req.params.id)

        res.status(200).json(user)
    } catch (error) {
        console.log(error)
        if (error.kind === 'ObjectId') {
            return res.status(400).json('User not found.')
        }
        res.status(500).json('Server error.')
    }
})

module.exports = router
