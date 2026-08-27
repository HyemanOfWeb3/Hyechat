import { upsertStreamUser } from "../lib/stream.js";
import { sendPasswordResetEmail } from "../lib/mail.js";
import User from "../models/User.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const PASSWORD_RESET_MESSAGE =
  "If an account with that email exists, a password reset link has been sent.";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const publicUser = (user) => {
  const data = user.toObject ? user.toObject() : { ...user };
  delete data.password;
  delete data.resetPasswordToken;
  delete data.resetPasswordExpires;
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
    });

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
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    });

    res.status(201).json({ success: true, user: publicUser(newUser) });
  } catch (error) {
    console.log("Error in signup controller", error);
    res.status(500).json({ message: "Internal Server Error" });
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
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
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
  res.clearCookie("jwt");
  res.status(200).json({ success: true, message: "Logout successful" });
}

//ONBOARDING

export async function onboard(req, res) {
  try {
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

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        ...req.body,
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
