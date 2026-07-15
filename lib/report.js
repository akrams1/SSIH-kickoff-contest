// Builds a pdfmake document definition for the event report.
// Pure data in -> doc definition out, so it can be tested without a browser.
//
// Font is Times — one of the PDF standard-14 faces, so it renders as Times New
// Roman in every reader WITHOUT embedding a font file. That also means we never
// load pdfmake's 850KB vfs_fonts bundle. Standard fonts have no emoji glyphs,
// so never put emoji in here; rankings use plain words.

const INK = '#1a1a1a';
const MUTED = '#555555';
const RULE = '#999999';
const WINNER_BG = '#e6f2dd';

const clean = (s) => (typeof s === 'string' ? s.trim() : '');

const paragraphs = (text) =>
  clean(text).split(/\n\s*\n/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);

const lines = (text) =>
  clean(text).split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);

const prose = (text, style = 'body') => paragraphs(text).map((p) => ({ text: p, style }));

const sectionHeading = (n, title) => ({ text: `${n}. ${title}`, style: 'h2', margin: [0, 12, 0, 5] });

export function rankLabel(index) {
  if (index === 0) return 'Winner';
  if (index === 1) return '2nd winner';
  if (index === 2) return '3rd winner';
  return '';
}

// Plain boxed table: hairline rules, no colour fills.
const boxed = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => RULE,
  vLineColor: () => RULE,
  paddingTop: () => 3,
  paddingBottom: () => 3,
  paddingLeft: () => 4,
  paddingRight: () => 4,
};

const th = (text, extra = {}) => ({
  text,
  bold: true,
  alignment: 'center',
  color: INK,
  fontSize: 9,
  ...extra,
});

