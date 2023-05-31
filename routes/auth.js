const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
require('dotenv').config()

const User = require('../models/User');

const router = express.Router()

// @route    GET api/auth
// @desc     Get logged in user
// @access   private

router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password')

        if (!user) {
            return res.status(404).json('No user found. Please sign up.')
        }
        res.json(user)
    }
    catch (err) {
        console.error(err.message)
        res.status(500).json('Server error')
    }
})

// @route        POST api/auth
// @description  Log in user
// @access       Public

router.post('/', [
    check('email').isEmail(),
    check('password').trim().notEmpty()
],
    async (req, res) => {

        const errors = validationResult(req)

        if (!errors.isEmpty()) {
            return res.status(400).json('Please enter correct details.')
        }

        const { email, password } = req.body

        try {
            let user = await User.findOne({ email })

            if (!user) {
                return res.status(400).json('No user found. Please check your details.')
            }

            const isMatch = await bcrypt.compare(password, user.password)

            if (!isMatch) {
                return res.status(400).json('The details do not match. Please check your details.')
            }

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
        } catch (err) {
            console.error(err.message)
            res.status(500).json('Server error')
        }
    })

module.exports = router