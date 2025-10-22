import { Router } from 'express';
import { twoFactorController } from '../controllers/two-factor.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// 2FA routes (require authentication)
router.use(requireAuth);

// Generate 2FA secret and QR code
router.post('/2fa/generate', twoFactorController.generate2FASecret);

// Verify 2FA token and enable 2FA
router.post('/2fa/verify', twoFactorController.verify2FAToken);

// Disable 2FA for the current user
router.post('/2fa/disable', twoFactorController.disable2FA);

// Generate new backup codes
router.post('/2fa/backup-codes/generate', twoFactorController.generateBackupCodes);

// Verify a backup code
router.post('/2fa/backup-codes/verify', twoFactorController.verifyBackupCode);

export default router;
