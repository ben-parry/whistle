---
description: "Process feature updates into spec clarifications and updates"
user_invocable: true
---

# Update Spec

When the user provides a set of updates, changes, or feature ideas:

1. **Read the current state**: Read `SPEC.md` and any relevant source files referenced by the proposed changes. Understand what exists today.

2. **Ask clarifying questions**: For each proposed change, identify ambiguities, edge cases, and design decisions that need the user's input. Group questions by feature area. Be thorough — ask about:
   - Interactions between new features and existing ones
   - Visual/UI details (colors, sizes, positioning, responsive behavior)
   - Behavioral details (what happens on edge cases, error states, empty states)
   - Data/API implications
   - Anything that could be interpreted multiple ways

3. **Wait for answers**: Do not proceed until the user has answered the clarifying questions.

4. **Update SPEC.md**: Incorporate all confirmed changes into `SPEC.md`, maintaining the existing document structure and level of detail. Make sure:
   - New features are described with the same specificity as existing ones
   - Changed features have their old descriptions fully replaced (no "was X, now Y" — just describe the current intended state)
   - All sections affected by changes are updated consistently (e.g., if a color changes, update the Color Scheme section AND any feature descriptions that reference colors)
   - The spec reads as a single coherent document describing the target state, not a changelog

5. **Summarize**: Present a brief summary of what was added/changed in the spec so the user can verify.
