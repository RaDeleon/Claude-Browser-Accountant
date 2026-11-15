# Claude Browser Accountant

A local Claude.ai extension for visible-text token estimates, API-equivalent prices and observed account-wide plan changes.

I built a Manifest V3 extension that observes rendered chats, serializes numeric records in local storage and reads the official Usage page through owned inactive tabs. Organization and chat IDs keep personal and work ledgers separate.

## Why I wanted the numbers beside the conversation

I wanted to see estimated input and output after a normal Claude web reply, keep a running chat total, and separate personal and work activity. I also wanted a useful view of session and weekly allowance without inventing a per-prompt quota formula.

That became a browser extension rather than a new chat client. It uses the existing signed-in website and adds its own labels and controls beside the conversation.

## A small extension with explicit storage boundaries

An isolated content script observes the rendered conversation. A bundled core estimates text size and applies model-specific API list prices. A background worker validates message senders and scope, whitelists stored fields, and serializes writes from multiple tabs.

Retry attempts retain their own records while a page reload restores existing totals. Organization IDs and chat IDs form the storage boundary; friendly labels do not change that identity.

## Reading plan limits without claiming prompt attribution

The extension opens a temporary inactive tab at the official Usage page and reads labeled session and all-model weekly meters. It validates the organization and closes only the helper tab it owns.

Freshness and reset checks decide whether a comparison is usable. Concurrent activity, reporting lag and whole-percent rounding mean the change is account-wide evidence, not exact consumption from one reply.

## A tested mechanism with a bounded scope

The prepared source passes 19 offline tests covering pricing arithmetic, replay, concurrency, organization isolation, privacy fields and quota edge cases. The predecessor installed build was live-tested in BrowserOS Neo for footers, retries, persistence, controls and official page sampling.

This is an experimental unpacked extension. Other browser/locale combinations, full browser restart, voice, edited/stopped requests and export downloads need acceptance checks. Hidden context and complete model usage remain unavailable.

## Questions

### Does it report exact tokens or my subscription bill?

No. It estimates visible text size and applies bundled standard API prices. It cannot measure hidden context, cache use or exact subscription consumption.

### Does it send conversations to an analytics service?

No. Text is processed transiently. Numeric and opaque scope records stay in local extension storage; official helper pages make normal Claude requests.

### Does the extension modify Claude Desktop?

No. It runs on Claude.ai in a Chromium browser. The separate Pocket Checker project covers regular Desktop Chat.
