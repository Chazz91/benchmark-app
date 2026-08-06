import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'Benchmark Engineering <onboarding@resend.dev>';
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export async function sendInviteEmail(to: string, firstName: string, token: string) {
  const link = `${APP_URL}/signup/${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'You’re approved — set up your Benchmark Engineering profile',
    html: `
      <p>Hi ${firstName},</p>
      <p>Good news — your application has been accepted. Click the link below to set a password and access your profile:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 7 days.</p>
    `,
  });
}

export async function sendTicketExpiryEmail(
  to: string,
  firstName: string,
  ticketLabel: string,
  expiryDate: Date,
  windowDays: 60 | 30 = 60
) {
  const formatted = expiryDate.toLocaleDateString('en-CA');
  const urgency = windowDays === 30 ? 'soon — within 30 days' : 'within 60 days';
  const subjectPrefix = windowDays === 30 ? 'Action needed soon' : 'Reminder';

  await resend.emails.send({
    from: FROM,
    to,
    subject: `${subjectPrefix}: your ${ticketLabel} ticket expires ${formatted}`,
    html: `
      <p>Hi ${firstName},</p>
      <p>Your <strong>${ticketLabel}</strong> ticket is set to expire on <strong>${formatted}</strong> —
      that's ${urgency}. Please renew it and update your profile as soon as you can to avoid
      a gap in your eligibility for placements.</p>
      <p><a href="${APP_URL}/my-tickets">Update your tickets</a></p>
    `,
  });
}

export async function sendApplicationRejectedEmail(to: string, firstName: string, reason?: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Update on your Benchmark Engineering application',
    html: `
      <p>Hi ${firstName},</p>
      <p>Thank you for your interest in Benchmark Engineering. After review, we're not able to move
      forward with your application at this time.${reason ? ` Note: ${reason}` : ''}</p>
      <p>You're welcome to apply again in the future.</p>
    `,
  });
}

export async function sendCompleteProfileEmail(to: string, firstName: string, missingItems: string[]) {
  const itemsList = missingItems.map((item) => `<li>${item}</li>`).join('');

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Please complete your Benchmark Engineering profile',
    html: `
      <p>Hi ${firstName},</p>
      <p>Could you take a couple minutes to update your profile? A few things are still
      missing, including some of the core tickets required to work drilling/completions
      for most companies:</p>
      <ul>${itemsList}</ul>
      <p>
        Contact info and your resume can be updated on
        <a href="${APP_URL}/my-profile">My Profile</a>. Certifications and your driver's license
        can be added on <a href="${APP_URL}/my-tickets">My Tickets</a>.
      </p>
      <p>Keeping this current means you're always ready to show valid tickets on site if
      anyone asks. Thanks for staying on top of it!</p>
    `,
  });
}

export async function sendTicketUploadedAlertEmail(
  adminEmails: string[],
  consultantName: string,
  consultantId: string,
  ticketTypeLabel: string,
  expiryDate: Date | null
) {
  if (adminEmails.length === 0) return;

  const expiryText = expiryDate
    ? `expiring ${expiryDate.toLocaleDateString('en-CA')}`
    : 'no expiry (N/A)';

  await resend.emails.send({
    from: FROM,
    to: adminEmails,
    subject: `${consultantName} added/updated a ticket: ${ticketTypeLabel}`,
    html: `
      <p><strong>${consultantName}</strong> just added or updated a ticket on their profile:</p>
      <p><strong>${ticketTypeLabel}</strong> — ${expiryText}</p>
      <p><a href="${APP_URL}/consultants/${consultantId}">View their profile</a></p>
    `,
  });
}

