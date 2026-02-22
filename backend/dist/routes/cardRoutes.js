"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cardController_1 = require("../controllers/cardController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/list', auth_1.authMiddleware, cardController_1.listAllCards);
router.get('/stats', auth_1.authMiddleware, cardController_1.getCardStats);
router.post('/seed', cardController_1.seedCards); // No auth for dev seeding
exports.default = router;
//# sourceMappingURL=cardRoutes.js.map