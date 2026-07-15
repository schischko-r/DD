export function digestTheme(light) {
  if (light === 'red') return 'danger';
  if (light === 'yellow') return 'warning';
  if (light === 'green') return 'success';
  return 'normal';
}

export function digestStatus(light) {
  if (light === 'red') return 'Требует внимания';
  if (light === 'yellow') return 'Наблюдать';
  if (light === 'green') return 'Стабильно';
  return 'Нет оценки';
}

export function worstDigestLight(items) {
  const order = ['red', 'yellow', 'green', 'gray'];
  return order.find((light) => items.some((item) => (item.traffic_light || 'gray') === light)) || 'gray';
}
