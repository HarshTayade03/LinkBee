const nodemailer = require('nodemailer');
const config = require('./env');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // If SMTP credentials exist in env, use them
  if (config.smtpHost && config.smtpUser) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.smtpSecure || false,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
  } else {
    // Fallback: development / simulated mode logger
    transporter = {
      sendMail: async (options) => {
        console.log('\n[EmailService] Simulated Email Dispatch:');
        console.log(`  To: ${options.to}`);
        console.log(`  Subject: ${options.subject}`);
        console.log(`  Verification Link: ${options.text || options.html}`);
        console.log('--------------------------------------------\n');
        return { messageId: 'simulated-' + Date.now() };
      },
    };
  }
  return transporter;
}

async function sendVerificationEmail({ to, username, verificationToken }) {
  const verifyUrl = `${config.baseUrl}/verify-email?token=${verificationToken}`;
  const mailOptions = {
    from: config.smtpFrom || '"LinkBee Support" <noreply@linkbee.co>',
    to,
    subject: 'Verify your LinkBee email address',
    text: `Hello ${username},\n\nThank you for signing up for LinkBee!\n\nPlease verify your email address to unlock unlimited short links and analytics:\n${verifyUrl}\n\nThis verification link expires in 24 hours.\n\nBest regards,\nThe LinkBee Team`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #E7E4DC; border-radius: 8px; background-color: #FBFAF7;">
        <h2 style="color: #1C1B19; margin-bottom: 12px;">Verify your LinkBee email</h2>
        <p style="color: #63615C; font-size: 15px; line-height: 1.5;">Hello <strong>${username}</strong>,</p>
        <p style="color: #63615C; font-size: 15px; line-height: 1.5;">Thank you for signing up for LinkBee! You currently have 5 short links available on your free account. Click the button below to verify your email address and unlock <strong>unlimited short links</strong> and real-time click tracking.</p>
        <div style="margin: 28px 0;">
          <a href="${verifyUrl}" style="background-color: #1C1B19; color: #FFFFFF; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-weight: 500; font-size: 14px; display: inline-block;">Verify Email Address</a>
        </div>
        <p style="color: #8F8D87; font-size: 13px;">Or copy and paste this address into your browser:<br/><a href="${verifyUrl}" style="color: #E58E1A;">${verifyUrl}</a></p>
        <hr style="border: none; border-top: 1px solid #E7E4DC; margin: 24px 0;" />
        <p style="color: #8F8D87; font-size: 12px;">This link will expire in 24 hours. If you did not create a LinkBee account, you can safely ignore this email.</p>
      </div>
    `,
  };

  const client = getTransporter();
  return client.sendMail(mailOptions);
}

module.exports = {
  sendVerificationEmail,
};
