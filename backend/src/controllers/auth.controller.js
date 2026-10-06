import { upsertStreamUser } from "../lib/stream.js";
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from "../lib/mail.js";
import User from "../models/User.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const PASSWORD_RESET_MESSAGE =
  "If an account with that email exists, a password reset link has been sent.";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_VERIFICATION_TTL_MS = 10 * 60 * 1000;
const EMAIL_VERIFICATION_COOLDOWN_MS = 60 * 1000;
const MAX_EMAIL_VERIFICATION_ATTEMPTS = 5;
const MAX_EMAIL_VERIFICATION_RESENDS = 5;

const hashVerificationOTP = (otp) =>
  crypto.createHash("sha256").update(otp).digest("hex");

const createVerificationOTP = () =>
  crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

const issueVerificationOTP = async (user) => {
  const otp = createVerificationOTP();
  user.emailVerificationOTPHash = hashVerificationOTP(otp);
  user.emailVerificationExpiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_TTL_MS,
  );
  user.emailVerificationAttempts = 0;
  user.emailVerificationLastSentAt = new Date();
  await user.save();

  try {
    await sendEmailVerificationEmail({
      email: user.email,
      fullName: user.fullName,
      otp,
    });
  } catch (error) {
    user.emailVerificationOTPHash = null;
    user.emailVerificationExpiresAt = null;
    user.emailVerificationLastSentAt = null;
    await user.save();
    throw error;
  }
};

const publicUser = (user) => {
  const data = user.toObject ? user.toObject() : { ...user };
  delete data.password;
  delete data.resetPasswordToken;
  delete data.resetPasswordExpires;
  delete data.emailVerificationOTPHash;
  delete data.emailVerificationExpiresAt;
  delete data.emailVerificationAttempts;
  delete data.emailVerificationLastSentAt;
  delete data.emailVerificationResendCount;
  return data;
};

//SIGNUP AUTHENTICATION

export async function signup(req, res) {
  const { email, password, fullName } = req.body;

  try {
    if (!email || !password || !fullName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    //const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email already exists, please use a different one" });
    }

    const idx = Math.floor(Math.random() * 100) + 1; //generate a number between 1 - 100
    const randomAvatar = `https://avatarapi.runflare.run/public/${idx}.png`;

    const newUser = await User.create({
      email,
      fullName,
      password,
      profilePic: randomAvatar,
      emailVerified: false,
    });

    try {
      await issueVerificationOTP(newUser);
    } catch (error) {
      console.error("Email verification delivery failed", error.message);
    }

    // TODO : CREATE THE USER IN STREAM AS WELL

    try {
      await upsertStreamUser({
        id: newUser._id.toString(),
        name: newUser.fullName,
        image: newUser.profilePic || "",
      });

      console.log(`Stream user created for ${newUser.fullName}`);
    } catch (error) {
      console.log("Error creating Stream user:", error);
    }

    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "7d",
      },
    );

    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    res.status(201).json({ success: true, user: publicUser(newUser) });
  } catch (error) {
    console.log("Error in signup controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function sendVerificationOTP(req, res) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.emailVerified) {
      return res.status(200).json({ success: true, alreadyVerified: true });
    }

    const now = Date.now();
    if (
      user.emailVerificationLastSentAt &&
      now - user.emailVerificationLastSentAt.getTime() <
        EMAIL_VERIFICATION_COOLDOWN_MS
    ) {
      return res.status(429).json({
        message: "Please wait before requesting another verification code",
      });
    }
    if (user.emailVerificationResendCount >= MAX_EMAIL_VERIFICATION_RESENDS) {
      return res.status(429).json({
        message:
          "Verification code request limit reached. Please try again later",
      });
    }

    user.emailVerificationResendCount += 1;
    await issueVerificationOTP(user);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Send verification email error", error.message);
    return res
      .status(500)
      .json({ message: "Unable to send verification email" });
  }
}

export async function resendVerificationOTP(req, res) {
  return sendVerificationOTP(req, res);
}

