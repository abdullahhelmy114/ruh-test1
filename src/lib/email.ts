import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function wrapTemplate(title: string, content: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; background-color: #FDF8F0; font-family: 'Georgia', serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .card { background: #ffffff; border-radius: 24px; padding: 40px; box-shadow: 0 8px 32px rgba(0,0,0,0.06); border: 1px solid #f0e6d3; }
        .logo { text-align: center; margin-bottom: 30px; }
        .logo img { height: 50px; }
        .title { font-size: 24px; color: #1A3C34; text-align: center; margin-bottom: 20px; }
        .content { font-size: 16px; color: #444444; line-height: 1.7; text-align: center; }
        .button { display: inline-block; background: linear-gradient(135deg, #D4AF37, #C9A02B); color: #1A3C34; text-decoration: none; padding: 14px 36px; border-radius: 50px; font-weight: bold; font-size: 16px; margin-top: 24px; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999999; }
        .footer a { color: #D4AF37; text-decoration: none; }
        .divider { height: 1px; background: #f0e6d3; margin: 30px 0; }
        .code { font-size: 32px; letter-spacing: 8px; color: #D4AF37; font-weight: bold; text-align: center; margin: 20px 0; }
        .emoji { font-size: 48px; text-align: center; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">
            <h2 style="color:#059669;font-family:'Cormorant Garamond',serif;font-size:28px;margin:0;">Ruhulqudus Academy</h2>
          </div>
          <h1 class="title">${title}</h1>
          <div class="content">${content}</div>
          <div class="divider"></div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Ruhulqudus Academy. All rights reserved.</p>
            <p>
              <a href="https://ruhulqudus.net/privacy">Privacy Policy</a> · 
              <a href="https://ruhulqudus.net/terms">Terms of Service</a> · 
              <a href="https://ruhulqudus.net/contact">Contact Us</a>
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<void> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email credentials not configured");
  }
  await transporter.sendMail({
    from: `"Ruhulqudus Academy" <${process.env.EMAIL_FROM}>`,
    to,
    subject,
    html: htmlContent,
  });
}

// دوال القوالب (بقيت كما هي)
export function welcomeEmail(name: string) {
  return wrapTemplate(
    "Welcome to Ruhulqudus Academy! 🎉",
    `
      <div class="emoji">📚</div>
      <p>Dear <strong>${name}</strong>,</p>
      <p>Your account has been created successfully. We are thrilled to have you join our community of Arabic learners.</p>
      <p>Start your journey today:</p>
      <a href="https://ruhulqudus.net/marketplace" class="button">Browse Courses</a>
    `
  );
}

export function verificationCodeEmail(code: string) {
  return wrapTemplate(
    "Your Verification Code",
    `
      <div class="emoji">🔐</div>
      <p>Use the code below to verify your email address:</p>
      <div class="code">${code}</div>
      <p>This code expires in <strong>15 minutes</strong>.</p>
    `
  );
}

export function resetPasswordEmail(link: string) {
  return wrapTemplate(
    "Reset Your Password 🔑",
    `
      <div class="emoji">🔑</div>
      <p>We received a request to reset your password.</p>
      <p>Click the button below to choose a new password:</p>
      <a href="${link}" class="button">Reset Password</a>
      <p style="font-size:12px;color:#999;margin-top:16px;">If you did not request this, please ignore this email.</p>
    `
  );
}

export function courseEnrolledEmail(name: string, course: string) {
  return wrapTemplate(
    `You're Enrolled! 🎓`,
    `
      <div class="emoji">🎓</div>
      <p>Dear <strong>${name}</strong>,</p>
      <p>You have successfully enrolled in <strong>${course}</strong>.</p>
      <p>Start learning now:</p>
      <a href="https://ruhulqudus.net/dashboard/student" class="button">Go to Dashboard</a>
    `
  );
}

export function contactFormEmail(name: string, email: string, message: string) {
  return wrapTemplate(
    "New Contact Message",
    `
      <div class="emoji">📩</div>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong></p>
      <p style="background:#f9f9f9;padding:16px;border-radius:12px;text-align:left;">${message}</p>
    `
  );
}

// دالة إرسال رمز التحقق الجديدة
export async function sendEmailVerificationCode(email: string): Promise<string> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const html = verificationCodeEmail(code);
  await sendEmail(email, "Your Verification Code", html);
  return code;
}

export function teacherApprovedEmail(name: string) {
  return wrapTemplate(
    "Your Teacher Account is Approved! 🎉",
    `
      <div class="emoji">🎉</div>
      <p>Dear <strong>${name}</strong>,</p>
      <p>Congratulations! Your application to become a teacher at Ruhulqudus Academy has been approved.</p>
      <p>You can now log in and start creating courses.</p>
      <a href="https://ruhulqudus.net/dashboard/teacher" class="button">Go to Teacher Dashboard</a>
    `
  );
}