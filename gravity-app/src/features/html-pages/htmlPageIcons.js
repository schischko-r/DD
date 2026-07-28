import {
  ChartAreaStacked,
  ChartColumn,
  ChartLine,
  CircleCheck,
  Comments,
  FileText,
  Sparkles,
} from '@gravity-ui/icons';

export const HTML_PAGE_ICONS = Object.freeze({
  ChartAreaStacked,
  ChartColumn,
  ChartLine,
  CircleCheck,
  Comments,
  FileText,
  Sparkles,
});

export function htmlPageIcon(iconName) {
  return HTML_PAGE_ICONS[iconName] || ChartLine;
}
