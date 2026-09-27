const inwardService = require('../services/inward.service');
const lotService = require('../services/lot.service');

const createLocalFarmer = async (req, res, next) => {
  try { res.status(201).json(await inwardService.createInward('local_farmer', req.body, req.user)); }
  catch (e) { next(e); }
};
const createLocalTrader = async (req, res, next) => {
  try { res.status(201).json(await inwardService.createInward('local_trader', req.body, req.user)); }
  catch (e) { next(e); }
};
const createOutsideTrader = async (req, res, next) => {
  try { res.status(201).json(await inwardService.createInward('outside_trader', req.body, req.user)); }
  catch (e) { next(e); }
};
const createNightArrival = async (req, res, next) => {
  try { res.status(201).json(await inwardService.createInward('night_arrival', req.body, req.user)); }
  catch (e) { next(e); }
};
const listInwards = async (req, res, next) => { try { res.json(await inwardService.listInwards(req.query)); } catch (e) { next(e); } };
const consolidated = async (req, res, next) => { try { res.json(await inwardService.consolidatedView(req.query)); } catch (e) { next(e); } };
const fixFinalRate = async (req, res, next) => {
  try { res.json(await inwardService.fixFinalRate(req.params.id, req.body, req.user)); }
  catch (e) { next(e); }
};

const listLots = async (req, res, next) => { try { res.json(await lotService.listLots(req.query)); } catch (e) { next(e); } };
const lotDetail = async (req, res, next) => { try { res.json(await lotService.lotDetail(req.params.id)); } catch (e) { next(e); } };
const markCardPrinted = async (req, res, next) => { try { res.json(await lotService.markCardPrinted(req.params.id)); } catch (e) { next(e); } };
/** Download a lot document PDF (attachment -> device saves/opens it). */
const lotPdf = async (req, res, next) => {
  try {
    const { filename, buffer } = await lotService.lotPdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) { next(e); }
};

module.exports = {
  createLocalFarmer, createLocalTrader, createOutsideTrader, createNightArrival,
  listInwards, consolidated, fixFinalRate,
  listLots, lotDetail, markCardPrinted, lotPdf,
};
