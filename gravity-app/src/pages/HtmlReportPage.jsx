import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {ArrowLeft} from '@gravity-ui/icons';
import {Icon} from '@gravity-ui/uikit';
import {applyHtmlPageBridge} from '../features/html-pages/htmlPageBridge.js';
import {
  decodeHtmlPageContent,
  prepareHtmlPageSource,
} from '../features/html-pages/htmlPageContent.js';
import {buildHtmlPageUrl} from '../features/html-pages/htmlPageTools.js';
import {BUTTON_INTENT, SemanticButton} from '../shared/ui/SemanticButton.jsx';

export function HtmlReportPage({tool, context, onBack}) {
  const frameRef = useRef(null);
  const bridgeTimerRef = useRef(null);
  const pageUrl = useMemo(() => buildHtmlPageUrl(tool, context), [context, tool]);
  const pageSource = useMemo(() => prepareHtmlPageSource(
    decodeHtmlPageContent(tool.contentBase64),
    pageUrl,
  ), [pageUrl, tool.contentBase64]);
  const configureReport = useCallback(() => {
    window.clearTimeout(bridgeTimerRef.current);
    let attempt = 0;
    const applyBridge = () => {
      attempt += 1;
      let result = {ready: false, showTriggered: false};
      try {
        result = applyHtmlPageBridge(
          frameRef.current?.contentDocument,
          tool.bridge,
          context,
        );
      } catch {
        return;
      }
      if (!result.showTriggered && attempt < 60) {
        bridgeTimerRef.current = window.setTimeout(applyBridge, 100);
      }
    };
    applyBridge();
  }, [context, tool]);

  useEffect(() => {
    configureReport();
    return () => window.clearTimeout(bridgeTimerRef.current);
  }, [configureReport]);

  return (
    <main className="html-report-page">
      <iframe
        ref={frameRef}
        className="html-report-frame"
        title={tool.iframeTitle || tool.title}
        src={pageSource ? undefined : pageUrl}
        srcDoc={pageSource || undefined}
        onLoad={configureReport}
      />
      <div className="ai-return-action">
        <SemanticButton intent={BUTTON_INTENT.primary} onClick={onBack}>
          <Icon data={ArrowLeft} size={16} />
          Вернуться к DDI команды
        </SemanticButton>
      </div>
    </main>
  );
}
