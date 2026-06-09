/**
 * email.ts
 *
 * Utility สำหรับส่งอีเมล OTP ผ่าน Resend API
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - lazy init Resend client จาก backendEnv
 * - ส่งอีเมลจริงเมื่อมี RESEND_API_KEY และไม่ปิด DISABLE_EMAIL
 * - fallback เป็น debug log ใน dev mode เมื่อไม่พร้อมส่งจริง
 * - สร้างอีเมล OTP ภาษาไทยสำหรับ reset password
 */

import { Resend } from 'resend';
import createDebug from 'debug';

import { createError } from './ApiError';
import { backendEnv } from '../config/env';

const log = createDebug('fallhelp:email');

const logInit = createDebug('fallhelp:email');

if (backendEnv.disableEmail) {
  logInit('⚠️ Email sending is DISABLED - emails will be logged to console only');
} else if (backendEnv.resendApiKey) {
  logInit('✅ Resend API key is configured');
} else {
  logInit(
    '⚠️ Resend API key is NOT configured - emails will be logged to console only. Please set RESEND_API_KEY in .env',
  );
}

let resend: Resend | null = null;

const getResendClient = (): Resend | null => {
  if (backendEnv.disableEmail) {
    return null;
  }

  if (!resend && backendEnv.resendApiKey) {
    resend = new Resend(backendEnv.resendApiKey);
    log('✅ Resend client initialized');
  }

  return resend;
};

