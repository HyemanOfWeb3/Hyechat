import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (jwtErr) {
      console.log("JWT verification failed:", jwtErr && jwtErr.message);
      return res
        .status(401)
        .json({ message: "Unauthorized - Invalid or expired token" });
    }

    const user = await User.findById(decoded.userId).select(
      "-password -emailVerificationOTPHash -emailVerificationExpiresAt -emailVerificationAttempts -emailVerificationLastSentAt -emailVerificationResendCount -resetPasswordToken -resetPasswordExpires",
    );

    if (!user) {
      return res.status(401).json({ message: "Unauthorized - User not found" });
    }
    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ message: "Unauthorized - Session expired" });
    }

    req.user = user;

    next();
  } catch (error) {
    console.log("Error in protectRoute middleware", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const optionalProtectRoute = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt;
    if (!token) {
      req.user = null;
      return next();
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch {
      req.user = null;
      return next();
    }

    const user = await User.findById(decoded.userId).select(
      "-password -emailVerificationOTPHash -emailVerificationExpiresAt -emailVerificationAttempts -emailVerificationLastSentAt -emailVerificationResendCount -resetPasswordToken -resetPasswordExpires",
    );

    req.user =
      user && (decoded.tokenVersion ?? 0) === (user.tokenVersion ?? 0)
        ? user
        : null;
    next();
  } catch {
    req.user = null;
    next();
  }
};

