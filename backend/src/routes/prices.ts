import express from 'express';
import { ExchangeRateApiStrategy } from '../strategies/ExchangeRateApiStrategy';

const router = express.Router();
const pricingStrategy = new ExchangeRateApiStrategy();

router.get('/', async (req, res) => {
    const data = await pricingStrategy.getLiveUSDCPrice();
    res.json(data);
});

export default router;