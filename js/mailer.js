// mailer.js — EmailJS 로 엽서를 메일로 보낸다
// 설정은 config.js 의 emailjs 항목(serviceId · templateId · publicKey · imageMode)에서 읽는다.
//   isConfigured()                         → 세 값이 모두 채워져 있는가(YOUR_… 그대로면 false)
//   sendPostcard({ to, jejuText, … node }) → 보낸 뒤 { mode, bytes } 를 돌려준다. 실패하면 화면에 그대로 보여 줄 문구를 담아 throw.
//   mailMessage(code)                      → 안내 문구 한 줄(화면이 같은 문구를 쓸 때)
// 템플릿에 넘기는 변수: to_email, postcard_image, jeju_text, original_text, to_name, from_name, site_name, sent_date

import { t } from './i18n.js';
import { renderJPEG } from './postcard-image.js';
import { getConfig, todayKR, withTimeout } from './shared.js';

// 엽서 그림을 싣는 두 가지 방법(config.js 의 emailjs.imageMode)
const IMAGE_MODES = {
  // 무료 플랜: 메일 본문에 작은 JPEG 를 글자(data URL)로 넣는다. 변수 전체가 50KB 를 넘으면 안 된다.
  inline: { maxBytes: 30000, maxWidth: 560, light: true },
  // 유료(Personal 이상) 플랜: 첨부 파일로 보낸다(템플릿의 Attachments 설정 필요). 요청당 500KB 까지.
  attachment: { maxBytes: 350000, maxWidth: 1200, light: false },
};
const INLINE_TOTAL_LIMIT = 45000; // inline: 모든 변수를 더한 크기의 상한(바이트) — 50KB 한도에서 여유를 둔 값
const COOLDOWN = 10000; // 한 번 보낸 뒤 다시 보낼 수 있을 때까지(ms)
const SEND_TIMEOUT = 30000; // EmailJS 의 답을 이만큼 기다려도 없으면 그만 기다린다(ms)
const NO_REPLY = 'EmailJS 의 답이 없어요'; // 위 시간을 넘겼을 때의 내부 표시(콘솔용)

// ✏️ 교체: 메일 발송 안내 문구(원인별 — 언어별 문구는 data/i18n/*.json 의 같은 키). 쓸 때 꺼내 읽는다(get).
//          '방금 보냈어요…'(mail.cooldown)와 오류 번호가 붙는 안내(mail.unknown-status)는 아래 sendPostcard · toMailError 안에 있다
const MESSAGES = {
  get notConfigured() { return t('mail.not-configured', '메일 발송 설정이 아직 안 되어 있어요(README의 EmailJS 설정 참고)'); },
  get noLibrary() { return t('mail.no-library', '메일 기능을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요'); },
  get busy() { return t('mail.busy', '지금 보내는 중이에요. 잠시만 기다려 주세요'); },
  get config() { return t('mail.config', '메일 발송 설정을 확인해 주세요(config.js의 EmailJS 값 · 템플릿)'); },
  get recipient() { return t('mail.recipient', '받는 주소를 다시 확인해 주세요'); },
  get quota() { return t('mail.quota', "이번 달 메일 발송 한도를 모두 썼어요. '이미지로 저장'을 써 주세요"); },
  get later() { return t('mail.later', '요청이 몰렸어요. 잠시 후 다시 시도해 주세요'); },
  get blocked() { return t('mail.blocked', '이 브라우저에서는 메일 발송이 막혀 있어요'); },
  get tooBig() { return t('mail.too-big', "엽서 그림이 너무 커서 보내지 못했어요. '이미지로 저장'을 써 주세요"); },
  get network() { return t('mail.network', '인터넷 연결을 확인하고 다시 시도해 주세요'); },
  get timeout() { return t('mail.timeout', '메일 서버의 답이 늦어요. 메일함을 먼저 확인해 보고, 오지 않았으면 다시 시도해 주세요'); },
  get image() { return t('mail.image', '엽서 그림을 만들지 못해 메일을 보내지 못했어요. 다시 시도해 주세요'); },
  get unknown() { return t('mail.unknown', '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요'); },
};

export const mailMessage = (code) => MESSAGES[code] || MESSAGES.unknown;

// 화면에 그대로 보여 줄 수 있는 오류(message = 사용자 문구, code = 원인, cause = 원래 오류)
export class MailError extends Error {
  constructor(code, message = MESSAGES[code] || MESSAGES.unknown, cause) {
    super(message);
    this.name = 'MailError';
    this.code = code;
    this.cause = cause;
  }
}

let initedKey = ''; // emailjs.init 은 한 번만(공개 키가 바뀌지 않는 한)
let sending = false;
let lastSentAt = 0;

