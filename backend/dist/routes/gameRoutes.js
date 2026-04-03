"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const gameController_1 = require("../controllers/gameController");
const router = express_1.default.Router();
// No auth required - username passed in body
router.post('/create', gameController_1.createGameTable);
router.post('/join', gameController_1.joinGameTable);
router.get('/available', gameController_1.listAvailableGames);
router.get('/:tableId', gameController_1.getGameTable);
router.post('/:tableId/start', gameController_1.startGame);
exports.default = router;
//# sourceMappingURL=gameRoutes.js.map