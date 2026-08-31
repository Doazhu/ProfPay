/**
 * Безопасный разбор адреса возврата после входа.
 *
 * ProtectedRoute запоминает страницу, куда шёл пользователь, а LoginPage
 * переходит на неё после успешного входа. Значение приходит из адресной
 * строки, то есть управляется извне.
 *
 * В react-router 6.x и 7.x до 7.18 есть открытый редирект: путь вида
 * `//evil.com` или `\\evil.com` уводит на чужой домен, а вместе с переходом
 * уезжает доверие пользователя к адресу. Проверка ниже закрывает это
 * независимо от версии библиотеки.
 */

/** Куда отправлять, если адрес возврата не прошёл проверку. */
export const DEFAULT_REDIRECT = '/';

/**
 * Пропускает только относительные пути внутри приложения.
 *
 * Отвергается всё, что может увести на другой сайт: схема, две ведущие косые,
 * обратные косые (браузеры нормализуют их в прямые) и управляющие символы.
 */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return DEFAULT_REDIRECT;

  // Управляющие символы и пробелы браузер вырежет сам, а проверку обманут.
  const path = value.replace(/[\u0000-\u0020]/g, '');

  if (!path.startsWith('/')) return DEFAULT_REDIRECT;   // абсолютный адрес или схема
  if (path.startsWith('//')) return DEFAULT_REDIRECT;   // протокол-относительный
  if (path.includes('\\')) return DEFAULT_REDIRECT;     // \\evil.com
  if (path.includes(':')) return DEFAULT_REDIRECT;      // javascript: и подобное

  return path;
}
