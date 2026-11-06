import { DataSource } from 'typeorm';
import { EmailQuota } from 'src/common/mail/email-quota.service';
import {
  MailTransport,
  PermanentMailError,
} from 'src/common/mail/mail-transport.service';
import { renderEmail } from 'src/common/mail/email-layout';
import {
  NotificationAudience,
  NotificationChannel,
  OutboxStatus,
  RecipientType,
} from '../notifications.enums';
import { AddressVerifier } from './address-verifier';
import {
  DeferSendError,
  OutgoingNotification,
  PermanentSendError,
  SkipSendError,
} from './channel-provider';
import { EmailChannelProvider } from './email.provider';

const message = (
  over: Partial<OutgoingNotification> = {},
): OutgoingNotification => ({
  id: 'o1',
  organizationId: 'org',
  eventCode: 'order.rejected',
  audience: NotificationAudience.DOCTOR,
  recipientType: RecipientType.USER,
  recipientId: 'u1',
  channel: NotificationChannel.EMAIL,
  payload: {
    title: 'Order 7 rejected',
    body: 'Precision rejected order 7: wrong shade',
    link: '/lab-orders/7',
    language: 'en' as never,
    to: 'doc@clinic.pk',
    recipientName: 'Dr A',
    providerTemplateRef: null,
    variables: { clinic_name: 'Smile Clinic' },
    reason: 'enabled',
  },
  attempts: 1,
  ...over,
});

function provider(
  opts: { verified?: boolean; room?: boolean; sendError?: Error } = {},
) {
  const sent: { to: string; subject: string; html: string }[] = [];
  const transport = {
    isConfigured: true,
    send: jest.fn((m: { to: string; subject: string; html: string }) => {
      if (opts.sendError) return Promise.reject(opts.sendError);
      sent.push(m);
      return Promise.resolve('msg-1');
    }),
  } as unknown as MailTransport;
  const recordSent = jest.fn();
  const quota = {
    cap: 450,
    hasRoom: () => Promise.resolve(opts.room ?? true),
    recordSent,
    nextWindow: () => new Date('2026-11-06T03:00:00Z'),
  } as unknown as EmailQuota;
  const verifier = {
    isVerified: () => Promise.resolve(opts.verified ?? true),
  } as unknown as AddressVerifier;
  const ds = { query: () => Promise.resolve([]) } as unknown as DataSource;
  return {
    p: new EmailChannelProvider(ds, transport, quota, verifier),
    sent,
    recordSent,
  };
}

describe('EmailChannelProvider', () => {
  it('sends a verified address in the clinic layout with an Open button', async () => {
    const { p, sent, recordSent } = provider();
    await expect(p.send(message())).resolves.toEqual({
      providerMessageId: 'msg-1',
    });
    expect(sent[0].to).toBe('doc@clinic.pk');
    expect(sent[0].subject).toBe('Order 7 rejected');
    expect(sent[0].html).toContain('Smile Clinic');
    expect(sent[0].html).toContain('/lab-orders/7');
    expect(recordSent).toHaveBeenCalled();
  });

  it('never emails an unverified address (skipped_unverified, no retry)', async () => {
    const { p, sent } = provider({ verified: false });
    const err = await p.send(message()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkipSendError);
    expect((err as SkipSendError).status).toBe(OutboxStatus.SKIPPED_UNVERIFIED);
    expect(sent).toHaveLength(0);
  });

  it('holds the email for tomorrow when the daily cap is reached', async () => {
    const { p, sent } = provider({ room: false });
    const err = await p.send(message()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DeferSendError);
    expect((err as DeferSendError).until.toISOString()).toBe(
      '2026-11-06T03:00:00.000Z',
    );
    expect(sent).toHaveLength(0);
  });

  it('a refused mailbox is permanent; no address is permanent', async () => {
    const { p } = provider({
      sendError: new PermanentMailError('550 no such user'),
    });
    await expect(p.send(message())).rejects.toBeInstanceOf(PermanentSendError);
    await expect(
      provider().p.send(
        message({ payload: { ...message().payload, to: null } }),
      ),
    ).rejects.toBeInstanceOf(PermanentSendError);
  });
});

describe('renderEmail', () => {
  it('escapes text and only links http(s) URLs', () => {
    const { html, text } = renderEmail({
      senderName: 'A & B <Clinic>',
      title: 'Hi <script>',
      body: 'Line one\n\nLine "two"',
      cta: { label: 'Open', url: 'javascript:alert(1)' },
      brandColor: 'red;background:url(x)',
    });
    expect(html).toContain('A &amp; B &lt;Clinic&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('red;background');
    expect(text).toContain('Line one');
  });
});
