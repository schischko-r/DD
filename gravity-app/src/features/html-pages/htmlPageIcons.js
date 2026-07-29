import {
  ChartAreaStacked,
  ChartAreaStackedNormalized,
  ChartColumn,
  ChartLine,
  CircleCheck,
  Comments,
  FaceSad,
  FileText,
  Funnel,
  Heart,
  PaperPlane,
  Smartphone,
  Sparkles,
} from '@gravity-ui/icons';

export const HTML_PAGE_ICONS = Object.freeze({
  ChartAreaStacked,
  ChartAreaStackedNormalized,
  ChartColumn,
  ChartLine,
  CircleCheck,
  Comments,
  FaceSad,
  FileText,
  Funnel,
  Heart,
  PaperPlane,
  Smartphone,
  Sparkles,
});

export function htmlPageIcon(iconName) {
  return HTML_PAGE_ICONS[iconName] || ChartLine;
}
