---
title: 'Claude Browser Accountant: counting what the browser can actually see'
description: 'Why I built a local Claude.ai extension for visible-text token estimates, API-equivalent cost and account-wide plan readings, with personal and work ledgers kept separate.'
date: 2026-11-15
kind: 'AI developer tools'
format: 'project-update'
draft: true
takeaways:
  - 'Put estimated input, output and API-equivalent cost beside a normal Claude web conversation.'
  - 'Keep organization identity separate from friendly labels and serialize writes across tabs.'
  - 'Treat rounded plan readings as account-wide observations, not precise per-prompt consumption.'
---

I wanted a small piece of information at the end of a normal Claude response: roughly how much text went in, how much came out, and what that workload would look like at published API prices. I also wanted a running total that could survive a refresh and keep my personal and work activity separate.

That became [Claude Browser Accountant](https://github.com/RaDeleon/Claude-Browser-Accountant), a local Manifest V3 extension for Claude.ai. It adds response footers, a running chat total and organization-level controls. It can also compare readings from Claude's official session and weekly usage page.

The difficult part was deciding what those numbers were allowed to mean.

## The problem

A rendered conversation is an incomplete view of an AI workload. It shows text, but it does not expose every system instruction, project file, tool result, cache hit or internal model request. A long chat can also contain history that is not currently rendered in the page.

The subscription meter answers a different question. It shows allowance over a time window, and the visible readings are rounded. Other tabs, Desktop or Code activity can change the same account's usage between two observations.

I wanted the interface to keep those definitions visible. A token estimate, an API-price calculation and an observed quota change each need their own label.

<figure class="article-figure">
  <img src="/images/writing/claude-browser-accountant-hero.svg" alt="Claude Browser Accountant product illustration with synthetic token estimates and an account-wide plan comparison." loading="lazy" />
  <figcaption>Product illustration with synthetic data. The footer distinguishes visible-text estimates from account-wide plan readings.</figcaption>
</figure>

## What changed

The extension observes new submissions and completed replies in an ordinary web chat. It estimates visible text size, looks up the selected model in a bundled rate table, and displays the result beneath the response. The chat toolbar adds a running total; the popup provides labels, pause/resume, plan checks and numeric export.

For storage, I used a background worker to validate scope and serialize writes. That matters when two tabs are working on the same conversation. Replaying an existing record should replace that record rather than create another charge. A retry is a different attempt and can add to the tracked total.

Personal and work separation uses the website's organization and chat identifiers. A friendly label is presentation. Renaming an organization to “Work” does not move its records into another ledger.

## A closer look at the code

The core's [text-size estimator](https://github.com/RaDeleon/Claude-Browser-Accountant/blob/main/extension/core.js) is deliberately small:

```js
function estimate(text) {
  return Math.ceil(new TextEncoder().encode(String(text || '')).length / 4);
}
```

That is a heuristic, not Claude's tokenizer. It is cheap, local and easy to inspect, but language, code and formatting affect its accuracy. The limitation belongs beside the result rather than hidden in a setup guide.

The [store](https://github.com/RaDeleon/Claude-Browser-Accountant/blob/main/extension/store.js) is the more important engineering boundary. It accepts whitelisted numeric and scope fields instead of storing the conversation body, and it rejects records that do not match the requested organization and chat.

## Reading the official usage page

For plan readings, an inactive helper tab opens the official Usage page under the existing browser login. A small probe reads the labeled session and all-model weekly meters, validates the active organization and returns only the readings and reset labels. The extension closes its own helper tab afterward.

The comparison has strict limits. A baseline must precede the submission and be recent enough. Missing, stale or late readings become unavailable. A decreased percentage or changed reset label is treated as a reset or changed limit. No negative consumption is invented.

A result such as “4% to 4%” means there was no visible change at that precision. It does not establish zero use. The [accounting notes](https://github.com/RaDeleon/Claude-Browser-Accountant/blob/main/docs/ACCOUNTING.md) explain that boundary.

## How I verified it

| Check | Observed result |
| --- | --- |
| Offline regression suite | 19 tests passed in the prepared public source. |
| Multi-tab storage and replay | Synthetic tests cover serialized writes, scope rejection and duplicate prevention. |
| Installed predecessor in Neo | Response footers, retry accumulation, popup controls and refresh/reopen persistence were exercised. |
| Official usage sampling | Session/weekly readings, no-visible-change output and helper closure were observed. |
| Remaining acceptance | Other browsers/locales, full restart, voice, edited/stopped prompts and export download checks remain open. |

The publication pass generalizes organization defaults and branding. It does not turn a narrow Neo test into a claim that every Claude surface is covered. Cowork-specific behavior and hidden model activity still need separate evidence.

## What comes next

The useful next work is compatibility and better characterization of the estimate, with test fixtures that make UI changes easier to spot. I also built a separate [macOS companion](/projects/claude-pocket-checker/) because much of my work happens in regular Desktop Chat.

Both projects grew from the same requirement: make the available evidence easier to see, while keeping the missing evidence explicit. The [project page](/projects/claude-browser-accountant/) covers the scope, and the [repository](https://github.com/RaDeleon/Claude-Browser-Accountant) contains setup, tests and limitations.