export function buildReportDoc(data) {
  const {
    preparedBy = '', reportTitle = '', eventName = '', date = '', time = '',
    location = '', attendeesNote = '', introduction = '', objectives = '',
    execution = '', votingSystem = '', votingPoints = '', challenges = [],
    contestants = [], residents = [], visitors = [], qrDataUrl = null, photos = [],
  } = data;

  const content = [];
  content.push({ text: clean(reportTitle) || 'Event Report', style: 'h1' });

  // Cover info — sized to its content, not stretched across the page.
  const info = [
    ['Event', clean(eventName)], ['Date', clean(date)], ['Time', clean(time)],
    ['Location', clean(location)], ['Attendees', clean(attendeesNote)],
  ].filter((r) => r[1]);

  if (info.length) {
    content.push({
      columns: [
        {
          width: 'auto',
          style: 'small',
          table: {
            widths: ['auto', 'auto'],
            body: info.map(([k, v]) => [
              { text: k, bold: true, color: INK },
              { text: v, color: MUTED },
            ]),
          },
          layout: boxed,
        },
        { width: '*', text: '' },
      ],
      margin: [0, 8, 0, 4],
    });
  }

  let n = 0;

  if (clean(introduction) || clean(objectives)) {
    content.push(sectionHeading(++n, 'Introduction & Objectives'));
    content.push(...prose(introduction));
    const objs = lines(objectives);
    if (objs.length) {
      content.push({ text: 'The primary objectives of the event were:', style: 'body', margin: [0, 3, 0, 3] });
      content.push({ ul: objs, style: 'body', margin: [6, 0, 0, 5] });
    }
  }

  if (clean(execution)) {
    content.push(sectionHeading(++n, 'Event Execution & Activities'));
    content.push(...prose(execution));
  }

  if (clean(votingSystem) || lines(votingPoints).length) {
    content.push(sectionHeading(++n, 'Costume Contest Voting System'));
    content.push(...prose(votingSystem));
    const pts = lines(votingPoints);
    if (pts.length) content.push({ ul: pts, style: 'body', margin: [6, 2, 0, 5] });
  }

  const chals = (challenges || []).filter((c) => clean(c.issue) || clean(c.resolution));
  if (chals.length) {
    content.push(sectionHeading(++n, 'Challenges & Resolutions'));
    chals.forEach((c, i) => {
      content.push({ text: `${i + 1}. ${clean(c.issue)}`, style: 'body', margin: [0, 3, 0, 2] });
      if (clean(c.resolution)) {
        content.push({
          text: [{ text: 'Resolution: ', bold: true }, { text: clean(c.resolution) }],
          style: 'body', margin: [12, 0, 0, 3],
        });
      }
    });
  }

  // ---- Voting list and attendance, side by side ----
  const sideBySide = [];

  if (contestants.length) {
    const total = contestants.reduce((s, c) => s + (c.votes || 0), 0);
    sideBySide.push({
      width: 'auto',
      stack: [
        { text: 'Voting List:', style: 'h3', margin: [0, 0, 0, 5] },
        {
          style: 'small',
          table: {
            headerRows: 1,
            widths: [104, 30, 62],
            body: [
              [th('Name'), th('Votes'), th('Ranking')],
              ...contestants.map((c, i) => {
                const win = i < 3;
                const fill = win ? WINNER_BG : null;
                return [
                  { text: clean(c.name), alignment: 'center', fillColor: fill, bold: win },
                  { text: String(c.votes ?? 0), alignment: 'center', fillColor: fill, bold: win },
                  { text: rankLabel(i), alignment: 'center', fillColor: fill, bold: win },
                ];
              }),
            ],
          },
          layout: boxed,
        },
        { text: `Total votes cast: ${total}`, style: 'caption', margin: [0, 4, 0, 0] },
      ],
    });
  }

  if (residents.length || visitors.length) {
    // Residents laid out 4 per row with Visitors as a fifth column — the same
    // shape as the original report.
    const COLS = 4;
    const rows = Math.max(Math.ceil(residents.length / COLS), visitors.length);
    const body = [[th('Residents', { colSpan: COLS }), {}, {}, {}, th('Visitors')]];
    for (let i = 0; i < rows; i++) {
      const slice = residents.slice(i * COLS, i * COLS + COLS).map((r) => clean(String(r)));
      while (slice.length < COLS) slice.push('');
      body.push([
        ...slice.map((t) => ({ text: t, alignment: 'center' })),
        { text: clean(String(visitors[i] || '')), alignment: 'center' },
      ]);
    }
    sideBySide.push({
      width: 'auto',
      stack: [
        { text: 'Complete attendance list:', style: 'h3', margin: [0, 0, 0, 5] },
        {
          style: 'small',
          table: { headerRows: 1, widths: [34, 34, 34, 34, 54], body },
          layout: boxed,
        },
        {
          text: `${residents.length} residents · ${visitors.length} visitors · ${residents.length + visitors.length} total`,
          style: 'caption', margin: [0, 4, 0, 0],
        },
      ],
    });
  }

  if (sideBySide.length) {
    content.push({ columns: sideBySide, columnGap: 26, margin: [0, 16, 0, 0], pageBreak: 'before' });
  }

  if (qrDataUrl) {
    content.push({ text: 'The voting page QR code:', style: 'h3', margin: [0, 18, 0, 6] });
    content.push({ image: qrDataUrl, width: 130 });
  }

  const pics = (photos || []).filter(Boolean);
  if (pics.length) {
    content.push({ text: 'Event photos:', style: 'h3', margin: [0, 16, 0, 8], pageBreak: 'before' });
    for (let i = 0; i < pics.length; i += 2) {
      content.push({
        columns: pics.slice(i, i + 2).map((p) => ({ image: p, fit: [248, 186] })),
        columnGap: 9, margin: [0, 0, 0, 9],
      });
    }
  }

  return {
    pageSize: 'A4',
    pageMargins: [45, 56, 45, 45],
    header: (currentPage) => ({
      columns: [
        { text: preparedBy ? `Prepared by: ${clean(preparedBy)}` : '', style: 'runningHead' },
        { text: String(currentPage), style: 'runningHead', alignment: 'right' },
      ],
      margin: [45, 24, 45, 0],
    }),
    content,
    defaultStyle: { font: 'Times', fontSize: 11, color: INK, lineHeight: 1.25 },
    styles: {
      h1: { fontSize: 18, bold: true, margin: [0, 0, 0, 2] },
      h2: { fontSize: 13, bold: true },
      h3: { fontSize: 11.5, bold: true },
      body: { fontSize: 11, margin: [0, 0, 0, 4], alignment: 'justify' },
      small: { fontSize: 9 },
      caption: { fontSize: 8, color: MUTED },
      runningHead: { fontSize: 9, color: MUTED },
    },
  };
}
