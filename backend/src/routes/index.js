const { Router } = require('express');
const masters = require('../controllers/masters.controller');
const inward = require('../controllers/inward.controller');
const auction = require('../controllers/auction.controller');
const billing = require('../controllers/billing.controller');
const authController = require('../controllers/auth.controller');
const { requireUser, requireRole } = require('../middleware/auth');

const router = Router();

// ---------- Health ----------
router.get('/health', async (_req, res) => res.json({ status: 'ok' }));

// ---------- Authentication ----------
router.post('/auth/login', authController.login);
// Forced first-login reset - works while must_change_password is set.
router.post('/auth/change-password', authController.changePassword);

// User management (Super Admin only)
router.get('/auth/users', requireRole('super_admin'), authController.listUsers);
router.post('/auth/users', requireRole('super_admin'), authController.createUser);

// Forgot password (public, OTP-protected)
router.post('/auth/forgot-password/otp', authController.requestResetOtp);
router.post('/auth/forgot-password/verify', authController.verifyResetOtp);

// ---------- Masters ----------
router.get('/vehicles', requireUser, masters.listVehicles);
router.post('/vehicles', requireUser, masters.createVehicle);
router.put('/vehicles/:id', requireUser, masters.updateVehicle);
router.delete('/vehicles/:id', requireUser, masters.deleteVehicle);

router.get('/parties', requireUser, masters.listParties);
router.post('/parties', requireUser, masters.createParty);
router.put('/parties/:id', requireUser, masters.updateParty);

router.get('/customers', requireUser, masters.listCustomers);
router.post('/customers', requireUser, masters.createCustomer);
router.put('/customers/:id', requireUser, masters.updateCustomer);

// ---------- Inward (four purchase-source flows) ----------
router.post('/inwards/local-farmer', requireUser, inward.createLocalFarmer);
router.post('/inwards/local-trader', requireUser, inward.createLocalTrader);
router.post('/inwards/outside-trader', requireUser, inward.createOutsideTrader);
router.post('/inwards/night-arrival', requireUser, inward.createNightArrival);
router.get('/inwards', requireUser, inward.listInwards);
router.get('/inwards/consolidated', requireUser, inward.consolidated);
// Night arrival: fix morning final rate on the SAME inward (no duplicate)
router.post('/inwards/:id/final-rate', requireRole('supervisor', 'admin'), inward.fixFinalRate);

// ---------- Lots & Lot Cards ----------
router.get('/lots', requireUser, inward.listLots);
router.get('/lots/:id', requireUser, inward.lotDetail);
// Lot document PDF download - direct-link friendly (?user_id= for the browser).
router.get('/lots/:id/pdf', requireUser, inward.lotPdf);
router.post('/lots/:id/card-printed', requireUser, inward.markCardPrinted);

// ---------- Pre-Auction ----------
router.post('/lots/:lotId/pre-auction', requireUser, auction.createPreAuction);
router.get('/pre-auction', requireUser, auction.listPreAuction);

// ---------- Live Auction ----------
router.post('/auctions', requireUser, auction.openAuction);
router.get('/auctions', requireUser, auction.listAuctions);
router.get('/auctions/:id', requireUser, auction.auctionDetail);
router.post('/auctions/:id/allocations', requireUser, auction.createAllocation);
router.post('/auctions/:id/close', requireUser, auction.closeAuction);

// ---------- Billing ----------
router.post('/billing/auction/:id', requireUser, billing.generateBills);
router.get('/bills', requireUser, billing.listBills);
// PDF download - direct-link friendly (user id via ?user_id= for the browser).
router.get('/bills/:id/pdf', requireUser, billing.billPdf);
router.get('/bills/:id', requireUser, billing.billDetail);

// ---------- Cashier ----------
router.post('/bills/:id/payments', requireUser, billing.recordPayment);
router.get('/cashier/summary', requireUser, billing.cashierSummary);

// ---------- Post-Auction Corrections (authorized roles only) ----------
router.patch('/allocations/:id', requireRole('supervisor', 'admin'), billing.updateAllocation);
router.post('/allocations/:id/transfer', requireRole('supervisor', 'admin'), billing.transferQuantity);
router.post('/allocations/:id/split', requireRole('supervisor', 'admin'), billing.splitAllocation);

// ---------- Audit Trail ----------
router.get('/audit', requireUser, billing.listAudit);

module.exports = router;