export async function verifyEmailOTP(req, res) {
  const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
  if (!/^\d{6}$/.test(otp)) {
    return res
      .status(400)
      .json({ message: "Enter the 6-digit verification code" });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.emailVerified) {
      return res.status(200).json({ success: true, user: publicUser(user) });
    }
    if (
      !user.emailVerificationOTPHash ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt <= new Date()
    ) {
      return res
        .status(400)
        .json({ message: "Verification code expired. Request a new code" });
    }
    if (user.emailVerificationAttempts >= MAX_EMAIL_VERIFICATION_ATTEMPTS) {
      return res
        .status(429)
        .json({ message: "Too many attempts. Request a new code" });
    }

    user.emailVerificationAttempts += 1;
    const submittedHash = Buffer.from(hashVerificationOTP(otp), "hex");
    const storedHash = Buffer.from(user.emailVerificationOTPHash, "hex");
    const matches =
      submittedHash.length === storedHash.length &&
      crypto.timingSafeEqual(submittedHash, storedHash);
    if (!matches) {
      await user.save();
      return res.status(400).json({ message: "Invalid verification code" });
    }

    user.emailVerified = true;
    user.emailVerificationOTPHash = null;
    user.emailVerificationExpiresAt = null;
    user.emailVerificationAttempts = 0;
    user.emailVerificationLastSentAt = null;
    user.emailVerificationResendCount = 0;
    await user.save();
    return res.status(200).json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.error("Verify email error", error.message);
    return res.status(500).json({ message: "Unable to verify email" });
  }
}

//LOGIN AUTHENTICATION

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });

    const isPasswordCorrect = await user.matchPassword(password);
    if (!isPasswordCorrect)
      return res.status(401).json({ message: "Invalid email or Password" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: "7d",
    });

    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    res.status(200).json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function forgotPassword(req, res) {
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim() : "";

  if (!email || !emailRegex.test(email)) {
    return res
      .status(400)
      .json({ message: "Please provide a valid email address" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: PASSWORD_RESET_MESSAGE });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    try {
      await sendPasswordResetEmail({
        email: user.email,
        fullName: user.fullName,
        resetToken,
      });
    } catch (error) {
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      console.error("Password reset email failed", error.message);
      return res.status(200).json({ message: PASSWORD_RESET_MESSAGE });
    }

    return res.status(200).json({ message: PASSWORD_RESET_MESSAGE });
  } catch (error) {
    console.error("Forgot password error", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function resetPassword(req, res) {
  const { token } = req.params;
  const { password } = req.body || {};

  if (!token) {
    return res.status(400).json({ message: "Reset token is required" });
  }

  if (typeof password !== "string" || !password) {
    return res.status(400).json({ message: "Password is required" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" });
  }

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

//LOGOUT AUTHENTICATION

export async function logout(req, res) {
  res.clearCookie("jwt", { httpOnly: true, sameSite: "lax", path: "/" });
  res.status(200).json({ success: true, message: "Logout successful" });
}

//ONBOARDING

export async function onboard(req, res) {
  try {
    if (!req.user.emailVerified) {
      return res
        .status(403)
        .json({ message: "Verify your email before onboarding" });
    }
    const userId = req.user._id;
    const { fullName, bio, nativeLanguage, learningLanguage, location } =
      req.body;

    if (
      !fullName ||
      !bio ||
      !nativeLanguage ||
      !learningLanguage ||
      !location
    ) {
      return res.status(400).json({
        message: "All fields are required",
        missingFields: [
          !fullName && "fullName",
          !bio && "bio",
          !nativeLanguage && "nativeLanguage",
          !learningLanguage && "learningLanguage",
          !location && "location",
        ].filter(Boolean),
      });
    }

    const rawInterests = req.body?.interests;
    const interests = (Array.isArray(rawInterests)
      ? rawInterests
      : typeof rawInterests === "string"
        ? rawInterests.split(",")
        : [])
      .filter((interest) => typeof interest === "string")
      .map((interest) => interest.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((interest) => interest.slice(0, 40));

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        ...req.body,
        interests,
        isOnboarded: true,
      },
      { new: true },
    );

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    //UPDATE THE USER INFO IN STREAM

    try {
      await upsertStreamUser({
        id: updatedUser._id.toString(),
        name: updatedUser.fullName,
        image: updatedUser.profilePic || "",
      });

      console.log(
        `Stream user updated after onboarding for ${updatedUser.fullName}`,
      );
    } catch (StreamError) {
      console.log("Error updating Stream user during onboarding:", StreamError);
    }

    //UPDATE THE USER INFO IN STREAM

    res.status(200).json({ success: true, user: publicUser(updatedUser) });
  } catch (error) {
    console.log("Onboarding error", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
