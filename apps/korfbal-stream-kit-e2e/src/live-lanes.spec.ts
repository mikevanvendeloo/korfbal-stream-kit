import {expect, test} from './support/fixtures';
import {pageWidth, ShowCallerPhone} from './support/pages';

/**
 * Zaal and Stream as parallel lanes in the rust (openspec/changes/parallel-lanes), on a phone against the real
 * API: Volgend follows the stream, the hall lane starts by itself and moves on with Zaal ›, Volgend warns
 * when it ends a hall item at the samenkomstpunt, and a hall lane that is done shows its wait row.
 */
test.use({viewport: {width: 360, height: 780}, isMobile: true, hasTouch: true, deviceScaleFactor: 3});

const LONG = 600;

test('the rust with two lanes: the hall runs next to the stream', async ({page, makeShow}) => {
  const show = await makeShow({
    chapters: ['Rust', 'Tweede helft'],
    chapterMinimums: {Rust: 10 * 60},
    items: [
      {title: 'Speaker kondigt rust aan', durationSec: LONG, isInVenue: true, isInLivestream: true, chapter: 'Rust'},
      {title: 'Reclame LED', durationSec: LONG, isInVenue: true, isInLivestream: false},
      {title: 'Commentatoren', durationSec: LONG},
      {title: 'Statistieken', durationSec: LONG, isInVenue: true, isInLivestream: false},
      {title: 'Analyse eerste helft', durationSec: LONG},
      {title: 'Start tweede helft', durationSec: LONG, isInVenue: true, isInLivestream: true, isTimeAnchor: true, anchorType: 'MATCH_START', chapter: 'Tweede helft'},
    ],
  });
  const showCaller = new ShowCallerPhone(page);
  await showCaller.open(show.productionId);
  await showCaller.start();
  await showCaller.expectNow('Speaker kondigt rust aan');
  // Volgend follows the stream: the LED commercial is not a step of its own
  await expect(showCaller.next).toContainText('Commentatoren');

  await showCaller.nextItem();
  await showCaller.expectNow('Commentatoren');
  // The hall lane started by itself, with its own countdown
  await expect(showCaller.hall).toContainText('Reclame LED');
  await expect(showCaller.next).toContainText('Analyse eerste helft');
  expect(await pageWidth(page)).toBe(360);

  await showCaller.venueNext();
  await expect(showCaller.hall).toContainText('Statistieken');

  await showCaller.nextItem();
  await showCaller.expectNow('Analyse eerste helft');
  // The next step is the samenkomstpunt while the hall still runs
  await expect(showCaller.controls.getByRole('button', {name: 'Volgend item'})).toContainText(/Zaal nog \d+:\d\d bezig/);

  await showCaller.venueNext();
  await expect(showCaller.hall).toContainText('Zaal klaar · volgende: Start tweede helft');

  await showCaller.nextItem();
  await showCaller.expectNow('Start tweede helft');
  await expect(showCaller.hall).toHaveCount(0);
  expect(await pageWidth(page)).toBe(360);
});
