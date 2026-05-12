import { describe, expect, it } from 'vitest';
import { renderEditedResumeHtml } from '../../src/lib/ai/render-edited-resume-html.js';

describe('renderEditedResumeHtml', () => {
  it('renders manual edits exactly without asking AI to interpret them', () => {
    const html = renderEditedResumeHtml({
      jobTitle: 'Senior Product Manager',
      resume: {
        name: 'Garvita Chhabra',
        contact: {
          email: 'garvita@example.com',
          phone: '+971 95 186 33424',
          location: 'Dubai',
        },
        summary: 'Product Manager with hand-written summary.',
        experience: [
          {
            title: 'Product Manager',
            company: 'Ceqquens',
            location: 'Dubai',
            start_date: '2023-05',
            end_date: null,
            bullets: [
              { text: 'Built Power BI dashboards tracking AARRR KPIs.' },
              { text: 'Hilinili' },
            ],
          },
          {
            title: 'New role',
            company: 'Empty',
            location: 'Empty',
            bullets: [],
          },
        ],
        education: [{ institution: 'Thapar Institute', degree: 'B.Tech' }],
        skills: ['Figma', 'Jira'],
      },
    });

    expect(html).toContain('Hilinili');
    expect(html).toContain('Empty');
    expect(html).toContain('New role');
    expect(html).toContain('Product Manager with hand-written summary.');
    expect(html).not.toContain('renderTailoredHtml');
  });

  it('escapes user text so manual edits cannot break the generated document', () => {
    const html = renderEditedResumeHtml({
      resume: {
        name: '<Garvita>',
        experience: [{ company: 'A&B', bullets: ['5 > 3 and 2 < 4'] }],
      },
    });

    expect(html).toContain('&lt;Garvita&gt;');
    expect(html).toContain('A&amp;B');
    expect(html).toContain('5 &gt; 3 and 2 &lt; 4');
  });
});
