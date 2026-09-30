import { Router } from "express";
import {register, login, logout, me, refresh} from "../controllers/authController.js";
import { verifyToken } from "../middlewares/auth.js";

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.post("/me", verifyToken, me);

export default router;