# ehr-translator

A private, invite-only web app that helps patients and their families understand medical scan reports and doctor's notes.

## Problem

Reports from PET scans and other diagnostic imaging are often dense with clinical jargon and raw measurements that are difficult to interpret without a medical background. This is especially hard for people who aren't native English speakers, adding language barriers on top of already-technical content. General-purpose AI tools can help decode these documents, but their outputs aren't grounded in verifiable sources, which is risky for something this consequential.

## Solution

Upload a scan report or doctor's note (PDF), and view it side by side with:

- A plain-language summary and term-by-term annotations, written at a level anyone can understand.
- Citations to relevant PubMed research papers backing each annotation, so explanations are traceable rather than taken on faith.
- The ability to switch annotation language — initial support for English, Spanish, and Traditional Chinese.

Access is invite-only, and each user's uploaded documents are private to them.

**This tool does not provide medical advice.** It is strictly an aid for understanding the objective content of a document — always consult a qualified healthcare provider for interpretation and decisions about care.

## Status

Early planning / development. See the architecture plan for the current build roadmap.
