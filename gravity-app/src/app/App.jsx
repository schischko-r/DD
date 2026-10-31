import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {BarsAscendingAlignLeft, ChartColumn, ChartMixed, CircleQuestion, CircleTree, Ticket} from '@gravity-ui/icons';
import {Select, Spin} from '@gravity-ui/uikit';
import {AsideHeader} from '@gravity-ui/navigation';
import {AboutPage} from '../pages/AboutPage.jsx';
import {BacklogDecompositionPage} from '../pages/BacklogDecompositionPage.jsx';
import {DashboardPage} from '../pages/DashboardPage.jsx';
import {HtmlReportPage} from '../pages/HtmlReportPage.jsx';
import {InitiativesBacklogPage} from '../pages/InitiativesBacklogPage.jsx';
import {SummaryPage} from '../pages/SummaryPage.jsx';
import {TeamProfilePage} from '../pages/TeamProfilePage.jsx';
import {isUnitFilterOption} from '../features/catalog/Catalog.jsx';
import {HTML_PAGE_TOOLS} from '../features/html-pages/htmlPageTools.js';
import {StandAccessDialog} from '../features/stand-access/StandAccessDialog.jsx';
import {attachStandAccessInterceptor} from '../features/stand-access/standAccessLinks.js';
import {htmlPageIcon} from '../features/html-pages/htmlPageIcons.js';
import ocb2cLogo from '../assets/ocb2c.png';
import {filterTitleRowsByPeriod, resolveTeamProfileSelection} from '../domain/teamProfileSelection.js';
import {buildDdiPeriodProducts} from '../domain/quarterProfiles.js';
import {getReportPeriods} from '../domain/reportPeriods.js';
import {buildSummaryPeriodData} from '../domain/summaryPeriod.js';
import {backlogTeamMatchesProduct, backlogTeamOptionValue, findProductForBacklogTeam} from '../domain/backlogTeamSelection.js';
import campaignMetricsQ32026 from '../data/campaign-metrics-q3-2026.json';
import draftMetricsQ32026 from '../data/draft-metrics-q3-2026.json';
import crosssellMetricsQ32026 from '../data/crosssell-metrics-q3-2026.json';
import crosssellAfterPurchaseScoresQ32026 from '../data/crosssell-after-purchase-scores-q3-2026.json';
import researchMetricsQ32026 from '../data/research-metrics-q3-2026.json';
import funnelReportingMetricsQ32026 from '../data/funnel-reporting-metrics-q3-2026.json';
import uxScoreMetricsQ32026 from '../data/ux-score-metrics-q3-2026.json';
import mechanicsMetricsQ32026 from '../data/mechanics-metrics-q3-2026.json';
import goalsMetricsQ32026 from '../data/goals-metrics-q3-2026.json';
import keyMetricsQ32026 from '../data/key-metrics-q3-2026.json';
import navigatorReportingKnowledgeQ32026 from '../data/navigator-reporting-knowledge-q3-2026.json';
import navigatorMarketKnowledgeQ32026 from '../data/navigator-market-knowledge-q3-2026.json';
import goalsUserCarryForwardQ32026 from '../data/goals-user-carry-forward-q3-2026.json';
import abTestsUserAssessmentsQ32026 from '../data/ab-tests-user-assessments-q3-2026.json';
import funnelAdditionalUserAssessmentsQ32026 from '../data/funnel-additional-user-assessments-q3-2026.json';
import knowledgeUserAssessmentsQ32026 from '../data/knowledge-user-assessments-q3-2026.json';
import chatEntryActionsQ32026 from '../data/chat-entry-actions-q3-2026.json';
import selectedMetricsCarryForwardQ32026 from '../data/selected-metrics-carry-forward-q3-2026.json';
import cxScoreMetricsQ32026 from '../data/cx-score-metrics-q3-2026.json';
import campaignMissingZeroQ32026 from '../data/campaign-missing-zero-q3-2026.json';
import campaignUserAssessmentsQ32026 from '../data/campaign-user-assessments-q3-2026.json';
import userMetricAssessmentsQ32026 from '../data/user-metric-assessments-q3-2026.json';
import funnelUserAssessmentsQ32026 from '../data/funnel-user-assessments-q3-2026.json';
import metricApplicabilityQ32026 from '../data/metric-applicability-q3-2026.json';
import mechanicsUserAssessmentsQ32026 from '../data/mechanics-user-assessments-q3-2026.json';
import alertsCarryForwardQ32026 from '../data/alerts-carry-forward-q3-2026.json';
import discoveryMetricsQ32026 from '../data/discovery-metrics-q3-2026.json';
import salaryProductsQ32026 from '../data/salary-products-q3-2026.json';
import reportingMissingQ32026 from '../data/reporting-regularity-missing-q3-2026.json';
import funnelActionMissingQ32026 from '../data/funnel-action-missing-q3-2026.json';
import regularityUserAssessmentsQ32026 from '../data/regularity-user-assessments-q3-2026.json';

