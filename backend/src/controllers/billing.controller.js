const billing = require('../services/billing.service');
const cashier = require('../services/cashier.service');
const corrections = require('../services/corrections.service');
const audit = require('../services/audit.service');

const generateBills = async (req, res, next) => {
  try { res.status(201).json(await billing.generateBillsForAuction(req.params.id, req.user)); }
  catch (e) { next(e); }
};
const listBills = async (req, res, next) => { try { res.json(await billing.listBills(req.query)); } catch (e) { next(e); } };
const billDetail = async (req, res, next) => { try { res.json(await billing.billDetail(req.params.id)); } catch (e) { next(e); } };

/** Download a bill as a branded PDF (attachment -> browser/device saves it). */
const billPdf = async (req, res, next) => {
  try {
    const { filename, buffer } = await billing.billPdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) { next(e); }
};

const recordPayment = async (req, res, next) => {
  try { res.status(201).json(await cashier.recordPayment(req.params.id, req.body, req.user)); }
  catch (e) { next(e); }
};
const cashierSummary = async (req, res, next) => { try { res.json(await cashier.cashierSummary(req.query)); } catch (e) { next(e); } };

const updateAllocation = async (req, res, next) => {
  try { res.json(await corrections.updateAllocation(req.params.id, req.body, req.user)); }
  catch (e) { next(e); }
};
const transferQuantity = async (req, res, next) => {
  try { res.json(await corrections.transferQuantity(req.params.id, req.body, req.user)); }
  catch (e) { next(e); }
};
const splitAllocation = async (req, res, next) => {
  try { res.json(await corrections.splitAllocation(req.params.id, req.body, req.user)); }
  catch (e) { next(e); }
};

const listAudit = async (req, res, next) => { try { res.json(await audit.listAudit(req.query)); } catch (e) { next(e); } };

module.exports = {
  generateBills, listBills, billDetail, billPdf,
  recordPayment, cashierSummary,
  updateAllocation, transferQuantity, splitAllocation,
  listAudit,
};
