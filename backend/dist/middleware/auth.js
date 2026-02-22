"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'default-secret');
        req.userId = decoded.userId;
        req.username = decoded.username;
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};
exports.authMiddleware = authMiddleware;
const generateToken = (userId, username) => {
    return jsonwebtoken_1.default.sign({ userId, username }, process.env.JWT_SECRET || 'default-secret', {
        expiresIn: '24h'
    });
};
exports.generateToken = generateToken;
//# sourceMappingURL=auth.js.map