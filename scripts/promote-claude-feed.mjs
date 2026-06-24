import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function promoteGeneratedFeed({
  generatedDir,
  stableDir,
  updatedAt = new Date().toISOString(),
}) {
  const generatedIndex = await readJson(path.join(generatedDir, 'index.json'));
  const stableIndex = await readJson(path.join(stableDir, 'index.json'));
  const generatedEpisodes = readEpisodes(generatedIndex);
  const stableEpisodes = readEpisodes(stableIndex);

  await mkdir(path.join(stableDir, 'episodes'), { recursive: true });
  await Promise.all(
    generatedEpisodes.map((episode) =>
      cp(
        path.join(generatedDir, safeEpisodePath(episode.url)),
        path.join(stableDir, safeEpisodePath(episode.url)),
      ),
    ),
  );

  const episodesById = new Map(stableEpisodes.map((episode) => [episode.id, episode]));
  for (const episode of generatedEpisodes) {
    episodesById.set(episode.id, episode);
  }

  const promotedIndex = {
    version: stableIndex.version ?? generatedIndex.version ?? 1,
    updatedAt,
    episodes: Array.from(episodesById.values()).sort(compareEpisodes),
  };

  await writeFile(
    path.join(stableDir, 'index.json'),
    `${JSON.stringify(promotedIndex, null, 2)}\n`,
  );
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function readEpisodes(index) {
  if (!Array.isArray(index.episodes)) {
    throw new Error('Feed index must contain an episodes array');
  }

  return index.episodes;
}

function safeEpisodePath(episodeUrl) {
  if (!episodeUrl.startsWith('episodes/') || !episodeUrl.endsWith('.json')) {
    throw new Error(`Unsafe episode url: ${episodeUrl}`);
  }

  const normalized = path.posix.normalize(episodeUrl);
  if (normalized !== episodeUrl || normalized.startsWith('../')) {
    throw new Error(`Unsafe episode url: ${episodeUrl}`);
  }

  return normalized;
}

function compareEpisodes(left, right) {
  const dateCompare = right.date.localeCompare(left.date);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  const slotCompare = slotOrder(right.slot) - slotOrder(left.slot);
  if (slotCompare !== 0) {
    return slotCompare;
  }

  return right.id.localeCompare(left.id);
}

function slotOrder(slot) {
  if (slot === 'evening') {
    return 1;
  }
  if (slot === 'morning') {
    return 0;
  }
  return -1;
}

async function main() {
  const [, , generatedDir = 'generated', stableDir = 'stable'] = process.argv;
  await promoteGeneratedFeed({ generatedDir, stableDir });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
