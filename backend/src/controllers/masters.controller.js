/** Thin controllers - parse input, call service, send response. */
const masters = require('../services/masters.service');

// Vehicles
const listVehicles = async (req, res, next) => { try { res.json(await masters.vehicles.list()); } catch (e) { next(e); } };
const createVehicle = async (req, res, next) => { try { res.status(201).json(await masters.vehicles.create(req.body)); } catch (e) { next(e); } };
const updateVehicle = async (req, res, next) => { try { res.json(await masters.vehicles.update(req.params.id, req.body)); } catch (e) { next(e); } };
const deleteVehicle = async (req, res, next) => { try { res.json(await masters.vehicles.remove(req.params.id)); } catch (e) { next(e); } };

// Parties
const listParties = async (req, res, next) => { try { res.json(await masters.parties.list(req.query)); } catch (e) { next(e); } };
const createParty = async (req, res, next) => { try { res.status(201).json(await masters.parties.create(req.body)); } catch (e) { next(e); } };
const updateParty = async (req, res, next) => { try { res.json(await masters.parties.update(req.params.id, req.body)); } catch (e) { next(e); } };

// Customers
const listCustomers = async (req, res, next) => { try { res.json(await masters.customers.list(req.query)); } catch (e) { next(e); } };
const createCustomer = async (req, res, next) => { try { res.status(201).json(await masters.customers.create(req.body)); } catch (e) { next(e); } };
const updateCustomer = async (req, res, next) => { try { res.json(await masters.customers.update(req.params.id, req.body)); } catch (e) { next(e); } };

const listUsers = async (_req, res, next) => { try { res.json(await masters.users.list()); } catch (e) { next(e); } };

module.exports = {
  listVehicles, createVehicle, updateVehicle, deleteVehicle,
  listParties, createParty, updateParty,
  listCustomers, createCustomer, updateCustomer,
  listUsers,
};