import navigatorMauKnowledgeQ32026 from '../data/navigator-mau-knowledge-q3-2026.json';
import digitalChannelActionsQ32026 from '../data/digital-channel-actions-q3-2026.json';
import digitalChannelReturnQ32026 from '../data/digital-channel-return-q3-2026.json';

import omsKeyMetricsAssessmentQ32026 from '../data/oms-key-metrics-assessment-q3-2026.json';
import omsGoalsAssessmentQ32026 from '../data/oms-goals-assessment-q3-2026.json';
import omsFunnelUserAssessmentQ32026 from '../data/oms-funnel-user-assessment-q3-2026.json';
import omsUserMetricAssessmentQ32026 from '../data/oms-user-metric-assessment-q3-2026.json';
import omsMechanicsUserAssessmentQ32026 from '../data/oms-mechanics-user-assessment-q3-2026.json';

import segmentUserAssessmentsQ32026 from '../data/segment-user-assessments-q3-2026.json';

import navigatorZeroMarketsQ32026 from '../data/navigator-zero-markets-q3-2026.json';

import alertsBenchmarksUserQ32026 from '../data/alerts-benchmarks-user-q3-2026.json';

import domclickSelfServiceQ32026 from '../data/domclick-self-service-q3-2026.json';

import corporateFlexibleConditionsApplicabilityQ32026 from '../data/corporate-flexible-conditions-applicability-q3-2026.json';

import quarterRetentionUserQ32026 from '../data/quarter-retention-user-q3-2026.json';

import pbBusinessAlertsQ32026 from '../data/pb-business-alerts-q3-2026.json';

import pbNonfinancialKnowledgeQ32026 from '../data/pb-nonfinancial-knowledge-q3-2026.json';
import pbNavigatorKnowledgeQ32026 from '../data/pb-navigator-knowledge-q3-2026.json';

import goalsTribeAssessmentsQ32026 from '../data/goals-tribe-assessments-q3-2026.json';
import goalsTribeApplicabilityQ32026 from '../data/goals-tribe-applicability-q3-2026.json';

import goalsInformationalQ32026 from '../data/goals-informational-q3-2026.json';

import poGoalsTemplateQ32026 from '../data/po-goals-template-q3-2026.json';

import poGoalsSurveyAssessmentsQ32026 from '../data/po-goals-survey-assessments-q3-2026.json';

import campaigningQuarterRetentionQ32026 from '../data/campaigning-quarter-retention-q3-2026.json';

import kaskoSatellitesQ32026 from '../data/kasko-satellites-q3-2026.json';
import monetyChurnAnalysisQ32026 from '../data/monety-churn-analysis-q3-2026.json';

import campaigningPerformanceQ32026 from '../data/campaigning-performance-q3-2026.json';
import campaigningAlertsQ32026 from '../data/campaigning-alerts-q3-2026.json';

import allSatellitesKnowledgeQ32026 from '../data/all-satellites-knowledge-q3-2026.json';

import campaigningDataQualityQ32026 from '../data/campaigning-data-quality-q3-2026.json';

import campaigningDeviationActionsQ32026 from '../data/campaigning-deviation-actions-q3-2026.json';

import corporateChurnCompletenessQ32026 from '../data/corporate-churn-completeness-q3-2026.json';

import cfaAttractCompletenessQ32026 from '../data/cfa-attract-completeness-q3-2026.json';
import cfaAttractBenchmarksQ32026 from '../data/cfa-attract-benchmarks-q3-2026.json';

import abTestsInsuranceVisibilityQ32026 from '../data/ab-tests-insurance-visibility-q3-2026.json';

import nszhFunnelCompletenessQ32026 from '../data/nszh-funnel-completeness-q3-2026.json';

import iszhFunnelCompletenessQ32026 from '../data/iszh-funnel-completeness-q3-2026.json';

