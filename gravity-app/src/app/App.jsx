import React, {useCallback, useEffect, useState} from 'react';
import {BarsAscendingAlignLeft, ChartColumn, ChartMixed, CircleInfo} from '@gravity-ui/icons';
import {Spin} from '@gravity-ui/uikit';
import {AsideHeader} from '@gravity-ui/navigation';
import {AboutPage} from '../pages/AboutPage.jsx';
import {DashboardPage} from '../pages/DashboardPage.jsx';
import {SummaryPage} from '../pages/SummaryPage.jsx';
import {TeamProfilePage} from '../pages/TeamProfilePage.jsx';
import ocb2cLogo from '../assets/ocb2c.png';

const MOBILE_NAVIGATION_QUERY = '(max-width: 760px)';

const getInitialNavigationCompact = () => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia(MOBILE_NAVIGATION_QUERY).matches
);

export function App() {
  const [data, setData] = useState(null);
  const [view, setView] = useState('dashboard');
  const [selected, setSelected] = useState(null);
  const [detailScore, setDetailScore] = useState(false);
  const [compact, setCompact] = useState(getInitialNavigationCompact);
  const [summaryFilters, setSummaryFilters] = useState({period: '', unit: ''});
  const updateSummaryFilters = useCallback((patch) => {
    setSummaryFilters((current) => ({...current, ...patch}));
  }, []);
  useEffect(() => {
    fetch('./report-data.json', {cache: 'no-store'})
      .then((response) => response.json())
      .then(setData);
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia(MOBILE_NAVIGATION_QUERY);
    const collapseOnMobile = ({matches}) => {
      if (matches) setCompact(true);
    };

    collapseOnMobile(mediaQuery);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', collapseOnMobile);
      return () => mediaQuery.removeEventListener('change', collapseOnMobile);
    }
    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(collapseOnMobile);
      return () => mediaQuery.removeListener(collapseOnMobile);
    }
    return undefined;
  }, []);
  if (!data) return <div className="loading"><Spin size="xl" /></div>;
  const rows = data.title?.rows || [];
  const defaultProduct = data.products.find((item) => /^вклады$/i.test(String(item.name || '').trim()))
    || data.products.find((item) => /^вклады\s*\+\s*нс$/i.test(String(item.name || '').trim()))
    || data.products[0];
  const product = selected || defaultProduct;
  const openProduct = (item) => { setSelected(item); setView('detail'); window.scrollTo(0, 0); };
  const toggleDetailScore = () => setDetailScore((value) => {
    const nextValue = !value;
    if (!nextValue && view === 'summary') setView('dashboard');
    return nextValue;
  });
  const menuItems = [
    {
      id: 'dashboard',
      title: 'Summary',
      tooltipText: 'Summary',
      icon: ChartMixed,
      current: view === 'dashboard',
      onItemClick: () => setView('dashboard'),
    },
    {
      id: 'detail',
      title: '\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043a\u043e\u043c\u0430\u043d\u0434\u044b',
      tooltipText: '\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043a\u043e\u043c\u0430\u043d\u0434\u044b',
      icon: BarsAscendingAlignLeft,
      current: view === 'detail',
      onItemClick: () => setView('detail'),
    },
    ...(detailScore ? [{
      id: 'summary',
      title: '\u0421\u0432\u043e\u0434\u043d\u0430\u044f \u0442\u0430\u0431\u043b\u0438\u0446\u0430',
      tooltipText: '\u0421\u0432\u043e\u0434\u043d\u0430\u044f \u0442\u0430\u0431\u043b\u0438\u0446\u0430',
      icon: ChartColumn,
      current: view === 'summary',
      onItemClick: () => setView('summary'),
    }] : []),
    {
      id: 'about',
      title: 'О Data Driven',
      tooltipText: 'О Data Driven',
      icon: CircleInfo,
      current: view === 'about',
      onItemClick: () => setView('about'),
    },
  ];
  const content = view === 'summary'
    ? <SummaryPage products={data.products} rows={rows} />
    : view === 'dashboard'
      ? <DashboardPage products={data.products} rows={rows} summaryFilters={summaryFilters} onSummaryFiltersChange={updateSummaryFilters} onOpen={openProduct} onAbout={() => { setView('about'); window.scrollTo(0, 0); }} />
      : view === 'about'
        ? <AboutPage onBack={() => { setView('dashboard'); window.scrollTo(0, 0); }} />
        : <TeamProfilePage product={product} products={data.products} rows={rows} detailScore={detailScore} onBack={() => setView('dashboard')} onProduct={setSelected} />;
  return (
    <AsideHeader
      compact={compact}
      onChangeCompact={setCompact}
      collapseTitle="Свернуть меню"
      expandTitle="Развернуть меню"
      className="dd-navigation"
      logo={{text: 'Data-Driven Index', iconSrc: ocb2cLogo, iconSize: 30, iconClassName: 'dd-navigation-logo', href: '#', onClick: (event) => { event.preventDefault(); setView('dashboard'); window.scrollTo(0, 0); }, 'aria-label': 'Открыть Summary'}}
      menuItems={menuItems}
      renderContent={() => content}
    />
  );
}