const filled = (value) => typeof value === 'string' && value.trim() !== '' && !/^YOUR_/i.test(value.trim());

// config.js 에 EmailJS 값 세 개가 모두 채워져 있는가
export function isConfigured() {
  const { serviceId, templateId, publicKey } = getConfig().emailjs;
  return filled(serviceId) && filled(templateId) && filled(publicKey);
}

// EmailJS 의 오류(객체 { status, text } · 문자열 · TypeError)를 사용자 문구로 바꾼다
function toMailError(err) {
  if (err instanceof MailError) return err;
  // 문자열: 보내기 전에 SDK 가 걸러 낸 설정 오류(키 · 서비스 ID · 템플릿 ID 누락)
  if (typeof err === 'string') return new MailError('config', undefined, err);
  // TypeError: 요청이 서버에 닿지 못했다
  if (err instanceof TypeError) return new MailError('network', undefined, err);

  const status = Number(err && err.status);
  const text = String((err && err.text) || '');
  if (/size limit/i.test(text) || status === 413) return new MailError('tooBig', undefined, err);
  if (status === 0 || /network error/i.test(text)) return new MailError('network', undefined, err);
  if (status === 400 || status === 401 || status === 404 || status === 412) return new MailError('config', undefined, err);
  if (status === 422) return new MailError('recipient', undefined, err);
  if (status === 426) return new MailError('quota', undefined, err);
  if (status === 429) return new MailError('later', undefined, err);
  if (status === 403 || status === 451) return new MailError('blocked', undefined, err);
  return new MailError('unknown', status ? t('mail.unknown-status', '{message} (오류 {status})', { message: MESSAGES.unknown, status }) : undefined, err);
}

const byteLength = (value) => new Blob([String(value)]).size;

// 엽서를 메일로 보낸다. node = 그림으로 옮길 엽서 노드(화면에 보이는 상태여야 한다)
export async function sendPostcard({ to, jejuText, originalText = '', toName = '', fromName = '', node }) {
  if (!isConfigured()) throw new MailError('notConfigured');
  const sdk = window.emailjs;
  if (!sdk || typeof sdk.send !== 'function') throw new MailError('noLibrary');
  if (sending) throw new MailError('busy');

  const wait = Math.ceil((lastSentAt + COOLDOWN - Date.now()) / 1000);
  if (wait > 0) throw new MailError('cooldown', t('mail.cooldown', '방금 보냈어요. {seconds}초 뒤에 다시 보낼 수 있어요', { seconds: wait }));

  const { site, emailjs: settings } = getConfig();
  const mode = settings.imageMode === 'attachment' ? 'attachment' : 'inline';

  sending = true;
  try {
    // 1. 엽서를 메일에 실을 수 있는 크기의 JPEG 로
    let image;
    try {
      image = await renderJPEG(node, IMAGE_MODES[mode]);
    } catch (err) {
      console.error('[mailer] 엽서 그림을 만들지 못했어요', err);
      throw new MailError('image', err && err.code === 'no-lib' ? err.message : undefined, err);
    }
    if (!image.ok) throw new MailError('tooBig');

    // 2. 템플릿 변수
    const params = {
      to_email: to,
      postcard_image: image.dataUrl,
      jeju_text: jejuText,
      original_text: originalText,
      to_name: toName,
      from_name: fromName,
      site_name: site.name,
      sent_date: todayKR(),
    };
    if (mode === 'inline') {
      const total = Object.values(params).reduce((sum, value) => sum + byteLength(value), 0);
      if (total >= INLINE_TOTAL_LIMIT) throw new MailError('tooBig');
    }

    // 3. 발송
    try {
      if (initedKey !== settings.publicKey) {
        sdk.init({ publicKey: settings.publicKey });
        initedKey = settings.publicKey;
      }
      // EmailJS 는 답을 무한정 기다린다 → 끊기는 망에서 '보내는 중…' 이 멈춰 있지 않게 상한을 둔다
      const reply = Promise.resolve(sdk.send(settings.serviceId, settings.templateId, params));
      await withTimeout(reply, SEND_TIMEOUT, NO_REPLY).catch((err) => {
        if (!(err instanceof Error) || err.message !== NO_REPLY) throw err;
        // 늦게라도 도착했을 수 있다 → 곧바로 한 통 더 보내지 않게 방금 보낸 것으로 친다
        lastSentAt = Date.now();
        reply.catch(() => {});
        throw new MailError('timeout', undefined, err);
      });
    } catch (err) {
      console.error('[mailer] EmailJS 발송 실패', err);
      throw toMailError(err);
    }

    lastSentAt = Date.now();
    return { mode, bytes: image.bytes, width: image.width };
  } finally {
    sending = false;
  }
}
