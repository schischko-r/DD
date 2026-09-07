import React from 'react';
import {Dialog, Text} from '@gravity-ui/uikit';
import {REPORT_ACCESS_REQUEST_URL} from '../catalog/Catalog.jsx';
import {BUTTON_INTENT, SemanticButton} from '../../shared/ui/SemanticButton.jsx';
import {
  STAND_ACCESS_ALLOW_ATTRIBUTE,
  STAND_ACCESS_CAPTION,
  STAND_ACCESS_INTRO,
  STAND_ACCESS_OUTRO,
  STAND_ACCESS_STEPS,
  STAND_ACCESS_TITLE,
} from './standAccessLinks.js';

export function StandAccessDialog({href, onClose}) {
  return (
    <Dialog open={Boolean(href)} onClose={onClose} hasCloseButton maxWidth="m" fullWidth>
      <Dialog.Header caption={STAND_ACCESS_CAPTION} />
      <Dialog.Body>
        <div className="report-access-content">
          <Text variant="subheader-1">{STAND_ACCESS_TITLE}</Text>
          <Text variant="body-2">{STAND_ACCESS_INTRO}</Text>
          <ul>{STAND_ACCESS_STEPS.map((step) => <li key={step}><Text variant="body-1">{step}</Text></li>)}</ul>
          <Text variant="body-2">{STAND_ACCESS_OUTRO}</Text>
          <div className="report-access-actions">
            <SemanticButton intent={BUTTON_INTENT.secondary} href={REPORT_ACCESS_REQUEST_URL} target="_blank">Завести заявку на доступ</SemanticButton>
            <SemanticButton intent={BUTTON_INTENT.primary} href={href || undefined} target="_blank" extraProps={{[STAND_ACCESS_ALLOW_ATTRIBUTE]: ''}}>Перейти</SemanticButton>
          </div>
        </div>
      </Dialog.Body>
    </Dialog>
  );
}
