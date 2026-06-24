import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { promoteGeneratedFeed } from './promote-claude-feed.mjs';

test('merges generated episodes without deleting existing stable episodes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'randomcast-feed-'));
  const stableDir = path.join(root, 'stable');
  const generatedDir = path.join(root, 'generated');

  try {
    await writeFeed(stableDir, [
      episodeEntry({
        id: '2026-06-25-evening',
        date: '2026-06-25',
        slot: 'evening',
        title: 'Existing evening',
      }),
    ]);
    await writeFeed(generatedDir, [
      episodeEntry({
        id: '2026-06-26-morning',
        date: '2026-06-26',
        slot: 'morning',
        title: 'Generated morning',
      }),
    ]);

    await promoteGeneratedFeed({
      generatedDir,
      stableDir,
      updatedAt: '2026-06-25T00:00:00.000Z',
    });

    const index = JSON.parse(await readFile(path.join(stableDir, 'index.json'), 'utf8'));
    assert.deepEqual(
      index.episodes.map((episode) => episode.id),
      ['2026-06-26-morning', '2026-06-25-evening'],
    );
    assert.equal(index.updatedAt, '2026-06-25T00:00:00.000Z');

    const existingEpisode = JSON.parse(
      await readFile(path.join(stableDir, 'episodes/2026-06-25-evening.json'), 'utf8'),
    );
    const generatedEpisode = JSON.parse(
      await readFile(path.join(stableDir, 'episodes/2026-06-26-morning.json'), 'utf8'),
    );
    assert.equal(existingEpisode.title, 'Existing evening');
    assert.equal(generatedEpisode.title, 'Generated morning');
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

async function writeFeed(feedDir, episodes) {
  await mkdir(path.join(feedDir, 'episodes'), { recursive: true });
  await writeFile(
    path.join(feedDir, 'index.json'),
    `${JSON.stringify({ version: 1, updatedAt: '2026-06-24T00:00:00.000Z', episodes }, null, 2)}\n`,
  );

  await Promise.all(
    episodes.map((episode) =>
      writeFile(
        path.join(feedDir, `episodes/${episode.id}.json`),
        `${JSON.stringify(
          {
            id: episode.id,
            listenDate: episode.date,
            slot: episode.slot,
            title: episode.title,
            topic: episode.topic,
            category: episode.category,
            format: 'two-host',
            summary: episode.summary,
            sources: [],
            segments: [],
          },
          null,
          2,
        )}\n`,
      ),
    ),
  );
}

function episodeEntry({ id, date, slot, title }) {
  return {
    id,
    date,
    slot,
    title,
    topic: `${title} topic`,
    category: 'test',
    summary: `${title} summary`,
    estimatedSeconds: 2400,
    url: `episodes/${id}.json`,
  };
}
