import test from 'node:test';
import assert from 'node:assert/strict';
import {
  caskroomForBrew,
  compareVersions,
  firstExistingPath,
  isNewerVersion,
  parseVersion,
} from '../src/main/update-version';

test('release tags compare numerically and ignore a leading v', () => {
  assert.deepEqual(parseVersion('v1.2.56'), [1, 2, 56]);
  assert.equal(compareVersions('1.2.56', '1.2.57'), -1);
  assert.equal(compareVersions('v1.2.57', '1.2.57'), 0);
  assert.equal(compareVersions('1.3.0', '1.2.99'), 1);
  assert.equal(compareVersions('not-a-version', '1.2.56'), null);
  assert.equal(isNewerVersion('1.2.57', '1.2.56'), true);
  assert.equal(isNewerVersion('1.2.54', '1.2.56'), false);
});

test('Homebrew is found on the Apple Silicon or Intel prefix', () => {
  const exists = (file: string) => file === '/opt/homebrew/bin/brew';
  assert.equal(firstExistingPath(['/opt/homebrew/bin/brew', '/usr/local/bin/brew'], exists), '/opt/homebrew/bin/brew');
  assert.equal(caskroomForBrew('/opt/homebrew/bin/brew'), '/opt/homebrew/Caskroom/cursor-auto-runner');
  assert.equal(caskroomForBrew('/usr/local/bin/brew'), '/usr/local/Caskroom/cursor-auto-runner');
});