import investKopilkaNavigatorQ32026 from '../data/investkopilka-navigator-q3-2026.json';

import depositsChurnCompletenessQ32026 from '../data/deposits-churn-completeness-q3-2026.json';

import paymentsMechanicsQ32026 from '../data/payments-mechanics-q3-2026.json';

import dataQualitySurveyQ32026 from '../data/data-quality-survey-q3-2026.json';

import monthlyExcelReportingQ32026 from '../data/monthly-excel-reporting-q3-2026.json';

import workingAgeFotKnowledgeQ32026 from '../data/working-age-fot-knowledge-q3-2026.json';

import smileMarketsZeroQ32026 from '../data/smile-markets-zero-q3-2026.json';

import smileAttractAnalysisQ32026 from '../data/smile-attract-analysis-q3-2026.json';

const Q3_OVERLAYS = [mechanicsMetricsQ32026, alertsCarryForwardQ32026, campaignMetricsQ32026, draftMetricsQ32026, crosssellMetricsQ32026, crosssellAfterPurchaseScoresQ32026, researchMetricsQ32026, funnelReportingMetricsQ32026, uxScoreMetricsQ32026, goalsMetricsQ32026, keyMetricsQ32026, selectedMetricsCarryForwardQ32026, cxScoreMetricsQ32026, campaignMissingZeroQ32026, campaignUserAssessmentsQ32026, userMetricAssessmentsQ32026, funnelUserAssessmentsQ32026, funnelAdditionalUserAssessmentsQ32026, chatEntryActionsQ32026, navigatorReportingKnowledgeQ32026, navigatorMarketKnowledgeQ32026, knowledgeUserAssessmentsQ32026, goalsUserCarryForwardQ32026, abTestsUserAssessmentsQ32026, mechanicsUserAssessmentsQ32026, discoveryMetricsQ32026, regularityUserAssessmentsQ32026, metricApplicabilityQ32026, navigatorMauKnowledgeQ32026, digitalChannelActionsQ32026, digitalChannelReturnQ32026, omsKeyMetricsAssessmentQ32026, omsGoalsAssessmentQ32026, omsFunnelUserAssessmentQ32026, omsUserMetricAssessmentQ32026, omsMechanicsUserAssessmentQ32026, segmentUserAssessmentsQ32026, navigatorZeroMarketsQ32026, alertsBenchmarksUserQ32026, domclickSelfServiceQ32026, corporateFlexibleConditionsApplicabilityQ32026, quarterRetentionUserQ32026, pbBusinessAlertsQ32026, pbNonfinancialKnowledgeQ32026, pbNavigatorKnowledgeQ32026, goalsTribeAssessmentsQ32026, goalsTribeApplicabilityQ32026, goalsInformationalQ32026, poGoalsTemplateQ32026, poGoalsSurveyAssessmentsQ32026, campaigningQuarterRetentionQ32026, kaskoSatellitesQ32026, monetyChurnAnalysisQ32026, campaigningPerformanceQ32026, campaigningAlertsQ32026, allSatellitesKnowledgeQ32026, campaigningDataQualityQ32026, campaigningDeviationActionsQ32026, corporateChurnCompletenessQ32026, cfaAttractCompletenessQ32026, cfaAttractBenchmarksQ32026, abTestsInsuranceVisibilityQ32026, nszhFunnelCompletenessQ32026, iszhFunnelCompletenessQ32026, investKopilkaNavigatorQ32026, depositsChurnCompletenessQ32026, paymentsMechanicsQ32026, dataQualitySurveyQ32026, monthlyExcelReportingQ32026, workingAgeFotKnowledgeQ32026, smileMarketsZeroQ32026, smileAttractAnalysisQ32026];

