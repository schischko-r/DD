import React from 'react';
import {createRoot} from 'react-dom/client';
import {Funnel} from '@ant-design/plots';

const roots = new WeakMap();

/**
 * Сравнительная воронка AntV: compareField разбивает каждый уровень на две
 * половины — слева те, кто идёт дальше, справа те, кто ушёл.
 */
export function renderFunnel(container, {data, palette, height}) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(
    <Funnel
      data={data}
      xField="stage"
      yField="value"
      compareField="side"
      shapeField="funnel"
      height={height}
      legend={false}
      scale={{color: {range: palette}}}
      style={{fillOpacity: 1}}
      label={{
        text: (item) => (item.value ? new Intl.NumberFormat('ru-RU').format(item.value) : ''),
        position: 'inside',
        style: {fill: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, Arial, sans-serif'},
      }}
      axis={{
        y: false,
        x: {
          labelFontSize: 12,
          labelFill: 'rgba(0, 0, 0, .5)',
          labelFontFamily: 'Inter, Arial, sans-serif',
          line: false,
          tick: false,
        },
      }}
      tooltip={{
        title: (item) => item.stage,
        items: [(item) => ({
          name: item.side,
          value: new Intl.NumberFormat('ru-RU').format(item.value),
        })],
      }}
    />,
  );
}
