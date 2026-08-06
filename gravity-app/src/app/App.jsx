import React, {useCallback, useEffect, useState} from 'react';
import {BarsAscendingAlignLeft, ChartColumn, ChartMixed, CircleInfo, Ticket} from '@gravity-ui/icons';
import {Divider, Flex, Spin} from '@gravity-ui/uikit';
import {AsideHeader, FooterItem} from '@gravity-ui/navigation';
import {AboutPage} from '../pages/AboutPage.jsx';
import {BacklogDecompositionPage} from '../pages/BacklogDecompositionPage.jsx';
import {DashboardPage} from '../pages/DashboardPage.jsx';
import {HtmlReportPage} from '../pages/HtmlReportPage.jsx';
import {SummaryPage} from '../pages/SummaryPage.jsx';
import {TeamProfilePage} from '../pages/TeamProfilePage.jsx';
import {isUnitFilterOption} from '../features/catalog/Catalog.jsx';
import {HTML_PAGE_TOOLS} from '../features/html-pages/htmlPageTools.js';
import {htmlPageIcon} from '../features/html-pages/htmlPageIcons.js';
import ocb2cLogo from '../assets/ocb2c.png';

const MOBILE_NAVIGATION_QUERY = '(max-width: 760px)';
const BACKLOG_DECOMPOSITION_ENABLED = import.meta.env.VITE_BACKLOG_DECOMPOSITION_ENABLED === 'true';
const normalizeTeamName = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');

export function App() {
  const [data, setData] = useState(null);
  const [backlog, setBacklog] = useState({status: 'loading', data: null});
  const [view, setView] = useState('dashboard');
  const [selected, setSelected] = useState(null);
  const [htmlPageContext, setHtmlPageContext] = useState({});
  const [backlogTeamKey, setBacklogTeamKey] = useState('');
  const [detailScore, setDetailScore] = useState(false);
  const [compact, setCompact] = useState(true);
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
    if (!BACKLOG_DECOMPOSITION_ENABLED) {
      setBacklog({status: 'disabled', data: null});
      return undefined;
    }
    fetch('./backlog-data.json', {cache: 'no-store'})
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((backlogData) => setBacklog({status: 'ready', data: backlogData}))
      .catch(() => setBacklog({status: 'error', data: null}));
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
  const openProduct = (item) => {
    updateSummaryFilters({unit: item.unit && isUnitFilterOption(item.unit) ? item.unit : ''});
    setSelected(item);
    setView('detail');
    window.scrollTo(0, 0);
  };
  const openHtmlPageTool = (toolId, context = {}) => {
    setHtmlPageContext(context);
    setView(`html-page:${toolId}`);
    window.scrollTo(0, 0);
  };
  const activeHtmlPageTool = HTML_PAGE_TOOLS.find(
    (tool) => view === `html-page:${tool.id}`,
  );
  const toggleDetailScore = () => setDetailScore((value) => {
    const nextValue = !value;
    if (!nextValue && view === 'summary') setView('dashboard');
    return nextValue;
  });
  const backlogTeams = Array.isArray(backlog.data?.teams) ? backlog.data.teams : [];
  const productBacklogTeam = backlogTeams.find((team) => {
    const teamNames = [team?.label, team?.meta?.teamLabel].map(normalizeTeamName).filter(Boolean);
    return teamNames.includes(normalizeTeamName(product?.name));
  });
  const openBacklog = (teamKey = '') => {
    setBacklogTeamKey(String(teamKey || ''));
    setView('backlog');
    window.scrollTo(0, 0);
  };
  const openBacklogTeam = (teamDataset) => {
    const requestedNames = [teamDataset?.label, teamDataset?.meta?.teamLabel]
      .map(normalizeTeamName)
      .filter(Boolean);
    const target = data.products.find((item) => requestedNames.includes(normalizeTeamName(item?.name)))
      || data.products.find((item) => normalizeTeamName(item?.name) === normalizeTeamName('СберЧаевые'));
    if (!target) return;
    setSelected(target);
    setView('detail');
    window.scrollTo(0, 0);
  };
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
    ? <SummaryPage products={data.products} rows={rows} unitFilter={summaryFilters.unit} onUnitFilterChange={(unit) => updateSummaryFilters({unit})} />
    : activeHtmlPageTool
      ? <HtmlReportPage tool={activeHtmlPageTool} context={htmlPageContext} onBack={() => { setView('detail'); window.scrollTo(0, 0); }} />
      : view === 'dashboard'
        ? <DashboardPage products={data.products} rows={rows} summaryFilters={summaryFilters} onSummaryFiltersChange={updateSummaryFilters} onOpen={openProduct} onAbout={() => { setView('about'); window.scrollTo(0, 0); }} />
        : view === 'about'
          ? <AboutPage onBack={() => { setView('dashboard'); window.scrollTo(0, 0); }} />
          : view === 'backlog' && BACKLOG_DECOMPOSITION_ENABLED
            ? <BacklogDecompositionPage data={backlog.data} status={backlog.status} onOpenTeam={openBacklogTeam} initialTeamKey={backlogTeamKey} />
            : <TeamProfilePage product={product} products={data.products} rows={rows} detailScore={detailScore} teamUnit={summaryFilters.unit} onTeamUnitChange={(unit) => updateSummaryFilters({unit})} onBack={() => setView('dashboard')} onProduct={setSelected} onOpenHtmlPageTool={openHtmlPageTool} onAbout={() => { setView('about'); window.scrollTo(0, 0); }} onBacklog={BACKLOG_DECOMPOSITION_ENABLED && productBacklogTeam ? () => openBacklog(productBacklogTeam.key) : undefined} />;
  return (
    <AsideHeader
      compact={compact}
      onChangeCompact={setCompact}
      collapseTitle="Свернуть меню"
      expandTitle="Развернуть меню"
      className="dd-navigation"
      logo={{text: 'Data-Driven Index', iconSrc: ocb2cLogo, iconSize: 30, iconClassName: 'dd-navigation-logo', href: '#', onClick: (event) => { event.preventDefault(); setView('dashboard'); window.scrollTo(0, 0); }, 'aria-label': 'Открыть Summary'}}
      menuItems={menuItems}
      renderFooter={({compact: footerCompact}) => (
        <Flex direction="column" gap="2">
          <Divider />
          {HTML_PAGE_TOOLS.map((tool) => (
            <FooterItem
              key={tool.id}
              id={`html-page:${tool.id}`}
              title={tool.title}
              tooltipText={tool.title}
              icon={htmlPageIcon(tool.icon)}
              compact={footerCompact}
              current={view === `html-page:${tool.id}`}
              onItemClick={() => openHtmlPageTool(tool.id)}
            />
          ))}
          {BACKLOG_DECOMPOSITION_ENABLED && <FooterItem
            id="backlog"
            title="Декомпозиция бэклога"
            tooltipText="Декомпозиция бэклога"
            icon={Ticket}
            compact={footerCompact}
            current={view === 'backlog'}
            onItemClick={() => openBacklog()}
          />}
        </Flex>
      )}
      renderContent={() => content}
    />
  );
}
