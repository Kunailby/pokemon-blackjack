"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = __importDefault(require("../models/User"));
const auth_1 = require("../middleware/auth");
const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Check if user exists
        const existingUser = await User_1.default.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Create user
        const user = new User_1.default({
            username,
            email,
            password: hashedPassword,
            chips: 1000
        });
        await user.save();
        // Generate token
        const token = (0, auth_1.generateToken)(user._id.toString(), username);
        res.status(201).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                chips: user.chips
            }
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        // Find user
        const user = await User_1.default.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Check password
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Generate token
        const token = (0, auth_1.generateToken)(user._id.toString(), user.username);
        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                chips: user.chips,
                totalGamesPlayed: user.totalGamesPlayed,
                totalWins: user.totalWins
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};
exports.login = login;
const getProfile = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const user = await User_1.default.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                chips: user.chips,
                totalGamesPlayed: user.totalGamesPlayed,
                totalWins: user.totalWins,
                totalLosses: user.totalLosses
            }
        });
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
};
exports.getProfile = getProfile;
//# sourceMappingURL=authController.js.map