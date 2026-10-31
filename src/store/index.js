// Picks the data store. Both stores expose the same async functions:
//   init, close,
//   createMember, findMemberByEmail, getMember, updateProfile, setResume,
//   listDirectory, listPending, setStatus, setRole,
//   upsertTempAdmin, deleteTempAdmins,
//   createSession, getSessionMember, deleteSession, deleteExpiredSessions,
//   addJoinRequest
const config = require('../config');

module.exports = config.dbClient === 'memory' ? require('./memory') : require('./oracle');
