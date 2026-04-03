"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToGlobalHoF = exports.getGlobalHoF = exports.syncGameData = exports.getProfile = exports.login = void 0;
const User_1 = __importDefault(require("../models/User"));
const GlobalHoF_1 = __importDefault(require("../models/GlobalHoF"));
const auth_1 = require("../middleware/auth");
const login = async (req, res) => {
    try {
        const { username, passwordHash } = req.body;
        if (!username)
            return res.status(400).json({ error: 'Username required' });
        let user = await User_1.default.findOne({ username });
        let isNew = false;
        if (!user) {
            user = new User_1.default({ username, passwordHash: passwordHash || '', chips: 1000, lastDailyBonus: '' });
            await user.save();
            isNew = true;
        }
        else {
            // Verify password if one is stored
            if (user.passwordHash && user.passwordHash !== (passwordHash || '')) {
                return res.status(401).json({ error: 'Incorrect password.' });
            }
            // Migrate: store passwordHash on first login with new client
            if (!user.passwordHash && passwordHash) {
                user.passwordHash = passwordHash;
                await user.save();
            }
        }
        const token = (0, auth_1.generateToken)(user._id.toString(), user.username);
        res.json({
            token,
            isNew,
            user: {
                chips: user.chips,
                lastDailyBonus: user.lastDailyBonus || '',
                personalHof: user.personalHof || [],
                dex: user.dex || [],
            },
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
        if (!req.userId)
            return res.status(401).json({ error: 'Not authenticated' });
        const user = await User_1.default.findById(req.userId);
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        res.json({
            user: {
                username: user.username,
                chips: user.chips,
                lastDailyBonus: user.lastDailyBonus || '',
                personalHof: user.personalHof || [],
                dex: user.dex || [],
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get profile' });
    }
};
exports.getProfile = getProfile;
const syncGameData = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'Not authenticated' });
        const { chips, lastDailyBonus, personalHof, dex } = req.body;
        await User_1.default.findByIdAndUpdate(req.userId, { chips, lastDailyBonus, personalHof, dex });
        res.json({ ok: true });
    }
    catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Sync failed' });
    }
};
exports.syncGameData = syncGameData;
const getGlobalHoF = async (_req, res) => {
    try {
        const doc = await GlobalHoF_1.default.findOne();
        res.json({ entries: doc?.entries || [] });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch HoF' });
    }
};
exports.getGlobalHoF = getGlobalHoF;
const addToGlobalHoF = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'Not authenticated' });
        const { entry } = req.body;
        const doc = await GlobalHoF_1.default.findOne();
        const current = (doc?.entries || []);
        const updated = [...current, entry].sort((a, b) => b.bet - a.bet).slice(0, 10);
        await GlobalHoF_1.default.findOneAndUpdate({}, { entries: updated }, { upsert: true });
        res.json({ entries: updated });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update HoF' });
    }
};
exports.addToGlobalHoF = addToGlobalHoF;
//# sourceMappingURL=authController.js.map