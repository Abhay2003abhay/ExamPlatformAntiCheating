const authorizeRoles = (...allowedTypes) => (req, res, next) => {
if (!req.user || !allowedTypes.includes(req.user.type)) {
return res.status(403).json({
success: false,
message: 'Forbidden: you do not have permission to do this',
});
}
next();
};

module.exports = authorizeRoles;
