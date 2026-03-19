import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config({ quiet: true });

export const sendEmail = async (
  { to, subject = "", html = "", attachments = [] } = {}
) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const info = await transporter.sendMail({
    from: `"eslam" <${process.env.EMAIL}>`,
    to,
    subject,
    html,
    attachments,
  });

  console.log("Message sent:", info.messageId);
  return info.accepted.length ? true : false;
};

export const generateOtp = async () => {
  return Math.floor(Math.random() * 900000 + 100000);
};
