# Elastic IP Classification

## Purpose
Classifies Elastic IP state and associated resource signal.

## Inputs
- Unstructured text blob (usage type, operation, line item description, etc.).

## Output
- `state`: `attached | unattached | unknown`
- `associatedResourceId`: matched resource id (`i-*`, `eni-*`, `nat-*`, `lb-*`) or `null`
- `signals`: single-element list with the same state

## Rules
- If associated resource ID regex matches, state is forced to `attached`.
- Attached markers: `inuseaddress`, `elasticip:inuseaddress`, `associateaddress`, `association`.
- Unattached markers: `idleaddress`, `elasticip:idleaddress`, `disassociateaddress`, `unassociated`, `disassociated`.
- If no marker matches, state is `unknown`.

## Priority / Order
1. Associated resource id match -> attached
2. Explicit attached/unattached markers
3. unknown

## Edge Cases
- No marker and no associated id no longer defaults to attached.
- Matching is case-insensitive.

## Example Inputs & Outputs
- Input: `"... eni-0123abcd ..."`
  Output: `state=attached`, `associatedResourceId=eni-0123abcd`, `signals=["attached"]`
- Input: `"ElasticIP:IdleAddress"`
  Output: `state=unattached`, `associatedResourceId=null`, `signals=["unattached"]`
- Input: `"misc eip record"`
  Output: `state=unknown`, `associatedResourceId=null`, `signals=["unknown"]`