export const sendEmail = async (options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> => {
  const client = getResendClient();

  if (!client) {
    // ไม่ใช้ console.log เพื่อกัน email address หลุดใน stdout โดยไม่ตั้งใจ
    log('📧 [DEV MODE] Email suppressed — to: %s | subject: %s', options.to, options.subject);
    return;
  }

  try {
    log('📤 Sending email to %s...', options.to);

    const emailPayload = {
      from: backendEnv.emailFrom,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      ...(options.text !== undefined ? { text: options.text } : {}),
    };

    const { data, error } = await client.emails.send(emailPayload);

    if (error) {
      log('❌ Resend API error: %O', error);
      throw createError.emailFailed();
    }

    log('✅ Email sent successfully! ID: %s', data?.id);
  } catch (error) {
    log('❌ Email send error: %O', error);
    throw createError.emailFailed();
  }
};

export const sendOtpEmail = async (
  email: string,
  code: string,
  referenceCode?: string,
): Promise<void> => {
  const purposeText = 'รีเซ็ตรหัสผ่าน';
  const currentYear = new Date().getFullYear();

  const html = `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${purposeText} - FallHelp</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          color: #24301f;
          font-family: Arial, Tahoma, sans-serif;
          line-height: 1.65;
        }

        table {
          border-spacing: 0;
          border-collapse: collapse;
        }

        .email-root {
          width: 100%;
          background: #ffffff;
        }

        .email-container {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          background: #ffffff;
        }

        .header {
          padding: 34px 24px 32px;
          text-align: center;
          color: #ffffff;
          background: linear-gradient(135deg, #7d965b 0%, #5f7445 55%, #435631 100%);
        }

        .brand {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.25);
          font-size: 13px;
          margin-bottom: 14px;
        }

        .header h1 {
          margin: 0;
          font-size: 30px;
          line-height: 1.3;
          font-weight: 700;
        }

        .header p {
          margin: 10px 0 0;
          font-size: 15px;
          color: rgba(255, 255, 255, 0.9);
        }

        .content {
          padding: 28px 24px 26px;
          background: #ffffff;
        }

        .greeting {
          margin: 0 0 10px;
          font-size: 18px;
          font-weight: 700;
          color: #24301f;
        }

        .description {
          margin: 0 0 22px;
          font-size: 15px;
          color: #53604b;
        }

        .otp-card {
          background: #f7f9f3;
          border: 1px solid #dfe8d2;
          border-radius: 18px;
          padding: 22px 16px;
          text-align: center;
          margin: 0 0 16px;
          box-shadow: 0 6px 16px rgba(43, 61, 31, 0.06);
        }

        .otp-label {
          margin: 0 0 10px;
          font-size: 13px;
          color: #6b765f;
        }

        .otp-code {
          display: inline-block;
          font-size: 46px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: 8px;
          color: #4f6638;
          padding-left: 8px;
        }

        .ref-line {
          margin: 12px 0 0;
          font-size: 14px;
          color: #66705f;
        }

        .ref-line strong {
          color: #4f6638;
        }

        .info-card {
          background: #fafbf7;
          border: 1px solid #e4ebdc;
          border-radius: 14px;
          padding: 14px 16px;
          margin: 0 0 10px;
        }

        .info-title {
          margin: 0;
          font-size: 13px;
          color: #6c7662;
        }

        .info-value {
          margin: 3px 0 0;
          font-size: 15px;
          font-weight: 700;
          color: #354528;
        }

        .warning {
          background: #fff8e8;
          border: 1px solid #efd99d;
          border-radius: 14px;
          padding: 14px 16px;
          margin: 18px 0 0;
          color: #60491f;
          font-size: 14px;
        }

        .warning strong {
          color: #4f3815;
        }

        .muted {
          margin: 18px 0 0;
          font-size: 13px;
          color: #747d6b;
        }

        .footer {
          padding: 18px 24px 22px;
          text-align: center;
          background: #f8faf4;
          border-top: 1px solid #edf2e7;
          color: #899182;
          font-size: 12px;
        }

        .footer p {
          margin: 4px 0;
        }

        @media only screen and (max-width: 480px) {
          .email-container {
            max-width: 100%;
          }

          .header {
            padding: 32px 20px 28px;
          }

          .header h1 {
            font-size: 28px;
          }

          .content {
            padding: 26px 20px 24px;
          }

          .otp-code {
            font-size: 40px;
            letter-spacing: 5px;
            padding-left: 5px;
          }

          .footer {
            padding: 16px 20px 20px;
          }
        }
      </style>
    </head>

    <body>
      <table role="presentation" width="100%" class="email-root">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" class="email-container">
              <tr>
                <td>
                  <div class="header">
                    <div class="brand">FallHelp Security</div>
                    <h1>${purposeText}</h1>
                    <p>ใช้รหัสนี้เพื่อดำเนินการรีเซ็ตรหัสผ่าน</p>
                  </div>

                  <div class="content">
                    <p class="greeting">สวัสดีค่ะ/ครับ</p>

                    <p class="description">
                      เราได้รับคำขอ${purposeText} สำหรับบัญชีของคุณ กรุณากรอกรหัส OTP ด้านล่างในแอป FallHelp
                    </p>

                    <div class="otp-card">
                      <p class="otp-label">รหัส OTP ของคุณ</p>
                      <div class="otp-code">${code}</div>

                      ${
                        referenceCode
                          ? `<p class="ref-line">รหัสอ้างอิง: <strong>${referenceCode}</strong></p>`
                          : ''
                      }
                    </div>

                    <div class="info-card">
                      <p class="info-title">อายุของรหัส</p>
                      <p class="info-value">หมดอายุภายใน 5 นาที</p>
                    </div>

                    <div class="info-card">
                      <p class="info-title">การใช้งาน</p>
                      <p class="info-value">ใช้ได้ครั้งเดียวเท่านั้น</p>
                    </div>

                    <div class="warning">
                      <strong>คำเตือน:</strong>
                      ห้ามส่งต่อรหัสนี้ให้ผู้อื่น FallHelp จะไม่ขอรหัส OTP ผ่านโทรศัพท์ แชต หรืออีเมล
                    </div>

                    <p class="muted">
                      หากคุณไม่ได้ร้องขอ${purposeText} กรุณาเพิกเฉยต่ออีเมลนี้ได้ทันที
                    </p>
                  </div>

                  <div class="footer">
                    <p>© ${currentYear} FallHelp. All rights reserved.</p>
                    <p>อีเมลนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ</p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
FallHelp - ${purposeText}

รหัสยืนยันของคุณคือ: ${code}
${referenceCode ? `รหัสอ้างอิง: ${referenceCode}` : ''}

รหัสนี้จะหมดอายุใน 5 นาที
รหัสนี้ใช้ได้ครั้งเดียวเท่านั้น

ห้ามแชร์รหัสนี้กับผู้อื่น FallHelp จะไม่ขอ OTP ผ่านโทรศัพท์ แชต หรืออีเมล

หากคุณไม่ได้ร้องขอ${purposeText} กรุณาเพิกเฉยอีเมลนี้

© ${currentYear} FallHelp
  `.trim();

  await sendEmail({
    to: email,
    subject: `FallHelp - ${purposeText} (Ref: ${referenceCode || 'N/A'})`,
    html,
    text,
  });
};
