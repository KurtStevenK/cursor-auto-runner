// Recomputes sha512 (base64) and size in an electron-builder update feed (latest.yml) for
// every referenced file that exists in the release directory. Needed after Windows code
// signing, which changes the installer bytes after electron-builder wrote the feed.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function describeFile(fullPath) {
  const data = fs.readFileSync(fullPath);
  return { sha512: crypto.createHash('sha512').update(data).digest('base64'), size: data.length };
}

// Feed urls use electron-builder's safe names (dashes); the file on disk may still use spaces.
function candidateNames(name) {
  return [...new Set([name, name.replace(/-/g, ' ')])];
}

// lookup(name) -> { sha512, size } | null. Pure: no file system access.
function refreshFeed(yamlText, lookup, onRefresh) {
  let current = null;
  let info = null;
  return yamlText
    .split('\n')
    .map((line) => {
      const ref = /^(\s*(?:-\s+)?(?:url|path):\s*)(['"]?)([^'"\r\n]*?)\2\s*$/.exec(
        line.replace(/\r$/, '')
      );
      if (ref) {
        current = ref[3];
        info = null;
        for (const candidate of candidateNames(current)) {
          info = lookup(candidate);
          if (info) break;
        }
        return line;
      }
      if (!info) return line;
      const hash = /^(\s*sha512:\s*)(['"]?)[^'"\r\n]*\2(\s*)$/.exec(line.replace(/\r$/, ''));
      if (hash) {
        if (onRefresh) onRefresh(current);
        return `${hash[1]}${hash[2]}${info.sha512}${hash[2]}${line.endsWith('\r') ? '\r' : ''}`;
      }
      const size = /^(\s*size:\s*)\d+(\s*)$/.exec(line.replace(/\r$/, ''));
      if (size) return `${size[1]}${info.size}${line.endsWith('\r') ? '\r' : ''}`;
      return line;
    })
    .join('\n');
}

function refreshFeedFile(feedPath, releaseDir) {
  const text = fs.readFileSync(feedPath, 'utf8');
  const out = refreshFeed(
    text,
    (name) => {
      const full = path.join(releaseDir, name);
      return fs.existsSync(full) && fs.statSync(full).isFile() ? describeFile(full) : null;
    },
    (name) => console.log(`${path.basename(feedPath)}: refreshed ${name}`)
  );
  if (out !== text) fs.writeFileSync(feedPath, out);
  else console.log(`${path.basename(feedPath)}: already up to date`);
  return out !== text;
}

function main() {
  const releaseDir = path.join(__dirname, '..', 'release');
  const feed = path.join(releaseDir, 'latest.yml');
  if (!fs.existsSync(feed)) {
    console.error('release/latest.yml not found');
    process.exit(1);
  }
  refreshFeedFile(feed, releaseDir);
}

module.exports = { refreshFeed, refreshFeedFile, describeFile };

if (require.main === module) main();
