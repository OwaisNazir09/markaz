const jwt = require("jsonwebtoken");

const apiAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "No token provided",
            });
        }

        const parts = authHeader.split(" ");

        if (parts.length !== 2 || parts[0] !== "Bearer") {
            return res.status(401).json({
                success: false,
                message: "Malformed authorization header",
            });
        }

        const token = parts[1];

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT secret missing");
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;

        if (req.user.role !== "management" && req.user.role !== "shopkeeper") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Role not authorized for mobile API.",
            });
        }

        next();
    } catch (err) {
        console.log("API Auth error:", err.message);

        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, message: "Token expired" });
        }

        if (err.name === "JsonWebTokenError") {
            return res.status(401).json({ success: false, message: "Invalid token" });
        }

        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }
};

module.exports = apiAuth;
