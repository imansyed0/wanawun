/*
 * Beta-link email for /join sign-ups (WAN-49).
 *
 * Netlify runs a function named `submission-created` automatically for every
 * verified (non-spam) Netlify Forms submission. This one ignores every form
 * except "join" and sends the person a single email over SMTP through the
 * wanwun.org Namecheap Private Email mailbox, with the right beta
 * instructions for the phone they chose (iphone / android / both).
 *
 * Setup:
 *   1. In Netlify (Site configuration > Environment variables) set:
 *        SMTP_USER  full mailbox address, e.g. hello@wanwun.org
 *        SMTP_PASS  that mailbox's password
 *      Optional: SMTP_HOST (default mail.privateemail.com), SMTP_PORT
 *      (default 465, implicit TLS), EMAIL_FROM (default "Wanwun <SMTP_USER>").
 *      EMAIL_FROM must use the SMTP_USER address (or an alias of that
 *      mailbox), otherwise Private Email rejects or spoof-flags the message.
 *      Redeploy after changing env vars.
 *   2. Make sure the Google Group allows anyone to join without approval
 *      (Group settings > "Who can join group" > "Anyone on the web can
 *      join"). "Ask to join" would leave testers stuck waiting.
 *   3. Replace ANDROID_BETA_LINK below with the real Play testing link.
 *
 * nodemailer is bundled by esbuild (netlify.toml [functions] node_bundler).
 * Always returns 200 so a mail problem never affects the form submission;
 * failures are logged (never the password) in Netlify > Logs > Functions.
 */

import nodemailer from 'nodemailer';

const IOS_TESTFLIGHT_LINK = 'https://testflight.apple.com/join/dM2tsXYj';
const ANDROID_GROUP_LINK = 'https://groups.google.com/g/wanawun-android-beta-testers';
// TODO(WAN-49): replace with the real Google Play testing opt-in / download link.
const ANDROID_BETA_LINK = 'TODO_ANDROID_BETA_LINK';

const DEFAULT_SMTP_HOST = 'mail.privateemail.com';
const DEFAULT_SMTP_PORT = 465;
const REPLY_TO = 'hello@wanwun.org';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstName(name) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  return first.slice(0, 60);
}

export function buildEmail({ name, device } = {}) {
  const first = firstName(name);
  const deviceKey = String(device || '').toLowerCase();
  const wantsIos = deviceKey === 'iphone' || deviceKey === 'both';
  const wantsAndroid = deviceKey === 'android' || deviceKey === 'both';
  const androidLinkReady = !ANDROID_BETA_LINK.startsWith('TODO');

  const greetingText = first ? `Hi ${first},` : 'Hi there,';
  const greetingHtml = first ? `Hi ${escapeHtml(first)},` : 'Hi there,';

  const text = [greetingText, '', 'Thanks for signing up for Wanwun, the app for learning Kashmiri (Koshur).', ''];
  const html = [
    `<p>${greetingHtml}</p>`,
    '<p>Thanks for signing up for Wanwun, the app for learning Kashmiri (Koshur).</p>',
  ];

  if (wantsIos) {
    text.push(
      'To get the beta on your iPhone:',
      '1. Install the TestFlight app from the App Store.',
      `2. On your iPhone, open this link: ${IOS_TESTFLIGHT_LINK}`,
      ''
    );
    html.push(
      '<h3 style="margin:20px 0 6px">iPhone</h3>',
      '<ol>',
      '<li>Install the <strong>TestFlight</strong> app from the App Store.</li>',
      `<li>On your iPhone, open this link: <a href="${IOS_TESTFLIGHT_LINK}">${IOS_TESTFLIGHT_LINK}</a></li>`,
      '</ol>'
    );
  }

  if (wantsAndroid) {
    const step2Text = androidLinkReady
      ? `2. On your Android phone, open this link to download the beta: ${ANDROID_BETA_LINK}`
      : "2. We'll email you the download link very soon.";
    const step2Html = androidLinkReady
      ? `<li>On your Android phone, open this link to download the beta: <a href="${escapeHtml(ANDROID_BETA_LINK)}">${escapeHtml(ANDROID_BETA_LINK)}</a></li>`
      : "<li>We'll email you the download link very soon.</li>";
    text.push(
      'To get the beta on Android:',
      `1. Join our beta testers group, signed in with the Google account you use for the Play Store: ${ANDROID_GROUP_LINK}`,
      step2Text,
      ''
    );
    html.push(
      '<h3 style="margin:20px 0 6px">Android</h3>',
      '<ol>',
      `<li>Join our beta testers group, signed in with the Google account you use for the Play Store: <a href="${ANDROID_GROUP_LINK}">${ANDROID_GROUP_LINK}</a></li>`,
      step2Html,
      '</ol>'
    );
  }

  if (!wantsIos && !wantsAndroid) {
    text.push("We'll email you the beta link for your phone very soon.", '');
    html.push("<p>We'll email you the beta link for your phone very soon.</p>");
  }

  text.push('Questions or feedback? Just reply to this email.', '', 'Thank you,', 'Wanwun');
  html.push(
    '<p>Questions or feedback? Just reply to this email.</p>',
    '<p>Thank you,<br>Wanwun</p>'
  );

  return {
    subject: 'Your Wanwun beta link',
    text: text.join('\n'),
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.5;color:#2F3A35;max-width:560px">${html.join('\n')}</div>`,
  };
}

const ok = () => ({ statusCode: 200, body: 'ok' });

export const handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event?.body || '{}').payload;
  } catch (err) {
    console.error('submission-created: could not parse event body', err);
    return ok();
  }

  if (!payload || payload.form_name !== 'join') return ok();

  const data = payload.data || {};
  const email = String(data.email || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error('submission-created: join submission without a valid email, skipping');
    return ok();
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    const missing = [!user && 'SMTP_USER', !pass && 'SMTP_PASS'].filter(Boolean).join(' and ');
    console.error(`submission-created: ${missing} not set, beta email not sent`);
    return ok();
  }

  const host = process.env.SMTP_HOST || DEFAULT_SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || DEFAULT_SMTP_PORT;
  const { subject, text, html } = buildEmail({ name: data.name, device: data.device });

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 would upgrade via STARTTLS
      auth: { user, pass },
    });
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `Wanwun <${user}>`,
      to: email,
      replyTo: REPLY_TO,
      subject,
      text,
      html,
    });
    console.log(`submission-created: beta email sent (${info?.messageId || 'no message id'})`);
  } catch (err) {
    // Log only safe fields: nodemailer errors don't include the password,
    // but avoid dumping the whole object (it can carry the transport config).
    console.error(
      `submission-created: SMTP send failed via ${host}:${port}: ${err?.code || ''} ${err?.responseCode || ''} ${err?.message || err}`
    );
  }

  return ok();
};
