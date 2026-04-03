"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/login', authController_1.login);
router.get('/profile', auth_1.authMiddleware, authController_1.getProfile);
router.put('/sync', auth_1.authMiddleware, authController_1.syncGameData);
router.get('/hof', authController_1.getGlobalHoF);
router.post('/hof', auth_1.authMiddleware, authController_1.addToGlobalHoF);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map