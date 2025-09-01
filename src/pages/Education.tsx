import React, { useMemo, useState } from 'react';
import overview from '../../docs/overview.md?raw';
import workflow from '../../docs/workflow.md?raw';
import commands from '../../docs/prisma-commands.md?raw';
import seeding from '../../docs/seeding.md?raw';

function mdToHtml(md: string) {
  // very small markdown converter for headers, lists, code fences
  const lines = md.split(/\r?\n/);
  let html = '';
  let inCode = false;
  for (let line of lines) {
    if (line.trim().startsWith('```')) {
      if (!inCode) { html += '<pre class="bg-black text-green-200 p-3 rounded text-xs overflow-auto">'; inCode = true; }
      else { html += '</pre>'; inCode = false; }
      continue;
    }
    if (inCode) { html += line.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\n'; continue; }
    if (/^#\s+/.test(line)) html += `<h1 class="text-xl font-semibold mt-4">${line.replace(/^#\s+/, '')}</h1>`;
    else if (/^%\s+/.test(line)) html += `<h1 class="text-xl font-semibold mt-4">${line.replace(/^%\s+/, '')}</h1>`;
    else if (/^\-\s+/.test(line)) html += `<li>${line.replace(/^\-\s+/, '')}</li>`;
    else if (/^\d+\)\s+/.test(line)) html += `<li>${line.replace(/^\d+\)\s+/, '')}</li>`;
    else if (line.trim() === '') html += '<br />';
    else html += `<p>${line}</p>`;
  }
  // Wrap loose li into ul
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul class="list-disc ml-6">$1</ul>');
  return html;
}

export default function Education() {
  const [tab, setTab] = useState<'overview' | 'workflow' | 'commands' | 'seeding'>('overview');
  const content = useMemo(() => ({ overview, workflow, commands, seeding }[tab]), [tab]);
  const html = useMemo(() => mdToHtml(content), [content]);
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Learn: Prisma + Supabase</h1>
      <div className="flex gap-2">
        {(['overview','workflow','commands','seeding'] as const).map((k) => (
          <button key={k} className={`px-3 py-1 rounded border ${tab===k?'bg-blue-600 text-white border-blue-600':'bg-white'}`} onClick={() => setTab(k)}>{k}</button>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-4 prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