const MOBILE_NAVIGATION_QUERY = '(max-width: 760px)';
const BACKLOG_DECOMPOSITION_ENABLED = import.meta.env.VITE_BACKLOG_DECOMPOSITION_ENABLED !== 'false';
const CJXPLORER_PRODUCT_ALIASES = {
  'Автокредит': ['Автокредит', 'Автокредит (с2с)'], 'Платежи': ['Автоплатеж', 'Оплата с нескольких счетов', 'Платеж ЖКХ (Дом)', 'Платежи'],
  'БПИФ': ['БПИФ'], 'Брокерский счет': ['Брокерское обслуживание'], 'СБОЛ': ['Веб СБОЛ', 'Витрина инвестиций', 'Витрина страхования', 'МП СБОЛ', 'Поиск в МП СБОЛ', 'Раздел «Настройки» в МП СБОЛ', 'Раздел Выгода в МП СБОЛ'],
  'Вклады+НС': ['Вклад', 'Вклад Лучший %', 'Вклад Молодежный', 'Вклад Сбер Акционер', 'Накопительный счет для массовых клиентов', 'Накопительный счет Премиум'], 'ПДС': ['Вклад «Забота о будущем» + ПДС', 'ПДС'],
  'Дебетовая карта': ['Дебетовая карта', 'Зарплатная карта', 'Молодежная карта'], 'Потребительский кредит': ['Деньги до зарплаты', 'Кредит наличными (Потребительский кредит)', 'Потребительский кредит', 'Реструктуризация', 'Рефинансирование'],
  'POS-кредиты': ['Деньги за покупки (POS)'], 'Детская карта': ['Детская карта'], 'ЗЛС': ['Защита на любой случай (ЗЛС)'], 'ЗПИФ': ['ЗПИФ'], 'ИСЖ': ['ИСЖ'], 'Кредитные карты': ['Кредитная карта'],
  'Кредитный потенциал': ['Кредитный потенциал', 'Кредитный потенциал (СХ)'], 'Переводы по РФ': ['Межбанковский перевод', 'Перевод по СБП', 'Переводы', 'Переводы по СберХаб', 'Переводы ТГП'],
  'Наследство': ['Наследство'], 'НСЖ': ['НСЖ', 'НСЖ (накопительное страхование жизни)'], 'Конверсия': ['Обмен безналичной валюты', 'Обмен наличной валюты без идентификации'], 'Образовательный кредит': ['Образовательный кредит'],
  'ОМС': ['ОМС (Обезличенный металлический счёт)'], 'ОПИФ': ['ОПИФ (Открытый паевой инвестиционный фонд)'], 'Сценарии оплаты': ['Оплата картой на терминале'], 'SberPay NFC': ['Оплата телефоном SberPay NFC', 'SberPay NFC'],
  'BNPL': ['Оплата частями (BNPL)'], 'Пенсионный продукт': ['Пенсия', 'Перевод пенсии в Сбер'], 'Телеком (Оплата сотовой связи) и сканер QR': ['Платеж за Телеком'], 'Переводы подарков': ['Подарок в переводах'],
  'Чат': ['Поддержка в чате'], 'СберПрайм': ['Подписка Прайм'], 'Пакет услуг СберПремьер': ['Премиальный пакет'], 'СберСпасибо': ['Программа лояльности (бонусы "Спасибо")'],
  'Пакет услуг СберПервый': ['ПУ Сбер Первый'], 'Самозанятые. Списочная регистрация': ['Самозанятость (Своё дело)'], 'СберИнвестор': ['Сбер Инвестиции (приложение)'],
  'СберЗдоровье': ['СберЗдоровье'], 'СберМобайл': ['СберМобайл'], 'СберKids': ['СберKids (приложение)'], 'Сейфы': ['Сейфы'], 'Страхование жизни': ['Страхование жизни'], 'Оплата улыбкой': ['SberPay Улыбка'],
  SberID: ['Детский Сбер ID', 'Сбер ID'],
};

