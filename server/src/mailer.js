/**
 * Почта. Без SMTP-настроек письма не отправляются, а пишутся в лог —
 * так сервер запускается и проверяется до появления почтового ящика.
 * Письма нужны для двух вещей: сброс пароля и приглашение установить пароль
 * после переноса аккаунта (Firebase не отдаёт хэши паролей).
 */
import { connect } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import { randomUUID } from 'node:crypto';

export function makeMailer(config) {
  const { host, port, secure, user, pass, from } = config.mail;
  const enabled = Boolean(host);

  async function send({ to, subject, text, html }) {
    if (!enabled) {
      console.log('[mail:dry-run]', to, '|', subject, '|', text.replace(/\s+/g, ' ').slice(0, 300));
      return { ok: false, dryRun: true };
    }
    const message = buildMessage({ from, to, subject, text, html });
    try {
      await smtpSend({ host, port, secure, user, pass, from, to }, message);
      return { ok: true };
    } catch (err) {
      console.error('[mail] ошибка отправки:', err.message);
      return { ok: false, error: err.message };
    }
  }

  return {
    enabled,
    send,
    sendPasswordReset: (email, link) => send({
      to: email,
      subject: '«Давай играй»: восстановление пароля',
      text: `Здравствуйте!\n\nДля смены пароля перейдите по ссылке (она действует час):\n${link}\n\nЕсли вы не запрашивали смену пароля, просто проигнорируйте письмо.`,
      html: `<p>Здравствуйте!</p><p>Для смены пароля перейдите по ссылке (действует час):</p><p><a href="${link}">${link}</a></p><p>Если вы не запрашивали смену пароля, проигнорируйте письмо.</p>`,
    }),
    sendWelcome: (email, link) => send({
      to: email,
      subject: '«Давай играй»: установите новый пароль',
      text: `Здравствуйте!\n\nАккаунт перенесён на новую платформу. Пароль от старого входа не переносится, поэтому установите новый по ссылке (действует 14 дней):\n${link}\n\nВся статистика сохранена.`,
      html: `<p>Здравствуйте!</p><p>Аккаунт перенесён на новую платформу. Пароль от старого входа не переносится — установите новый по ссылке (действует 14 дней):</p><p><a href="${link}">${link}</a></p><p>Вся статистика сохранена.</p>`,
    }),
    sendAccessNotice: (email) => send({
      to: email,
      subject: '«Давай играй»: заявка на доступ принята',
      text: 'Заявка принята. Ответ придёт на этот адрес.',
    }),
  };
}

function buildMessage({ from, to, subject, text, html }) {
  const boundary = 'b' + randomUUID().replace(/-/g, '');
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@${from.split('@')[1] || 'localhost'}>`,
  ];
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(Buffer.from(text, 'utf8').toString('base64')),
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(Buffer.from(html || `<pre>${text}</pre>`, 'utf8').toString('base64')),
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return headers.join('\r\n') + '\r\n\r\n' + body;
}

function wrap76(b64) {
  return b64.match(/.{1,76}/g)?.join('\r\n') || '';
}

/** Минимальный SMTP-клиент: EHLO, AUTH PLAIN, STARTTLS при возможности. */
function smtpSend({ host, port, secure, user, pass, from, to }, message) {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tlsConnect({ host, port, servername: host })
      : connect({ host, port });
    let buffer = '';
    let step = 0;
    const queue = [];
    const waiters = [];

    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (/^\d{3}-/.test(line)) continue;
        const code = Number(line.slice(0, 3));
        const waiter = waiters.shift();
        if (waiter) waiter({ code, line });
      }
    };
    const expect = () => new Promise((res) => waiters.push(res));
    const write = (text) => socket.write(text.endsWith('\r\n') ? text : text + '\r\n');

    socket.setTimeout(15000, () => { socket.destroy(); reject(new Error('SMTP: таймаут')); });
    socket.on('error', reject);
    socket.on('data', onData);

    (async () => {
      try {
        let r = await expect();
        if (r.code !== 220) throw new Error(`SMTP: ${r.line}`);
        write(`EHLO ${host}`);
        r = await expect();
        if (r.code !== 250) throw new Error(`SMTP: ${r.line}`);
        if (user && pass) {
          write('AUTH PLAIN ' + Buffer.from(`\0${user}\0${pass}`).toString('base64'));
          r = await expect();
          if (r.code !== 235) throw new Error(`SMTP AUTH: ${r.line}`);
        }
        write(`MAIL FROM:<${from}>`);
        r = await expect();
        if (r.code !== 250) throw new Error(`SMTP: ${r.line}`);
        write(`RCPT TO:<${to}>`);
        r = await expect();
        if (r.code !== 250 && r.code !== 251) throw new Error(`SMTP: ${r.line}`);
        write('DATA');
        r = await expect();
        if (r.code !== 354) throw new Error(`SMTP: ${r.line}`);
        socket.write(message.replace(/^\./gm, '..') + '\r\n.\r\n');
        r = await expect();
        if (r.code !== 250) throw new Error(`SMTP: ${r.line}`);
        write('QUIT');
        socket.end();
        resolve();
      } catch (err) {
        socket.destroy();
        reject(err);
      }
    })();

    queue.length = 0;
    step += 1;
  });
}
