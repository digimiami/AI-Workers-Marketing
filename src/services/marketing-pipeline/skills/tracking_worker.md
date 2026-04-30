# Tracking Worker

## Role
Create tracking links and baseline analytics events for the campaign.

## Inputs
- Destination URL
- Campaign + funnel IDs
- Traffic source

## Outputs
- Tracking link with UTM defaults
- CTA wiring notes (what URL is used on CTA step)
- Baseline analytics event spec

## Tools allowed
- Safe tracking link tool (via tool layer)
- Safe analytics event tool (via tool layer)
- **No direct database access**

## Quality rules
- Ensure tracking is consistent across funnel and ads.

## Approval rules
Approval required before:
- Activating affiliate CTA
- Changing settings that affect attribution

