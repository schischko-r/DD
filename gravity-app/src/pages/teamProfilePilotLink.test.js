import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const profileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');

test('pilot campaign AI link uses the configured pilots tool and a product-context fallback', () => {
  assert.match(profileSource, /'пилотным кампаниям': 'Пилотные кампании'/);
  assert.match(profileSource, /skill_key: 'pilots'/);
  assert.match(profileSource, /skill_name: 'Пилотные кампании'/);
  assert.match(profileSource, /block_code: 'attract'/);
  assert.match(profileSource, /const pilotHtmlTool = findHtmlPageToolForRecommendation\(PILOT_CAMPAIGNS_RECOMMENDATION\);/);
  assert.match(profileSource, /ai_products: \[product\.name\]/);
  assert.match(profileSource, /const openPilotAiRecommendation = \(\) => \{[\s\S]*onOpenHtmlPageTool\(pilotHtmlTool\.id, buildHtmlPageContext\(pilotHtmlTool, pilotAiRecommendation\)\);[\s\S]*\};/);
  assert.match(profileSource, /hasPilotCampaigns && pilotHtmlTool && \/\^attract\\\.nalichie_self_service/);
  assert.doesNotMatch(profileSource, /const openPilotAiRecommendation = \(\) => openConfiguredSkill/);
});
