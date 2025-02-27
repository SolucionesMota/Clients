import express from "express";
import {
  createRemitente,
  deleteRemitente,
  getRemitenteById,
  getRemitentes,
} from "../controllers/remitenteController";

const router = express.Router();

router.get("/", getRemitentes);
router.get("/:id", async (req, res) => {
  try {
    await getRemitenteById(req, res);
  } catch (e) {
    // next(e);
  }
});
router.post("/", createRemitente);
router.delete("/:id", deleteRemitente);

export default router;
