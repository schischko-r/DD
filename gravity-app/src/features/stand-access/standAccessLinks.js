export const STAND_ACCESS_HOST = 'tvlds-mvp001760.cloud.delta.sbrf.ru:8014';
export const STAND_ACCESS_ORIGIN = `http://${STAND_ACCESS_HOST}`;
export const STAND_ACCESS_ALLOW_ATTRIBUTE = 'data-stand-access-allow';
const ATTACHED_MARKER = '__ddiStandAccessAttached';

export const STAND_ACCESS_CAPTION = 'Доступ к стенду';
export const STAND_ACCESS_TITLE = 'Доступ к системе';
export const STAND_ACCESS_INTRO = 'Для доступа непосредственно к системе необходимо в АС Друг в поисковой строке ввести «Доступ к стендам разработки и тестирования», далее:';
export const STAND_ACCESS_STEPS = Object.freeze([
  'Выбрать «Открыть доступ»',
  'В поле «Выберите автоматизированную систему или ИТ услугу» указать «AI HUB B2C (CI06049712)»',
  'В обосновании — «Для разработки и тестирования инструмента AI суммаризации»',
]);
export const STAND_ACCESS_OUTRO = 'Для входа в систему используйте почтовый адрес сигма и первичный пароль. ФИО, кому направить первичный пароль, просьба направить на почту (Хазипова Мария Юрьевна).';

export function standAccessUrl(href, baseHref) {
  const raw = String(href ?? '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, baseHref || undefined);
    return url.host.toLowerCase() === STAND_ACCESS_HOST ? url.href : '';
  } catch {
    return '';
  }
}

export function isStandAccessHref(href, baseHref) {
  return Boolean(standAccessUrl(href, baseHref));
}

export function findStandAccessLink(target, baseHref) {
  const anchor = target?.closest?.('a[href]');
  if (!anchor || anchor.hasAttribute?.(STAND_ACCESS_ALLOW_ATTRIBUTE)) return '';
  return standAccessUrl(anchor.getAttribute?.('href'), baseHref || anchor.baseURI);
}

export function attachStandAccessInterceptor(node, onStandAccessLink) {
  if (!node?.addEventListener || typeof onStandAccessLink !== 'function') return () => {};
  if (node[ATTACHED_MARKER]) return node[ATTACHED_MARKER];

  const handleClick = (event) => {
    if (event.defaultPrevented) return;
    const href = findStandAccessLink(event.target, node.baseURI);
    if (!href) return;
    event.preventDefault();
    event.stopPropagation();
    onStandAccessLink(href);
  };

  node.addEventListener('click', handleClick, true);
  const detach = () => {
    node.removeEventListener('click', handleClick, true);
    delete node[ATTACHED_MARKER];
  };
  node[ATTACHED_MARKER] = detach;
  return detach;
}
