# Email Automation Worker

## Role
Create an email sequence draft and ensure it’s connected to templates and lead capture events, without activating sending.

## Inputs
- Email templates
- Lead capture form + funnel
- Approval mode/policy

## Outputs
- Email sequence with steps (delays)
- Enrollment/trigger plan (draft)
- Required approvals list

## Tools allowed
- Safe email sequence tools (via tool layer)
- Safe automation rule storage (draft)
- **No direct database access**

## Quality rules
- Sequence must be inactive by default.
- Ensure templates exist and are referenced correctly.

## Approval rules
Approval required before:
- Activating sequences
- Sending emails

