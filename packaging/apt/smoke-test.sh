#!/usr/bin/env bash
# Run inside Linux (e.g. docker run -v $PWD:/work -w /work ubuntu:24.04 bash packaging/apt/smoke-test.sh)
set -euo pipefail

apt-get update -qq
apt-get install -y -qq dpkg-dev apt-utils gnupg gzip

mkdir -p /tmp/fake/DEBIAN
printf 'Package: cursor-auto-runner\nVersion: 0.0.1\nArchitecture: amd64\nMaintainer: test\nDescription: test\n' > /tmp/fake/DEBIAN/control
dpkg-deb -b /tmp/fake /tmp/test.deb

export GNUPGHOME=/tmp/gnupg
mkdir -p "$GNUPGHOME"
chmod 700 "$GNUPGHOME"
gpg --batch --passphrase '' --quick-generate-key 'Cursor Auto Runner APT Test <test@example.com>' rsa4096
KEY="$(gpg --list-secret-keys --with-colons | awk -F: '$1=="sec"{print $5; exit}')"
export APT_GPG_PRIVATE_KEY
APT_GPG_PRIVATE_KEY="$(gpg --batch --yes --export-secret-keys --armor "$KEY")"

rm -rf /tmp/aptrepo
mkdir /tmp/aptrepo
bash packaging/apt/publish.sh /tmp/aptrepo /tmp/test.deb

test -f /tmp/aptrepo/dists/stable/InRelease
test -f /tmp/aptrepo/gpg.key
test -f /tmp/aptrepo/.nojekyll
echo "smoke-test OK"
