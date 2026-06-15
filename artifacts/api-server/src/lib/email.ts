import { logger } from "./logger.js";

export type EmailProvider = "resend" | "sendgrid" | "smtp" | "dev";

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || "dev") as EmailProvider;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@bountypilot.ai";

function hasProvider(): boolean {
  if (EMAIL_PROVIDER === "dev") return true;
  if (EMAIL_PROVIDER === "resend") return !!RESEND_API_KEY;
  return false;
}

export async function sendEmail({ to, subject, text, html }: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean; devCode?: string }> {
  if (!hasProvider()) {
    logger.warn({ to, subject }, "No email provider configured");
    return { sent: false };
  }

  // Dev mode: just log and return a code placeholder
  if (EMAIL_PROVIDER === "dev") {
    logger.info({ to, subject }, "[DEV EMAIL] Would send email");
    return { sent: true };
  }

  if (EMAIL_PROVIDER === "resend") {
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to,
          subject,
          text,
          html: html || text.replace(/\n/g, "<br>"),
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Resend ${resp.status}: ${err}`);
      }
      const data = await resp.json() as { id: string };
      logger.info({ emailId: data.id, to }, "Email sent via Resend");
      return { sent: true };
    } catch (e: any) {
      logger.error({ err: e.message, to }, "Resend email failed");
      return { sent: false };
    }
  }

  return { sent: false };
}

export function sendOTPEmail(to: string, code: string, purpose: "login" | "signup" | "reset"): Promise<{ sent: boolean; devCode?: string }> {
  const subjectMap = {
    login: "Your BountyPilot Login Code",
    signup: "Verify Your BountyPilot Account",
    reset: "Your BountyPilot Password Reset Code",
  };

  const text = `Your BountyPilot ${purpose === "login" ? "login" : purpose === "signup" ? "verification" : "password reset"} code is: ${code}

This code will expire in 10 minutes.

If you didn't request this, please ignore this email.

— BountyPilot AI Team`;

  return sendEmail({ to, subject: subjectMap[purpose], text });
}

export function getEmailProvider(): { provider: EmailProvider; ready: boolean } {
  return { provider: EMAIL_PROVIDER, ready: hasProvider() };
}
