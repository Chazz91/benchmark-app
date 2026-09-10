import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'Benchmark Engineering Inc. <onboarding@resend.dev>';
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Resend's SDK returns { data, error } instead of throwing on API-level failures (invalid
// recipient, rejected key, etc.) - calling resend.emails.send() directly and ignoring the
// result means a failed send looks identical to a successful one everywhere it's used. This
// wrapper makes sure every email in this file actually surfaces a real error when one happens.
async function send(params: Parameters<typeof resend.emails.send>[0]) {
  const { error } = await resend.emails.send(params);
  if (error) {
    throw new Error(`Resend rejected this email: ${error.message}`);
  }
}

export async function sendInviteEmail(to: string, firstName: string, token: string) {
  const link = `${APP_URL}/signup/${token}`;
  await send({
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

  await send({
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
  await send({
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

  await send({
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

  await send({
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

// One summary email for a batch of tickets added via a multi-file upload, rather than
// spamming admins with one email per file.
export async function sendBulkTicketUploadAlertEmail(
  adminEmails: string[],
  consultantName: string,
  consultantId: string,
  ticketLabels: string[]
) {
  if (adminEmails.length === 0 || ticketLabels.length === 0) return;

  const itemsList = ticketLabels.map((label) => `<li>${label}</li>`).join('');

  await send({
    from: FROM,
    to: adminEmails,
    subject: `${consultantName} uploaded ${ticketLabels.length} ticket(s)`,
    html: `
      <p><strong>${consultantName}</strong> just uploaded multiple files, adding or updating
      these tickets:</p>
      <ul>${itemsList}</ul>
      <p><a href="${APP_URL}/consultants/${consultantId}">View their profile</a></p>
    `,
  });
}

export async function sendTwoFactorCodeEmail(to: string, firstName: string, code: string) {
  await send({
    from: FROM,
    to,
    subject: `Your Benchmark Engineering sign-in code: ${code}`,
    html: `
      <p>Hi ${firstName},</p>
      <p>Your sign-in verification code is:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p>This code expires in 10 minutes. If you didn't try to sign in, you can safely ignore
      this email.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, firstName: string, token: string) {
  await send({
    from: FROM,
    to,
    subject: 'Reset your Benchmark Engineering password',
    html: `
      <p>Hi ${firstName},</p>
      <p>We received a request to reset your password. Click below to set a new one:</p>
      <p><a href="${APP_URL}/reset-password/${token}">Reset your password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this
      email — your password won't be changed.</p>
    `,
  });
}

// Sends a personalized message to each consultant individually - one email per person, with
// their actual first name substituted in wherever {name} appears in the subject or message.
// Since each email only ever lists that one person, this keeps the exact same privacy
// guarantee as BCC (nobody sees who else got it) while actually allowing personalization,
// which true BCC can never support - everyone in a BCC group gets an identical copy.
export async function sendPersonalizedConsultantEmails(
  recipients: { email: string; firstName: string }[],
  subjectTemplate: string,
  bodyTemplate: string,
  senderName: string,
  senderEmail: string
) {
  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const recipient of recipients) {
    const personalize = (text: string) => text.replace(/\{\s*name\s*\}/gi, recipient.firstName);

    const subject = personalize(subjectTemplate);
    const bodyHtml = personalize(bodyTemplate)
      .split('\n\n')
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('');

    const html = `
      ${bodyHtml}
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
        — ${senderName}, Benchmark Engineering Inc.
      </p>
    `;

    try {
      await send({ from: FROM, to: recipient.email, replyTo: senderEmail, subject, html });
      results.push({ email: recipient.email, success: true });
    } catch (err) {
      // One bad address shouldn't block everyone else in the group from getting theirs.
      results.push({ email: recipient.email, success: false, error: (err as Error).message });
    }

    // Small pause between sends to stay comfortably under Resend's rate limits when
    // messaging a larger group - has no noticeable effect on how fast this feels to use.
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return results;
}

