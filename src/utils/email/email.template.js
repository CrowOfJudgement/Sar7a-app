export const otpEmailTemplate = ({
    title = "Your verification code",
    subtitle = "Use the code below to continue",
    otp,
    expiresInMinutes = 10,
    brandName = "Saraha App",
    helpText = "If you did not request this code, you can safely ignore this email."
} = {}) => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#10233f;">
    <div style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;">
            <tr>
                <td align="center" style="padding-bottom:18px;">
                    <div style="display:inline-block;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#ffffff;padding:12px 20px;border-radius:999px;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                        ${brandName}
                    </div>
                </td>
            </tr>
            <tr>
                <td style="background-color:#ffffff;border-radius:24px;padding:40px 32px;box-shadow:0 18px 45px rgba(15,23,42,0.10);">
                    <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#2563eb;">
                        Secure Verification
                    </p>
                    <h1 style="margin:0 0 14px;font-size:30px;line-height:1.2;color:#0f172a;">
                        ${title}
                    </h1>
                    <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#475569;">
                        ${subtitle}
                    </p>
                    <div style="margin:0 0 28px;padding:24px;border-radius:20px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe;text-align:center;">
                        <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#1d4ed8;">
                            One-Time Password
                        </p>
                        <div style="font-size:38px;line-height:1;font-weight:800;letter-spacing:0.32em;color:#0f172a;">
                            ${otp}
                        </div>
                    </div>
                    <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#334155;">
                        This code will expire in <strong>${expiresInMinutes} minutes</strong>.
                    </p>
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
                        ${helpText}
                    </p>
                </td>
            </tr>
            <tr>
                <td style="padding:18px 10px 0;text-align:center;font-size:12px;line-height:1.6;color:#94a3b8;">
                    ${brandName} • Please do not share this code with anyone.
                </td>
            </tr>
        </table>
    </div>
</body>
</html>`;
};
