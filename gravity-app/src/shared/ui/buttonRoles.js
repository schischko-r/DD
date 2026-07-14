export const BUTTON_INTENT = Object.freeze({
  primary: 'primary',
  secondary: 'secondary',
  navigation: 'navigation',
  destructive: 'destructive',
  compactIcon: 'compact-icon',
});

const BUTTON_PROPS = Object.freeze({
  [BUTTON_INTENT.primary]: Object.freeze({view: 'action', size: 'm'}),
  [BUTTON_INTENT.secondary]: Object.freeze({view: 'outlined-info', size: 'm'}),
  [BUTTON_INTENT.navigation]: Object.freeze({view: 'flat', size: 'm'}),
  [BUTTON_INTENT.destructive]: Object.freeze({view: 'outlined-danger', size: 's'}),
  [BUTTON_INTENT.compactIcon]: Object.freeze({view: 'flat', size: 's'}),
});

export function buttonPropsFor(intent) {
  const props = BUTTON_PROPS[intent];
  if (!props) throw new Error(`Unknown semantic button intent: ${intent}`);
  return props;
}
