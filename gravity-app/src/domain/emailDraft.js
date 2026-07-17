import {changedProductCount as countChangedProducts, serializeReport} from './reportEditor.js';

const RECIPIENT = 'rgshishko@sberbank.ru';
const SUBJECT = 'Data-Driven Index: обновление report-data.json';

function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  if (typeof globalThis.btoa === 'function') {
    const chunks = [];
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
    }
    return globalThis.btoa(chunks.join(''));
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const aggregate = (first << 16) | ((second || 0) << 8) | (third || 0);
    result += alphabet[(aggregate >>> 18) & 63];
    result += alphabet[(aggregate >>> 12) & 63];
    result += second === undefined ? '=' : alphabet[(aggregate >>> 6) & 63];
    result += third === undefined ? '=' : alphabet[aggregate & 63];
  }
  return result;
}

function wrapBase64(value) {
  return value.match(/.{1,76}/g)?.join('\r\n') || '';
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function draftFilename(date) {
  return `data-driven-report-update-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}.eml`;
}

function formattedDate(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function changedCount(report, options) {
  if (Number.isInteger(options.changedProductCount) && options.changedProductCount >= 0) {
    return options.changedProductCount;
  }
  const baseline = options.baselineReport || options.baseline;
  return baseline ? countChangedProducts(baseline, report) : 0;
}

function safeBoundary(value) {
  if (!/^[A-Za-z0-9'()+_,./:=?-]+$/.test(value)) throw new RangeError('Недопустимый MIME boundary.');
  return value;
}

export function createReportEml(report, options = {}) {
  const date = options.now instanceof Date ? new Date(options.now) : new Date(options.now || Date.now());
  if (!Number.isFinite(date.getTime())) throw new RangeError('Некорректная дата формирования письма.');
  const reportJson = serializeReport(report);
  const teamsChanged = changedCount(report, options);
  const dateText = options.dateText || formattedDate(date);
  const body = [
    'Добрый день!',
    '',
    'Во вложении файл report-data.json с изменениями из HTML-конструктора.',
    '',
    'Файл необходимо положить в репозиторий по пути:',
    'gravity-app/public/report-data.json',
    'с заменой текущего файла.',
    '',
    'После замены необходимо пересобрать standalone-артефакты и запустить тесты.',
    '',
    `Дата формирования: ${dateText}`,
    `Изменено команд: ${teamsChanged}`,
  ].join('\n');
  const boundary = safeBoundary(options.boundary || `----=_DataDriven_${date.getTime()}_${reportJson.length}`);
  const encodedSubject = `=?UTF-8?B?${utf8ToBase64(SUBJECT)}?=`;
  const content = [
    `To: ${RECIPIENT}`,
    `Subject: ${encodedSubject}`,
    `Date: ${date.toUTCString()}`,
    'MIME-Version: 1.0',
    'X-Unsent: 1',
    'Content-Class: urn:content-classes:message',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(utf8ToBase64(body)),
    `--${boundary}`,
    'Content-Type: application/json; name="report-data.json"',
    'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="report-data.json"',
    '',
    wrapBase64(utf8ToBase64(reportJson)),
    `--${boundary}--`,
    '',
  ].join('\r\n');

  return {
    filename: options.filename || draftFilename(date),
    content,
    mimeType: 'message/rfc822',
    body,
    subject: SUBJECT,
  };
}
