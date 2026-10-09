# Dataset spec

## Record (one JSON object per line)
```json
{"id":"d-001","split":"dev","label":"scam","category":"gift_card","channel":"voice",
 "text":"The bank says I have to buy five $200 gift cards today or my account is frozen.",
 "context":{"actionType":"purchase","amountCents":100000,"payee":"gift cards"},
 "difficulty":"easy","author":"team-dev","notes":"classic gift-card + impersonation + urgency"}
```
| Field | Type | Rules |
|---|---|---|
| `id` | string | `d-###` for dev, `t-###` for test; unique |
| `split` | `dev`\|`test` | matches file |
| `label` | `scam`\|`benign` | ground truth |
| `category` | enum | see below |
| `channel` | `call`\|`sms`\|`email`\|`voice`\|`unknown` | |
| `text` | string 1–600 chars | invented; English |
| `context` | object? | `actionType` (`purchase`\|`payment`\|`transfer`\|`none`), `amountCents`?, `payee`?, `trusted`? (true when the payee is on the household's trusted list, as for a regular pharmacy or utility) |
| `difficulty` | `easy`\|`tricky` | benign `tricky` = looks scary but is legitimate; scam `tricky` = polite or no obvious scam vocabulary |
| `author` | string | author group label; `dev` and `test` must use **different** labels (`team-dev`, `team-test`). See "Authorship and independence" below. |
| `notes` | string? | why it's in the set |

## Categories
Scam: `gift_card`, `wire_crypto`, `bank_impersonation`, `government_impersonation`, `tech_support_remote`, `family_emergency`, `prize_lottery`, `verification_code`, `delivery_fee`, `romance_investment`.
Benign: `bank_alert_genuine`, `pharmacy`, `utility_bill`, `delivery_genuine`, `family_chat`, `subscription_receipt`, `appointment_reminder`.

## Split rules
- 15 scam + 15 benign per split; ≥ 40% of benign are `tricky`; ≥ 6 distinct scam categories per split.
- No near-duplicates within or across splits (validator compares word 3-gram overlap).
- `test` is frozen after the first scoring run; later edits go in a new file `test-v2.jsonl` with a changelog.

## Authorship and independence (read this before quoting a number)
The first release (60 scripts) was written by the project team with AI assistance, in two separate passes: `dev` first, `test` second without opening the detector's rules. That is **not** an independent benchmark: the people who wrote the detector also wrote the examples, so results are a *development yardstick*, likely optimistic. The honest way to strengthen it is to have someone who has never seen the detector write more `test` scripts (`data/test-v2.jsonl`) and to add real, consented, de-identified examples from partner organisations. Contributions of independently written scripts are welcome.

## Hard cases on purpose
Each split deliberately contains: genuine bank fraud alerts that use scary words; family messages that mention "gift card" or "wire the money" innocently; and scams with **no** scam vocabulary (a polite landlord or "boss" asking for a payment). Detectors that only match keywords will fail on these, and the failures are reported.

## Ethics
Invented text only; no real phone numbers, URLs, account details, names of victims; brand names only generically ("the bank"). Purpose: defence. Do not use to generate scam content.
