import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const workspaceDir='/Users/roman/Documents/Codex/DD-dev';
const skillDir='/Users/roman/.codex/plugins/cache/openai-primary-runtime/presentations/26.1026.10807/skills/presentations';
const buildDir=workspaceDir+'/outputs/ddi-meetup-q3-2026/.build-v8';
const candidatePath=buildDir+'/candidate.pptx';
const finalPath=workspaceDir+'/outputs/ddi-meetup-q3-2026/final/DDI_митап_сравнение_II_III_кварталы_2026_v8.pptx';
const templatePath='/tmp/meetup_2026-07-12.pptx';
const referenceHash='b912a03ac5799b97b1e237662796beda2a0c0d5452a58eec97e82de1af870f63';
const FONT='SB Sans Display',FONT_BOLD='SB Sans Display Semibold',slideSizeEmu='12192000,6858000';
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, 'container_tools/artifact_tool_utils.mjs')).href);
const runtimePython = '/usr/bin/python3';
const result = await finalizePresentation({
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', slideSizeEmu, '--validate-bullet-geometry', '--validate-heading-fit'],
  requiredNativeChartOwnerSlides: [],
  explicitTotalSlideCount: 7,
  sourceTemplatePath: templatePath,
  requiredTemplateReferenceSlides: [1, 8],
  minimumTemplateCoverageRatio: 0.15,
  fontPolicy: { basis: 'reference', families: [FONT, FONT_BOLD], referencePath: templatePath, referenceSha256: referenceHash },
  verifyArtifactToolImport: true,
  receiptPath: path.join(buildDir, 'validation-v8.json'),
});
console.log(JSON.stringify({ finalPath, result }, null, 2));
