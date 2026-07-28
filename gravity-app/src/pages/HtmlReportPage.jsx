import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {ArrowLeft} from '@gravity-ui/icons';
import {Icon} from '@gravity-ui/uikit';
import {applyHtmlPageBridge} from '../features/html-pages/htmlPageBridge.js';
import {buildHtmlPageUrl} from '../features/html-pages/htmlPageTools.js';
import {BUTTON_INTENT, SemanticButton} from '../shared/ui/SemanticButton.jsx';

export function HtmlReportPage({tool, context, onBack}) {
  const frameRef = useRef(null);
  const pageUrl = useMemo(() => buildHtmlPageUrl(tool, context), [context, tool]);
  const configureReport = useCallback(() => {
    applyHtmlPageBridge(
      frameRef.current?.contentDocument,
      tool.bridge,
      context,
    );
  }, [context, tool]);

  useEffect(configureReport, [configureReport]);

  return (
    <main className="html-report-page">
      <iframe
        ref={frameRef}
        className="html-report-frame"
        title={tool.iframeTitle || tool.title}
        src={pageUrl}
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