export function App() {
  const [data, setData] = useState(null);
  const [cjxplorer, setCjxplorer] = useState(null);
  const [cjxplorerCreditCard, setCjxplorerCreditCard] = useState(null);
  const [cjxplorerDetails, setCjxplorerDetails] = useState(null);
  const [backlog, setBacklog] = useState({status: 'loading', data: null});
  const [maturity, setMaturity] = useState(null);
  const [view, setView] = useState('dashboard');
  const [selected, setSelected] = useState(null);
  const [htmlPageContext, setHtmlPageContext] = useState({});
  const [backlogTeamKey, setBacklogTeamKey] = useState('');
  const [detailScore, setDetailScore] = useState(false);
  const [compact, setCompact] = useState(true);
  const [aboutSection, setAboutSection] = useState('');
  const [summaryFilters, setSummaryFilters] = useState({period: 'III кв. 2026', unit: ''});
  const [standAccessHref, setStandAccessHref] = useState('');
  useEffect(() => attachStandAccessInterceptor(
    typeof document === 'undefined' ? null : document,
    setStandAccessHref,
  ), []);
  const updateSummaryFilters = useCallback((patch) => {
    setSummaryFilters((current) => ({...current, ...patch}));
  }, []);
  useEffect(() => {
    fetch('./report-data.json', {cache: 'no-store'})
      .then((response) => response.json())
      .then(setData);
  }, []);
  useEffect(() => { fetch('./data-maturity.json', {cache: 'no-store'}).then((response) => response.ok ? response.json() : null).then(setMaturity).catch(() => setMaturity(null)); }, []);
  useEffect(() => { fetch('./cjxplorer-summary.json', {cache: 'no-store'}).then((response) => response.ok ? response.json() : null).then(setCjxplorer).catch(() => setCjxplorer(null)); }, []);
  useEffect(() => { fetch('./cjxplorer-credit-card.json', {cache: 'no-store'}).then((response) => response.ok ? response.json() : null).then(setCjxplorerCreditCard).catch(() => setCjxplorerCreditCard(null)); }, []);
  useEffect(() => { fetch('./cjxplorer-product-details.json', {cache: 'no-store'}).then((response) => response.ok ? response.json() : null).then(setCjxplorerDetails).catch(() => setCjxplorerDetails(null)); }, []);
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
  const profileProducts = useMemo(() => buildDdiPeriodProducts(data?.products || [], summaryFilters.period, Q3_OVERLAYS, salaryProductsQ32026, reportingMissingQ32026, funnelActionMissingQ32026), [data, summaryFilters.period]);
  const teamSelection = {...resolveTeamProfileSelection(profileProducts, {...summaryFilters, selected}), periods: getReportPeriods(data?.products || [])};
  useEffect(() => {
    if (!data || view !== 'detail') return;
    if (teamSelection.unit !== summaryFilters.unit) updateSummaryFilters({unit: teamSelection.unit});
    if (teamSelection.product !== selected) setSelected(teamSelection.product);
  }, [data, view, selected, summaryFilters.unit, teamSelection.unit, teamSelection.product, updateSummaryFilters]);
  if (!data) return <div className="loading"><Spin size="xl" /></div>;
  const rows = data.title?.rows || [];
  const summaryData = buildSummaryPeriodData(data.products, rows, profileProducts, teamSelection.period);
  const profileRows = filterTitleRowsByPeriod(rows, data.products, teamSelection.period);
  const product = teamSelection.product;
  const cjxplorerNames = product?.isPlaceholder ? [] : CJXPLORER_PRODUCT_ALIASES[product?.name] || [];
  const cjxplorerSummaryProduct = cjxplorerNames.map((name) => cjxplorer?.products?.find((item) => String(item.name || '').trim().toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))).find(Boolean) || null;
  const cjxplorerDetail = cjxplorerDetails?.products?.find((item) => item.id === cjxplorerSummaryProduct?.id)
    || (cjxplorerCreditCard?.product?.id && cjxplorerCreditCard.product.id === cjxplorerSummaryProduct?.id ? cjxplorerCreditCard.product : null);
  const cjxplorerProduct = cjxplorerSummaryProduct
    ? {...cjxplorerSummaryProduct, ...(cjxplorerDetail || {})}
    : null;
  const openProduct = (item) => {
    updateSummaryFilters({unit: item.unit && isUnitFilterOption(item.unit) ? item.unit : ''});
    updateSummaryFilters({period: item.period || ''});
    setSelected(item);
    setView('detail');
    window.scrollTo(0, 0);
  };
  const openHtmlPageTool = (toolId, context = {}) => {
    setHtmlPageContext({...context, product: product?.name || ''});
    setView(`html-page:${toolId}`);
    window.scrollTo(0, 0);
  };
  const openAbout = (section = '') => {
    setAboutSection(section);
    setView('about');
    if (!section) window.scrollTo(0, 0);
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
  const productBacklogTeam = backlogTeams.find((team) => backlogTeamMatchesProduct(team, product));
  const openBacklog = (teamKey = '') => {
    setBacklogTeamKey(String(teamKey || ''));
    setView('backlog');
    window.scrollTo(0, 0);
  };
  const openBacklogTeam = (teamDataset, member = null) => {
    const requestedTeam = member ? {memberTeams: [member]} : teamDataset;
    const target = findProductForBacklogTeam(requestedTeam, teamSelection.products, product)
      || findProductForBacklogTeam(requestedTeam, data.products, product);
    if (!target) return;
    updateSummaryFilters({period: target.period || '', unit: target.unit && isUnitFilterOption(target.unit) ? target.unit : ''});
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
      qa: 'dd-primary-navigation',
      current: view === 'dashboard',
      onItemClick: () => setView('dashboard'),
    },
    {
      id: 'detail',
      title: '\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043a\u043e\u043c\u0430\u043d\u0434\u044b',
      tooltipText: '\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043a\u043e\u043c\u0430\u043d\u0434\u044b',
      icon: BarsAscendingAlignLeft,
      qa: 'dd-primary-navigation',
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
      icon: CircleQuestion,
      qa: 'dd-primary-navigation',
      current: view === 'about',
      onItemClick: () => openAbout(),
    },
    {
      id: 'initiatives',
      title: 'Развитие инструмента',
      tooltipText: 'Развитие инструмента',
      icon: CircleTree,
      qa: 'dd-primary-navigation',
      current: view === 'initiatives',
      onItemClick: () => { setView('initiatives'); window.scrollTo(0, 0); },
    },
    {
      id: 'skills-divider',
      type: 'divider',
    },
    ...HTML_PAGE_TOOLS.map((tool) => ({
      id: `html-page:${tool.id}`,
      title: tool.title,
      tooltipText: tool.title,
      icon: htmlPageIcon(tool.icon),
      current: view === `html-page:${tool.id}`,
      onItemClick: () => openHtmlPageTool(tool.id),
    })),
    ...(BACKLOG_DECOMPOSITION_ENABLED ? [{
      id: 'backlog',
      title: 'Декомпозиция бэклога',
      tooltipText: 'Декомпозиция бэклога',
      icon: Ticket,
      current: view === 'backlog',
      onItemClick: () => openBacklog(),
    }] : []),
  ];
  const content = view === 'summary'
    ? <SummaryPage products={data.products} rows={rows} unitFilter={summaryFilters.unit} onUnitFilterChange={(unit) => updateSummaryFilters({unit})} />
    : activeHtmlPageTool
      ? <HtmlReportPage tool={activeHtmlPageTool} context={htmlPageContext} onStandAccessLink={setStandAccessHref} onBack={() => { setView('detail'); window.scrollTo(0, 0); }} />
      : view === 'dashboard'
        ? <DashboardPage products={summaryData.products} rows={summaryData.rows} maturity={maturity} summaryFilters={summaryFilters} onSummaryFiltersChange={updateSummaryFilters} onOpen={openProduct} onAbout={openAbout} onInitiatives={() => { setView('initiatives'); window.scrollTo(0, 0); }} />
        : view === 'about'
          ? <AboutPage initialSection={aboutSection} onBack={() => { setView('dashboard'); window.scrollTo(0, 0); }} />
          : view === 'initiatives'
            ? <InitiativesBacklogPage onBack={() => { setView('dashboard'); window.scrollTo(0, 0); }} />
          : view === 'backlog' && BACKLOG_DECOMPOSITION_ENABLED
            ? <BacklogDecompositionPage data={backlog.data} status={backlog.status} onOpenTeam={openBacklogTeam} initialTeamKey={backlogTeamKey} />
            : product
              ? <TeamProfilePage product={product} products={teamSelection.products} rows={profileRows} baselineRows={rows} baselineProducts={data.products} detailScore={detailScore} teamUnit={summaryFilters.unit} onTeamUnitChange={(unit) => updateSummaryFilters({unit})} periods={teamSelection.periods} period={teamSelection.period} onPeriodChange={(period) => updateSummaryFilters({period})} onBack={() => setView('dashboard')} onProduct={setSelected} onOpenHtmlPageTool={openHtmlPageTool} onAbout={() => openAbout()} onBacklog={BACKLOG_DECOMPOSITION_ENABLED && productBacklogTeam ? () => openBacklog(backlogTeamOptionValue(productBacklogTeam, product)) : undefined} cjxplorerProduct={cjxplorerProduct} />
              : <main className="content detail-page"><h1>Профиль команды</h1><label className="product-select"><span>Период</span><Select value={teamSelection.period ? [teamSelection.period] : []} onUpdate={(value) => updateSummaryFilters({period: value[0] || ''})}>{teamSelection.periods.map((period) => <Select.Option key={period} value={period}>{period}</Select.Option>)}</Select></label><p>Данные ещё не добавлены</p></main>;
  return (
    <>
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
    <StandAccessDialog href={standAccessHref} onClose={() => setStandAccessHref('')} />
    </>
  );
}
