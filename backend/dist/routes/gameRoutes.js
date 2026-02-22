"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const gameController_1 = require("../controllers/gameController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/create', auth_1.authMiddleware, gameController_1.createGameTable);
router.post('/join', auth_1.authMiddleware, gameController_1.joinGameTable);
router.get('/available', auth_1.authMiddleware, gameController_1.listAvailableGames);
router.get('/:tableId', auth_1.authMiddleware, gameController_1.getGameTable);
router.post('/:tableId/start', auth_1.authMiddleware, gameController_1.startGame);
exports.default = router;
//# sourceMappingURL=gameRoutes.js.map