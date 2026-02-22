"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const playController_1 = require("../controllers/playController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/:tableId/deal', auth_1.authMiddleware, playController_1.dealInitialCards);
router.post('/:tableId/hit', auth_1.authMiddleware, playController_1.playerHit);
router.post('/:tableId/stand', auth_1.authMiddleware, playController_1.playerStand);
router.post('/:tableId/dealer-turn', auth_1.authMiddleware, playController_1.dealerTurn);
router.get('/:tableId/state', auth_1.authMiddleware, playController_1.getGameState);
exports.default = router;
//# sourceMappingURL=playRoutes.js.map