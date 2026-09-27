const preauction = require('../services/preauction.service');
const auction = require('../services/auction.service');

const createPreAuction = async (req, res, next) => {
  try { res.status(201).json(await preauction.createPreAuctionSale(req.params.lotId, req.body, req.user)); }
  catch (e) { next(e); }
};
const listPreAuction = async (req, res, next) => { try { res.json(await preauction.listPreAuctionSales(req.query)); } catch (e) { next(e); } };

const openAuction = async (req, res, next) => {
  try { res.status(201).json(await auction.openAuction(req.body.lot_id, req.user)); }
  catch (e) { next(e); }
};
const auctionDetail = async (req, res, next) => { try { res.json(await auction.auctionDetail(req.params.id)); } catch (e) { next(e); } };
const listAuctions = async (req, res, next) => { try { res.json(await auction.listAuctions(req.query)); } catch (e) { next(e); } };
const createAllocation = async (req, res, next) => {
  try { res.status(201).json(await auction.createAllocation(req.params.id, req.body, req.user)); }
  catch (e) { next(e); }
};
const closeAuction = async (req, res, next) => {
  try { res.json(await auction.closeAuction(req.params.id, req.user)); }
  catch (e) { next(e); }
};

module.exports = {
  createPreAuction, listPreAuction,
  openAuction, auctionDetail, listAuctions, createAllocation, closeAuction,
};
