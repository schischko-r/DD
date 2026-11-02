import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';
const kind=process.env.DDI_SURVEY_KIND==='segments'?'segments':'channels';
export default defineConfig({publicDir:false,plugins:[react(),viteSingleFile()],build:{outDir:`dist-other-surveys/${kind}`,emptyOutDir:true,assetsInlineLimit:Number.POSITIVE_INFINITY,target:'es2020',rollupOptions:{input:resolve(import.meta.dirname,`${kind}-survey.html`)}}});
