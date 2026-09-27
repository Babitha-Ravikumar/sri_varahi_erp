/** Auth controllers - parse input, call service, send response. */
const auth = require('../services/auth.service');

const login = async (req, res, next) => {
  try { res.json(await auth.login(req.body || {})); } catch (e) { next(e); }
};

const changePassword = async (req, res, next) => {
  try {
    const userId = Number(req.header('X-User-Id'));
    if (!userId || !Number.isInteger(userId)) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    res.json(await auth.changePassword(userId, req.body || {}));
  } catch (e) { next(e); }
};

const createUser = async (req, res, next) => {
  try { res.status(201).json(await auth.createUser(req.user, req.body || {})); } catch (e) { next(e); }
};

const listUsers = async (req, res, next) => {
  try { res.json(await auth.listUsers(req.user)); } catch (e) { next(e); }
};

/** Master list of assignable roles (so the app never hardcodes them). */
const listRoles = async (_req, res, next) => {
  try { res.json(await auth.assignableRoles()); } catch (e) { next(e); }
};

const updateUser = async (req, res, next) => {
  try { res.json(await auth.updateUser(req.user, req.params.id, req.body || {})); } catch (e) { next(e); }
};

const requestResetOtp = async (req, res, next) => {
  try { res.json(await auth.requestResetOtp(req.body || {})); } catch (e) { next(e); }
};

const verifyResetOtp = async (req, res, next) => {
  try { res.json(await auth.verifyResetOtp(req.body || {})); } catch (e) { next(e); }
};

module.exports = { login, changePassword, createUser, listUsers, listRoles, updateUser, requestResetOtp, verifyResetOtp };
