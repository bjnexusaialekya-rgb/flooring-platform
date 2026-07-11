const nodemailer = require('nodemailer');
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new Error(`Email not configured — missing env vars: ${missing.join(', ')}`);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}
function renderPaymentConfirmationHtml({ recipientName, propertyName, amount, billingPeriodStart, billingPeriodEnd, invoiceNumber }) {
  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  const periodStart = new Date(billingPeriodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const periodEnd = new Date(billingPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `
  <div style="max-width:560px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
    <div style="padding:32px 0 24px;border-bottom:1px solid #e5e5e5;">
      <p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;margin:0;letter-spacing:-0.3px;">Trestle</p>
      <p style="font-size:11px;color:#8a8a8a;margin:2px 0 0;letter-spacing:1px;text-transform:uppercase;">Payment confirmation</p>
    </div>
    <div style="padding:28px 0;">
      <p style="font-size:15px;line-height:1.5;margin:0 0 20px;">Hi ${recipientName || 'there'},</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 20px;">Your payment for <strong>${propertyName}</strong> has been received and processed successfully.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;background:#fafafa;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:14px 18px;font-size:13px;color:#6b6b6b;border-bottom:1px solid #eee;">Invoice</td><td style="padding:14px 18px;font-size:13px;text-align:right;border-bottom:1px solid #eee;font-weight:600;">${invoiceNumber}</td></tr>
        <tr><td style="padding:14px 18px;font-size:13px;color:#6b6b6b;border-bottom:1px solid #eee;">Billing period</td><td style="padding:14px 18px;font-size:13px;text-align:right;border-bottom:1px solid #eee;">${periodStart} – ${periodEnd}</td></tr>
        <tr><td style="padding:14px 18px;font-size:14px;font-weight:600;">Amount paid</td><td style="padding:14px 18px;font-size:16px;text-align:right;font-weight:700;color:#166534;">${formattedAmount}</td></tr>
      </table>
      <p style="font-size:14px;line-height:1.5;color:#4a4a4a;margin:0 0 4px;">A copy of your invoice is attached to this email as a PDF for your records.</p>
    </div>
    <div style="padding:20px 0 0;border-top:1px solid #e5e5e5;">
      <p style="font-size:12px;color:#9a9a9a;margin:0;">This is an automated confirmation from Trestle. Please don't reply directly to this email.</p>
    </div>
  </div>`.trim();
}
async function sendPaymentConfirmationEmail({ to, recipientName, propertyName, amount, billingPeriodStart, billingPeriodEnd, invoiceNumber, pdfBuffer }) {
  if (!to) throw new Error('Recipient email is required');
  if (!pdfBuffer) throw new Error('PDF buffer is required — cannot send confirmation without the invoice attached');
  const html = renderPaymentConfirmationHtml({ recipientName, propertyName, amount, billingPeriodStart, billingPeriodEnd, invoiceNumber });
  const mailer = getTransporter();
  return mailer.sendMail({
    from: process.env.SMTP_FROM || '"Trestle" <billing@trestle.local>',
    to,
    subject: `Payment received — Invoice ${invoiceNumber}`,
    html,
    attachments: [{ filename: `Invoice-${invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
  });
}
module.exports = { sendPaymentConfirmationEmail, renderPaymentConfirmationHtml };
