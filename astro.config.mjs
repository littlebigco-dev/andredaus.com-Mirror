// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

import remarkDirective from 'remark-directive';
import { visit }       from 'unist-util-visit';
 
function remarkNoteBox() {
  return (tree) => {
    visit(tree, 'containerDirective', (node) => {
      if (node.name !== 'note') return;
 
      const { label = '', heading = '' } = node.attributes ?? {};
 
      node.data = node.data ?? {};
      node.data.hName       = 'div';
      node.data.hProperties = { class: 'note-box', role: 'note' };
 
      const prepend = [];
      if (label)   prepend.push({ type: 'html', value: `<p class="note-box__label">${label}</p>` });
      if (heading) prepend.push({ type: 'html', value: `<p class="note-box__heading">${heading}</p>` });
 
      node.children = [
        ...prepend,
        {
          type:       'containerDirective',
          name:       '_body',
          data:       { hName: 'div', hProperties: { class: 'note-box__body' } },
          children:   node.children,
          attributes: {},
        },
      ];
    });
  };
}



// https://astro.build/config
export default defineConfig({
  markdown: {
    remarkPlugins: [
      remarkDirective,
      remarkNoteBox,
    ],
  },
  site: 'https://andredaus.com',
  output: 'static',
  adapter: cloudflare(),

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'de'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
