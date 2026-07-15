import React from 'react';
import {Button} from '@gravity-ui/uikit';
import {BUTTON_INTENT, buttonPropsFor} from './buttonRoles.js';

export {BUTTON_INTENT} from './buttonRoles.js';

export function SemanticButton({intent, ...props}) {
  const semanticProps = buttonPropsFor(intent);
  return <Button {...props} {...semanticProps} />;
}
