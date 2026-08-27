# Takt Calm UX Guidelines v1.0

Date: 2026-08-27
Purpose: Keep Takt in the calm, non-anxious medication-adherence category.

## A. Tone and microcopy standards
1. Use neutral action labels: "Due now", "Take scheduled", "Snooze".
2. Avoid fear language in routine flows: no "alert", "warning", "urgent", "failed" for normal dose states.
3. Reserve risk language for retrospective clinical reporting sections only.
4. Replace blame framing with task framing: "Dose still open" instead of "You missed".
5. Keep messages short and instructional in one sentence.
6. Keep button verbs consistent across routes.
7. Error copy must include a next action.
8. Empty states must explain what fills the state.

## B. Visual hierarchy standards
9. Primary accent color is amber only for current main action.
10. Green indicates confirmed taken state only.
11. Red is restricted to history/report missed entries, never live nagging.
12. Use gray for due/scheduled neutral states.
13. No flashing, pulsing, or countdown urgency patterns in routine reminders.
14. Keep strong contrast between heading and body text for scan speed.
15. Keep whitespace generous around dose cards and primary actions.
16. Do not stack more than two urgency badges in one row.

## C. Interaction standards
17. Minimum touch target: 44x44 points for all pressable controls.
18. Body text floor: 17 pt equivalent for key daily-use copy.
19. Dose confirmation animation must complete under 200ms and avoid bounce.
20. Undo affordance appears for 10 minutes with low-contrast secondary styling.
21. Progress visuals should communicate completion, not pressure.
22. Notifications should cap at one quiet follow-up per unresolved dose window.

## D. Accessibility standards
23. Meet WCAG AA contrast on text and interactive controls.
24. Never rely on color alone; pair with icon/text semantics.
25. Screen-reader labels must describe action + medication + time context.
26. Respect reduced-motion preference for all non-essential movement.

## E. Clinical trust standards
27. Keep adherence formula visible in report/help context.
28. Keep correction actions auditable with timestamp and reason.
29. Avoid speculative language in adherence summaries.
30. Distinguish clearly between "skipped" and "missed" in history.

## Current audit findings (initial)
- Core terminology is mostly calm.
- Missed-dose wording appears in history and report context, which is appropriate.
- Additional rewrite pass needed on any remaining "warning"-styled live badges that can be neutralized without safety loss.

## Next implementation pass
1. Microcopy rewrite diff for EN/DE locale bundles.
2. Badge tone pass on Today + History surfaces.
3. Accessibility verification pass (type size + contrast + non-color cues).
