import express from 'express';
import { getLiveUSDCPrice } from '../services/priceService';
const router = express.Router();
router.get('/', async (req, res) => {
    const data = await getLiveUSDCPrice();
    res.json(data);
});
export default router;