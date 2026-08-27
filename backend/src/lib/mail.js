import nodemailer from "nodemailer";

const getTransporter = () => {
  if (!process.env.EMAIL || !process.env.EMAIL_PASSWORD) {
    throw new Error("Email configuration is missing");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export async function sendPasswordResetEmail({ email, fullName, resetToken }) {
  if (!process.env.CLIENT_URL) {
    throw new Error("CLIENT_URL is missing");
  }

  const resetUrl = `${process.env.CLIENT_URL.replace(/\/$/, "")}/reset-password/${resetToken}`;
  const safeName = escapeHtml(fullName || "there");
  await sendMail({
    from: `HyeChat <${process.env.EMAIL}>`,
    to: email,
    subject: "Reset your HyeChat password",
    text: [
      `Hi ${fullName || "there"},`,
      "",
      "We received a request to reset your HyeChat password.",
      `Reset your password here: ${resetUrl}`,
      "This link expires in 15 minutes.",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2>HyeChat password reset</h2>
        <p>Hi ${safeName},</p>
        <p>We received a request to reset your HyeChat password.</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 16px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;">
            Reset your password
          </a>
        </p>
        <p>This link expires in 15 minutes.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendEmailVerificationEmail({ email, fullName, otp }) {
  const safeName = escapeHtml(fullName || "there");
  await sendMail({
    from: `HyeChat <${process.env.EMAIL}>`,
    to: email,
    subject: "Verify your HyeChat email",
    text: [
      `Hi ${fullName || "there"},`,
      "",
      `Your HyeChat verification code is: ${otp}`,
      "This code expires in 10 minutes and can only be used once.",
      "If you did not create this account, you can safely ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2>Verify your HyeChat email</h2>
        <p>Hi ${safeName},</p>
        <p>Enter this code in HyeChat to verify your email address:</p>
        <p style="font-size: 30px; font-weight: 700; letter-spacing: 8px;">${otp}</p>
        <p>This code expires in 10 minutes and can only be used once.</p>
        <p>If you did not create this account, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendMail(mailOptions) {
  const transporter = getTransporter();
  await transporter.sendMail(mailOptions);
}
