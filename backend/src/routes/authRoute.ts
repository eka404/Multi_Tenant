import { Router } from "express";
import {register, login, logout, me, refresh} from "../controllers/authController.js";
import { verifyToken } from "../middlewares/auth.js";
import { loginLimiter, registerLimiter } from "../middlewares/rateLimiters.js";

const router = Router();

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.get("/me", verifyToken, me);

export default router;