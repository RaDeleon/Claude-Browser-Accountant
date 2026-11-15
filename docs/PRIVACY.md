# Privacy and access

This experimental tool processes conversation text locally to estimate visible text size. It does not save chat bodies, credentials, attachment contents or raw drafts, and sends no usage report to a separate service.

The extension stores numeric usage, opaque organization/chat/turn IDs, model/time/rate metadata, quota percentages and reset labels, plus local labels and control settings in `chrome.storage.local`. It is not encrypted by the extension. Content scripts receive only validated runtime-message responses; background writes are serialized and field-whitelisted. Browser profiles have independent storage. Export creates a local copy you should review before sharing.

The only general permission is `storage`; site access is `https://claude.ai/*`. Official inactive Usage tabs make normal authenticated Claude requests. Extension code contains no direct network calls, private-API calls, remote code, telemetry or login flow.

“Local” does not mean anonymous: identifiers, timestamps and your labels can still be sensitive. Do not upload ledgers or exports in public issues. Removing an app/extension and removing its data are separate operations; follow the README. There is no central deletion endpoint because the project operates no telemetry service.
