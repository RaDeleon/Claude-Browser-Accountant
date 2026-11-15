# Preview release workflow

This repository starts with a review branch. Merge the reviewed PR and confirm CI before publishing the prepared draft release.

## Prepare

1. Review source, tests, privacy fields, permissions and bundled rate date.
2. Run `node --test tests/*.test.cjs` and `python3 script/package.py`.
3. For a source archive, run `python3 script/source_archive.py` from a clean checkout after committing. It uses an explicit allowlist.
4. Review `dist/SHA256SUMS*.txt` and the archive member list. Private devlogs, environments, browser/runtime data and build directories must not appear.

## Draft and publish

- Tag/version: `v1.1.1`. A draft release can target the review-branch commit. After merge, confirm the intended source commit before publishing.
- Upload the unpacked-extension ZIP and checksums as **release assets**.
- Mark the release a **prerelease**. Review the release notes and limitations, then publish it yourself.
- Drafts and their assets are not public downloads. The README Download button opens Releases; until a preview is published it does not promise a binary installer.

## Download badge

`https://img.shields.io/github/downloads/RaDeleon/Claude-Browser-Accountant/total` reads GitHub's release-asset download counts. It counts uploaded assets (including a source ZIP uploaded as an asset), not Git clones, automatic source-archive links, page views, unique users or installations. Checksum downloads can also contribute to total asset downloads. For a product-ZIP-only badge, use Shields' per-asset endpoint after publishing the chosen asset name. No tracking endpoint or telemetry is added to the application.

## Distribution boundary

The extension is unpacked source, not a verified Chrome Web Store listing. Review browser-specific installation and account isolation manually.
