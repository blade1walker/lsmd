import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Creates (or updates, if it already exists) the "Emergency Medical Services
 * SOP (Standard Operating Protocol)" document in SopDocument from the
 * Nexus EMS SOP source PDF. Safe to re-run — it upserts by title rather than
 * blindly creating a duplicate every time.
 */

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env or export it, then re-run.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TITLE = "Emergency Medical Services SOP (Standard Operating Protocol)";

const CONTENT = String.raw`# NEXUS EMERGENCY MEDICAL SERVICES

## Standard Operating Procedures

*Nexus Universe Roleplay*
*Version 1.0 | Issued by EMS High Command*

> "Serve the public with respect, concern, courtesy and responsiveness, recognising that service to the public is beyond service to oneself."

> This document is an in-character roleplay guide for the Nexus Universe Roleplay server. Nothing in it is real medical advice or training, and none of it should ever be applied to a real-life situation. Do not share this document with anyone outside the Nexus medical departments.

## Contents

1. About This Document
2. Mission and Standards of Conduct
3. Employment and Duty Policy
4. Chain of Command
5. Shift Operations
6. Dispatch and Call Handling
7. Radio Procedure
8. Scene Safety and Scene Management
9. Patient Assessment
10. Triage
11. Field Treatment and Transport
12. Treatment Guides
13. Code Blue and Resuscitation
14. Medications and Scope of Practice
15. Equipment
16. Hospital Operations and Etiquette
17. Intensive Care Unit
18. Declaration of Death, DOA and Perma
19. Documentation and MDT Reporting
20. Patient Confidentiality and Records Release
21. Duty to Report
22. Custody, MRPD and Bolingbroke Operations
23. Fleet and Vehicle Policy
24. Air Rescue — Angel-1
25. Certifications and Specialty Units
26. Training Programme
27. Ride-Alongs and Volunteers
28. Uniform and Appearance
29. Discipline
30. Command and Chat Reference
Appendix A — Field Quick Reference
Appendix B — Document Control and Changelog

## 1. About This Document

### 1.1 Purpose

This document is the single source of truth for how Emergency Medical Services operates on Nexus Universe Roleplay. It covers everything a medic is expected to know and do: conduct, shift operations, dispatch, radio, scene safety, patient assessment, treatment, transport, hospital procedure, documentation, fleet, certifications, training and discipline.

Every medic is expected to have read this document in full before their first shift, and to re-read any section they are unsure about before acting on it.

### 1.2 Scope

These SOPs apply to all allowlisted EMS personnel of every rank, on duty and off. Where a section overlaps with the Department of Medicine (doctors) or with Police Department procedure, the joint procedure in this document is the one EMS follows.

Not every situation is a standard situation. Where a scenario genuinely falls outside these procedures, the highest ranking medic on duty may adjust procedure for that shift and should report the adjustment to Command afterwards.

### 1.3 Roleplay disclaimer

> Everything in this document exists to support medical roleplay. The medicine described here is simplified, dramatised and in places deliberately inaccurate. It is not a clinical reference, it is not training, and it must never be used to guide a real-life situation. If you are dealing with a real emergency, contact real emergency services.

### 1.4 Confidentiality

- This document is for Nexus medical personnel only. Do not share it, screenshot it, or paste sections of it outside the medical channels.
- Do not edit this document. Corrections, suggestions and disputes go to EMS Command through the correct channel.
- Loss of the EMS allowlist role for any reason ends your access to this document.

### 1.5 Amendments

- EMS Command may amend these SOPs at any time. Amendments are announced in the EMS documents channel and recorded in Appendix B.
- It is your responsibility to keep up with amendments. "I did not read the update" is not a defence.
- A rank structure, promotion criteria and callsign allocation are maintained in a separate companion document and are not reproduced here.

## 2. Mission and Standards of Conduct

### 2.1 Mission

> Serve the public with respect, concern, courtesy and responsiveness, recognising that service to the public is beyond service to oneself.

The medical allowlist is given to players who are trusted to enrich other people's stories as well as their own. Everyone holding it is held to a higher standard than the general playerbase.

### 2.2 Roleplay standards

Nexus is a content and story server first. Our goal is memorable, fun, engaging medical roleplay — not mechanical accuracy.

- **Roleplay over ruleplay.** Check your ego at the door. There is no single correct way to run a medical scene.
- **Always Be Talking (ABT).** Never stand over a body silently emoting. Talk to your patient, joke with them, get to know them. Verbal interaction is the job.
- **Do not lean on /me.** Emotes support speech, they do not replace it. Excessive /me where speaking aloud would be natural breaks immersion for everyone else on scene.
- **Bedside manner beats technical detail.** Nobody needs a textbook recital. A medic who makes an annoying downed-in-an-alley moment feel special is doing the job correctly.
- **Play a person.** Your medic should have a personality, problems and goals. If your story leads somewhere that gets your character fired or disgraced, that is good roleplay and you are welcome to build a new character.
- **Do not RP-check other players.** Let your peers run scenes their way. Most "you did that wrong" confrontations are OOC frustration wearing an IC mask.

### 2.3 Read the room

A good medical roleplayer reads the situation as a whole and pitches their scene at the level the moment can carry.

- A patient may have been on the ground for a long time before you arrived, or may have just come out of a bad interaction. Keeping the server moving matters more than getting the interaction you wanted.
- Never sacrifice server flow by forcing an interaction or holding someone in a state they cannot control.
- This cuts both ways. If one patient is monopolising you during a mass casualty, manage them and move on — everyone else on that scene deserves an experience too.
- When a player starts roleplaying a serious injury properly, respond in kind. Match their energy.

### 2.4 Powergaming

Medical roleplay is one of the most powergaming-sensitive roles on the server, because it involves acting on someone else's body. Player agency comes first, always.

- **Treat what you are told, not what you see.** When assessing a patient, you may notice injuries that differ from what the patient or Nancy describes. Base treatment only on what they communicate to you. Acting on injuries you can see but were not told about is powergaming.
- **The only exception** is an unresponsive patient where Nancy gives you nothing. In that case assume the best-case version of their injuries rather than inventing something dramatic.
- **Ask before you move someone.** If the patient can walk, ask them to walk to the back of the ambulance themselves, then say something like "I'm just going to help you up the step." If they need a backboard, you may lift and carry them.
- Never narrate another player's body for them. You do not decide that they scream, pass out, bleed out or feel pain.
- **Your GPS tracker cannot be removed in RP.** The only way it comes off is signing off duty. If someone wants to kidnap you, they have to get you to clock off first — you do not roleplay them cutting it out.

### 2.5 Toxicity

- Toxicity is not tolerated in any form. Conflict roleplay is welcome; toxic slandering of individuals or departments is not.
- Lighthearted rivalry or hazing between departments can be good content. When it crosses into genuine hostility it stops being content.
- Talking badly about EMS, PD or the doctors outside of private communication, and insubordination toward command, will be actioned.
- Disrespect or RP-checking directed at another player will result in removal from the department.

### 2.6 Professionalism

- EMS interacts with every group in the city — civilians, gangs, businesses, government. Maintain a working relationship and mutual respect with all of them.
- Impartiality is mandatory. We treat patients on the basis of their injuries, never their occupation, status, criminal record or history with us.
- Be professional on duty while still playing your character's quirks. Professionalism should shape your roleplay, not smother it.
- If a personal issue is affecting how you deal with patients or coworkers, go off duty or speak to Command until you can work comfortably again.
- Wear the correct uniform. It is how the city identifies us and it prevents avoidable escalations.
- Do not wear an EMS or doctor uniform while off duty.

### 2.7 Corruption

> Giving away or selling medical equipment, medication or government property is corruption. Corruption is not permitted, and any corruption storyline must be approved in advance by server staff.

- Medics may not sell or hand government equipment to non-government personnel. Doing so is grounds for immediate termination.
- Do not use your access as EMS to commit or assist crime — for example using the GPS or radio to move around undetected, or leaking PD or EMS communications, numbers or locations.
- Selling painkillers or other medical supplies is corruption, not a grey area.
- Do not abuse the game mechanics granted to medical staff.

### 2.8 Uncomfortable situations

If a player puts you in a situation you are not comfortable with — inappropriate, sexual, pregnancy roleplay or anything similar — you may hand the situation to another medic or to Nancy without explanation. Follow up with a report afterwards if you feel it is warranted.

## 3. Employment and Duty Policy

### 3.1 Employment basis

- All medical staff are at-will employees. Employment may be ended at any time, for any reason.
- EMS is an allowlisted job. Failing to uphold Nexus server rules or these SOPs may cost you the allowlist role as well as the job.
- If you leave the department for employment elsewhere you are not guaranteed rehire.
- If you resign on good terms, you may reapply.

### 3.2 Transfers and cross-training

Transfers and cross-training between government departments are not approved. This includes Police, EMS, the Department of Medicine and the DOJ.

- If you are EMS and wish to obtain a medical licence, you must go through the standard application process and relinquish your EMS role.
- A title held in one department or private practice does not carry over into another.

### 3.3 Conduct while on duty

- **No second job.** You may not work another job while clocked in as EMS.
- **Stay sober.** Do not be under the influence of alcohol or mind-altering drugs on duty.
- **No personal firearms.** Medics carry no personal firearm at any time on duty.
- **Armory discipline.** Department equipment stays with the department. Medics are not permitted to purchase or carry restricted items outside their scope.
- **Duty of care / duty to act.** While signed on you have an obligation to render reasonable care. If you come across an injured person, you treat them.
- **Chain of command applies.** The highest rank on duty has authority to issue orders on shift.
- **Breaks are fine.** Take short breaks in safe locations such as the hospital, and mark yourself 10-7 so dispatch knows.

### 3.4 Activity requirements

- A minimum of 8 hours of duty time per week is expected of all field personnel; 12 hours per week is the recommended target.
- Command personnel are held to a higher standard and are expected to log at least 14 hours per week.
- Failing the activity requirement will bring your position and rank up for discussion, and may result in your callsign being released.
- Trainees must complete a minimum of one shift per week and are expected to progress at a reasonable pace.

### 3.5 Leave of absence

- If you expect to be away longer than one week, request a Leave of Absence from Command and have it noted on the roster.
- An LOA longer than two weeks must be discussed with Command directly.
- An LOA beyond 14 days without contact, or beyond 30 days in total, ends your employment. You are free to reapply on your return.
- While on LOA you should be genuinely away. Do not come on duty in any capacity. You may cut an LOA short at any time by notifying Command.
- Command will accommodate reasonable requests around real-life circumstances. Talk to them.
- Trainees who are inactive for two weeks with no contact are removed from the roster and may reapply when they can commit to finishing training.

### 3.6 Inactivity and termination

- A medic who is not on LOA and does not come on duty for more than 14 days is marked inactive and given the chance to state whether they intend to continue.
- If they do not respond or choose not to return, a resignation is accepted on their behalf.
- If they wish to stay, they must complete a minimum of 12 hours on duty within the following 7 days. Failure to do so may lead to dismissal.
- Reinstated personnel return at their previous rank subject to a two-week probationary period.

### 3.7 Queue and priority policy

> EMS priority may not be used for any non-EMS activity or purpose under any circumstances. Abuse of it may result in removal from the community.

- The only exception is explicit approval from High Command for a specific event or activity. During that approved window you may use priority without remaining on EMS duty; once it ends, normal duty expectations resume.
- If you use a work ticket or priority slot to enter the city, you are expected to work as EMS for that entire session. Going off duty means leaving and returning normally.
- Trainees must have a training officer confirmed before using priority to come in for a shift.

## 4. Chain of Command

> The rank structure, rank prefixes, promotion criteria and callsign ranges are maintained in a separate companion document and are intentionally not reproduced here. This section covers how the chain of command is used, not who sits where in it.

**EMS Rank Hierarchy**

1. Medical Director
2. Deputy Medical Director
3. Chief of EMS
4. Assistant Chief
5. Division Chief
6. Captain
7. Lieutenant
8. Senior Paramedic
9. Paramedic
10. EMT
11. Probationary EMT / Trainee

### 4.1 Using the chain of command

- Take any communication, question or clarification to your immediate next step in the chain of command first.
- If that person is unavailable, consider whether it can wait. If it is urgent or extreme, move to the next available link in the chain.
- Skipping the chain without reason is a policy violation. The chain exists so everyone knows who is in charge and can be comfortable raising issues.
- The highest ranking medic on duty is the shift lead by default and holds authority for that shift. They may delegate that role.

### 4.2 Raising issues

- Any medic may raise an issue up the chain and recommend retraining where they think it is warranted.
- On-duty performance issues are handled by retraining first, discipline second.
- Disputes with the Department of Medicine or with individual doctors go to EMS Command, who will take them to the Board of Medicine if needed. Do not argue it out on scene.
- A formal suggestion file is maintained for procedural change and promotion matters. Use it.

### 4.3 Relationship with the Department of Medicine

EMS is its own government agency. Doctors hold no organisational authority over EMS and no privileged claim on hospital resources over EMS. Equally, EMS holds no authority over doctors.

- Doctors and medics work as peers. Toxicity or attempts by either side to assert authority over the other will be met with removal of position or licence.
- On clinical matters inside the hospital, defer to the treating doctor or to Nancy. That is deference to the treating clinician, not to rank.
- Any conflict is escalated to EMS Command and the medical board, not settled on scene.

### 4.4 Nancy

Nancy is our NPC doctor. She covers us when no player doctors are on duty and she is how we get information out of unconscious patients — injuries, emergency contacts, whether a patient needs ICU, cause of death.

- Nancy's decisions are final. If Nancy says a patient needs ICU, they go to ICU.
- You may make a suggestion or two, but you do not argue with Nancy.
- Only Nancy or a licensed doctor may declare a death or a cause of death. EMS never can.

## 5. Shift Operations

### 5.1 Signing on and off duty

- Clock on at Central Medical Centre using the duty terminal, and set up your unit in dispatch in the same pass.
- Announce yourself on the radio when you come on: 10-41 with your callsign. Announce 10-42 when you go off.
- Only use the direct duty-on command where you have been disconnected mid-shift. If you were treating a patient when you dropped and you are solo, ping the highest rank on duty so someone can take over that patient.
- Do not sign off mid-call. Finish or hand over the call first.

### 5.2 Shift hours

The department runs two nominal shifts. Medics in the matching time zone have priority for coming on duty during their shift, but nobody is prevented from working outside it.

| Shift | Hours (IST) | Notes |
| --- | --- | --- |
| Shift 1 | 08:30 — 20:30 | Day shift. Primary city coverage. |
| Shift 2 | 20:30 — 08:30 | Night shift. Expect heavier active-scene traffic. |

### 5.3 Callsigns and unit setup

- Set your callsign the moment you clock in, and convert your card in dispatch to reflect your unit number for the shift.
- You may take any free unit number or join an existing unit, provided calls stay covered.
- A callsign is one rank prefix plus a number — for example Echo-50, spoken in full on the radio and abbreviated to E-50 over text.
- If you pick up a ride-along or partner up, change your callsign to reflect it and notify other units.
- When you take out a specialty vehicle, dispatch the transition: "Echo-50 transitioning to Angel-1."

### 5.4 Unit count and shift lead

- The highest ranking medic on duty is designated shift lead. They handle radio coordination and set the dispatch rotation.
- If the number of medics waiting to come on exceeds the available slots, the shift lead may impose a three-hour-per-shift limit to rotate people through.
- If there are three or more ambulances active, at least one unit should be posted to the county to cover Sandy Shores and Paleto Bay, with a designated backup to rotate in when that unit transports.

### 5.5 Patrolling and staging

- The default state for an on-duty medic is actively patrolling in a vehicle. Drive around, be visible, talk to people.
- Do not group up and stage in one location for long periods. A hospital lobby full of idle medics is not content.
- Short breaks in safe locations are fine. Mark yourself 10-7.
- Staging in Paleto requires shift lead or command approval and at least two other full units on duty.

### 5.6 End of shift

- Repair your vehicle and refuel it to at least 75% before storing it. The fleet is shared and the next medic inherits whatever you leave.
- Return all department equipment. Medication carried in your kit is removed at the end of your shift.
- Finish any outstanding reports before you clock off. Do not leave paperwork for the next shift.
- Announce 10-42 so the shift lead can adjust the rotation.

## 6. Dispatch and Call Handling

### 6.1 Call priority

Where multiple calls are pending, work them in this order. If you are already on a call, finish it before rotating to a higher priority unless the shift lead reassigns you.

| Priority | Call | Meaning |
| --- | --- | --- |
| 1 | 14-A | Medic down — attempted murder. Active scene. |
| 2 | 14-B | Medic down — accidental. Scene likely safe. |
| 3 | 13-A | Officer down — attempted murder. Active scene. |
| 4 | 13-B | Officer down — accidental. Scene likely safe. |
| 5 | 911 / 311 | Emergency and non-emergency dispatch calls. |
| 6 | 10-47 | Injured person call. |

### 6.2 Rotation

- The shift lead sets the rotation and calls units to jobs. Rotate calls so no single unit is buried while others idle.
- Suggested standard order: training units first, then double units, then single units, then command units if available.
- Any unit may volunteer for an extra call. Say so on the radio rather than silently poaching.
- If multiple calls land at once, coordinate directly with the other medics on the EMS channel.

### 6.8 Backup and mutual aid

- If there are no medics on duty, or the medics on duty need help, backup may be requested through the in-character Discord channel. Avoid mass pings.
- Medics already in the city are expected to assist until a major incident is settled — a mass shooting is everyone's problem.
- For a scene requiring more units, radio the shift lead. If there is no shift lead, request additional units directly.

### 6.9 Events

- Medics staged for a civilian event must inform the units on duty and post it in the in-character channel.
- Request additional coverage if pulling units to an event would leave the city thin.
- Event staging with specialty vehicles requires command approval.

## 7. Radio Procedure

### 7.1 Radio discipline

- Do not break into communications during an active situation unless your traffic is priority — a unit down, a kidnapping, an emergency backup request.
- Silence during an active situation is still an active situation. Wait for it to clear before resuming routine traffic.
- Route non-priority traffic to 311 while the radio is busy.
- Acknowledge transmissions with 10-4 so the sender knows they were heard.
- Use the NATO alphabet on voice to prevent miscommunication. Abbreviations are fine in text.
- Include the "10" when saying single-digit codes: 10-12, 10-41, 10-42.

### 7.2 Channels

| Channel | Use |
| --- | --- |
| 1 | DOJ |
| 2 | PD Main radio you join for Request assistance. |
| 3-6 | PD |
| 7 | EMS operations |
| 8 | EMS operations -Situation Frequency |
| 10 | Comment for all departments. |

### 7.3 Radio codes

| Code | Meaning | Code | Meaning |
| --- | --- | --- | --- |
| 10-2 | Loud and clear | 10-42 | Off duty |
| 10-3 | Clear radio traffic | 10-47 | Injured person |
| 10-4 | Acknowledged | 10-52 | Request for medical |
| 10-6 | Busy / unavailable | 10-74 | Negative |
| 10-7 | Out of service, short break | 10-76 | En route |
| 10-8 | Back in service | 10-77 | Backup request, non-emergency |
| 10-9 | Repeat last transmission | 10-78 | Backup request, emergency |
| 10-12 | Standby / staging | 10-95 | Suspect in custody |
| 10-13 | Officer down | 10-100 | Crash / disconnect |
| 10-14 | Medic down | Code 1 | Normal patrol, no lights or siren |
| 10-16 | At hospital | Code 2 | Lights only |
| 10-20 | Current location | Code 3 | Lights and siren |
| 10-23 | Arrived on scene | Code 4 | Scene clear, safe to roll in |
| 10-24 | Assignment complete | Code 6 | Searching the area |
| 10-25 | Meet in person | A / B | Alpha (urgent) / Bravo (non-urgent) |
| 10-41 | On duty | | |

### 7.4 Phonetic prefixes

Callsign prefixes correspond to rank and are listed in the companion rank document. On voice, always speak the full NATO word — Alpha, Bravo, Charlie, Echo, Hotel, Lima, Papa, Tango — and abbreviate to the single letter only in text.

## 8. Scene Safety and Scene Management

> You are no use to a patient if you become one. Scene safety is the first step of every single call, without exception.

### 8.1 Approaching a scene

- Assess before you arrive. Check GPS, listen to radio traffic, look at how much PD is responding.
- If you cannot determine whether a scene is safe, radio PD and ask directly. Then either roll in or stage.
- Do not enter the scene of an active situation such as a firefight.
- When a situation is close to clearing, stage a minimum of two blocks away and out of direct line of sight.
- Do not enter until Code 4 is called by a LEO. Watch the radio and.
- If a scene goes active again while you are working it, drop everything and leave immediately. If you cannot leave safely, take cover and do not interfere.

### 8.2 Active situations at the hospital

- If you are inside Central Medical Centre when a situation goes active — staff or LEOs being held up, a 13-A or 14-A on site — get out of direct sight and wait for a LEO to call Code 4.
- If you are outside CMC when an active situation there is broadcast, do not go there and do not bring patients there.
- The highest ranking medic on duty will nominate an alternate location to take patients to while CMC is compromised.
- Do not return or redirect units back to CMC until PD calls Code 4.

### 8.3 Officer and medic down calls

| Call | Meaning | EMS response |
| --- | --- | --- |
| 13-A | Officer down, attempted murder. Significant police response required. | Stage well back with extreme caution. Shift lead decides who and how many attend. Enter only on Code 4. |
| 13-B | Officer down, accidental. Additional police may not be needed. | Approach with caution and situational awareness. Confirm with PD if unsure. Roll in or stage. |
| 14-A | Medic down, attempted murder. | Highest priority call in the department. Stage back, coordinate with PD, enter on Code 4 only. |
| 14-B | Medic down, accidental. | Approach with caution as with a 13-B. |

### 8.4 EMS primary scenes

There are situations where EMS takes the primary role and controls the scene:

- **Critical patient care.** EMS prioritises treatment and transport of critical patients even where PD has not finished their tasks, and even where there are non-critical officers down. Use your judgement to preserve life, and communicate the urgency to PD by radio or 311.
- **Biohazard scenes.** Infectious, toxic or otherwise dangerous materials. If no certified medic is available you may don hazmat, but you may not clear the scene or call Code 4 without the certification. Restrict bystanders until the hazard dissipates.
- **Fire scenes** requiring inspection by fire-certified EMS, who must call Code 4 before other responders can safely work.

### 8.5 Crime scenes and bodies

- Alert PD to any dead body or apparent crime scene and avoid contaminating it more than treatment requires.
- PD will clear the scene and tell you when the body can be moved.
- Do not remove personal effects, weapons or evidence from a patient. Note them and hand them over.

### 8.6 Mass casualty incidents

- The shift lead or highest rank on scene runs triage and assigns roles. Announce clearly who is primary.
- Triage first, treat second. Sort everyone before you commit to any one patient.
- Request additional units early. It is easier to stand a unit down than to conjure one.
- Keep the flow moving. Patients have often been down a long time before you arrive — get people up and moving rather than running perfect scenes on a handful of them.
- Any mass casualty involving multiple gunshot wounds is treated at Central Medical Centre, not at a satellite facility or the MRPD bay.

### 8.7 Self-defence

Medics are not combatants. Your first and best option is always to leave.

- **Duty to retreat.** Retreat when faced with danger. If a gang is shooting up a business, you leave — you do not intervene.
- **Stand your ground.** If retreat is impossible, you may defend yourself against violent crime or serious bodily harm, provided you are lawfully where you are.
- **Castle doctrine.** You may defend a place you legally occupy, including your ambulance. Give a verbal warning first.
- EMS may not use melee weapons for self-defence on duty. A flashlight is the exception.
- Against an active shooter, call a 10-78 on the radio and retreat if at all possible. Report to PD afterwards.
- If you discharge a firearm at wildlife, 311 it afterwards.

## 9. Patient Assessment

### 9.1 Rapid assessment — DRCAB

Use DRCAB on arrival at every scene.

| Letter | Check | What you are looking for |
| --- | --- | --- |
| D — Danger | Is the scene safe? | Threats to you or the patient. Remove or withdraw before treating. |
| R — Response | Is the patient responsive? | Alert and talking, or responding to instruction — open eyes, squeeze hand. |
| C — Circulation | Is there a major bleed? | Excessive blood loss, pulse present, heart rate. |
| A — Airway | Is the airway clear? | Obstruction by blood, vomit, water or foreign material. |
| B — Breathing | Is the patient breathing effectively? | Two breaths within ten seconds. Irregular or absent breathing. |

### 9.2 ABCDE

For a fuller structured assessment, or when handing over to a doctor, work ABCDE:

- **Airway** — check for and clear any blockage.
- **Breathing** — assess whether breathing is present, irregular or normal.
- **Circulation** — check pulse and heart rate, control bleeding.
- **Diagnosis** — identify and treat the injuries the patient has communicated.
- **Exposure** — check for burns, infection, environmental injury and anything hidden by clothing.

### 9.3 AVPU

A quick neurological check during the primary survey:

- **A** — Alert and oriented.
- **V** — Responds to voice.
- **P** — Responds to pain only.
- **U** — Unresponsive.

### 9.4 Primary and secondary survey

- **Primary survey.** Address immediate life threats using DRCAB and AVPU. Stop major bleeding, clear the airway, restore breathing. Nothing else matters until this is done.
- **Secondary survey.** Once life threats are managed and the situation allows, run a head-to-toe examination and check vitals.
- Adapt the depth of the secondary survey to the patient. If they are engaged and enjoying the scene, be thorough. If they are not, cover the essentials and keep things moving.

### 9.5 Altered mental status

- To check orientation, ask questions the patient would reasonably know: who the mayor is, what city they are in, what month or year it is.
- Do not ask for names, colours of objects or year of birth — these are unreliable in the city.
- When handing over, state plainly "they are unaware of X" or "completely aware."

### 9.6 Consent and player agency

- Explain what you are about to do and get agreement before doing it. "I'm going to cut your shirt away to get the pads on, alright?"
- Treat only the injuries the patient or Nancy has communicated to you. See Section 2.4.
- A conscious patient may refuse any part of your treatment, and may refuse transport. That is their right.
- Do not force a patient into the ICU system or into a procedure. Ask.

## 10. Triage

Every medic is expected to know triage cold. Triage is based solely on medical need — never on a patient's popularity, career, criminal record or who they know.

### 10.1 Running triage

- The highest rank on duty is automatically primary on a multi-patient scene and leads triage. They may delegate primary to someone better placed.
- If no senior medic is present, the medics on scene work together to identify and treat critical patients first.
- Sort before you treat. Walk the scene, tag everyone, then commit.
- Re-triage as you go. Patients deteriorate and improve.

### 10.2 Triage classifications

| Class | Meaning | Examples | Transport |
| --- | --- | --- | --- |
| Red | Critical. Needs immediate life-saving intervention or surgery. Likely to survive with immediate treatment. First priority. | Multiple GSWs, excessive bleeding, low or irregular vitals, airway compromise. | Required |
| Yellow | Concerning but stable. Will need hospital care. | Fractures, deep lacerations, moderate burns. | Required |
| Green | Stable and walking. Minor injuries, little monitoring. | Twisted ankle, minor cuts, bruising, road rash. | Not required |
| White | A doctor is not required. At-home treatment and first aid is sufficient. | Superficial scrapes, minor bumps. | Not required |
| Black | Expectant or deceased. Injuries incompatible with survival. Treated last. | Decapitation, catastrophic trauma, exsanguination. | Required |

> Never pronounce someone dead. Only a doctor or Nancy may declare death. A black tag is a triage decision about where your effort goes, not a declaration.

- Do not treat a black-tagged patient while there are others who can be saved.
- Where you have the resources, black-tagged patients are still transported.

## 11. Field Treatment and Transport

### 11.1 Your three options

1. **Stabilise, treat and release** — minor injuries, patient stays where they are.
2. **Stabilise and transport** — patient needs hospital care.
3. **Stabilise and hand over** — a doctor or another unit takes the patient from you on scene or at the door.

Your priority is always to stabilise the patient and get them to a doctor. You do not need to complete every step of treatment yourself before check-in.

### 11.2 Choosing between them

- **Minor injury, conscious patient** — scrapes, bruises, road rash, wind knocked out. Get them on their feet, treat on scene and advise them to come by Central Medical Centre if anything worsens.
- **Major injury, conscious patient** — GSW, stab wound and similar. Determine location, severity and type of wound, treat to SOP, then let the patient choose. If they decline hospital and are not under arrest, strongly advise follow-up treatment.
- **Unconscious or life-threatening** — massive GSWs, head injury, major blood loss. Field measures to stabilise, backboard, then transport. This is not optional; transport.

### 11.3 Refusal of care

- A conscious patient with minor injuries may refuse transport. Advise them clearly and let them go.
- A patient with a life-threatening injury who refuses transport should be strongly advised of the risk. Document the refusal.
- A patient may decline your care in favour of Nancy and her staff. That is their right and you do not argue it.
- Never force a patient into treatment, transport or the ICU.

### 11.4 Critical versus non-critical

| | Critical | Non-critical |
| --- | --- | --- |
| Definition | Injuries placing life in jeopardy, or low or irregular vitals. | Not seriously dangerous. Patient conscious with stable vitals. |
| Examples | Extreme blood loss, fracture of an arm or leg, third or fourth degree burns, airway compromise, unconsciousness. | Cuts, bruising, sprains, minor burns, road rash. |
| Hospital entry | Back garage / ambulance bay. | Front bay, unless in custody. |
| Alert doctors | Required, on Channel 9, before arrival. | Optional. Board note at the ER bed is sufficient if doctors are busy. |

### 11.5 Transport

- Stabilise before you load. Backboard and c-collar any unconscious patient or suspected spinal injury before putting them in the ambulance.
- Ask a walking patient to walk to the ambulance themselves, then assist them up the step.
- All patients in custody and all officers are brought in through the back garage.
- When transporting a suspect in custody, avoid crowded areas and gang territory.
- The front of the hospital is for unloading only. If you are not actively unloading, move the ambulance to the bay.
- Continue monitoring en route. If your patient has no pulse and you have a partner, continue compressions during transport.

### 11.6 Handing over to doctors

Always debrief the receiving doctor on what you found and what you did. Use plain speech on Channel 7, not ten-codes.

- Before arrival, give the doctors the number of patients, the nature of injuries and your ETA.
- Example: *"Doctors from EMS — one patient inbound to Central Medical Centre. Car accident, thrown from the vehicle, broken right arm. ETA one minute."*
- On handover, state what happened and what treatment you performed.
- Example: *"GSWs to the chest, packed with saline-soaked gauze and bandaged. Heavy bleeding so I started an IV, and he was struggling to breathe so he's on oxygen."*
- For critical patients this radio alert is mandatory, not optional.
- If the doctors are occupied, write a brief summary of the patient's status on the information board at the foot of their ER bed.

**Note:** This will only be applicable once the Doctor Department is fully operational and the Doctor Department and EMS Department are separated. Until then, as Radio 7 is also being used as the doctors' radio, doctors working in EMS in a medical capacity will handle the handover.

## 12. Treatment Guides

> These are starting points for medics who are not sure where to begin. They are not law. As long as you are not being unsafe or powergaming, develop your own style — the roleplay matters more than the checklist.

### 12.1 Road rash, scrapes and minor cuts

1. Clean the wound with saline and gauze to remove debris.
2. Apply antibiotic ointment.
3. Close larger wounds with butterfly stitches or steri-strips.
4. Cover with a bandage to keep the wound clean.

### 12.2 Bumps and bruising

- **Limbs** — examine the area and confirm the patient has not lost mobility. Loss of mobility escalates this to critical. Apply an ice pack to reduce swelling and bruising, and wrap it to hold it in place.
- **Torso** — examine for cracked ribs or signs of internal injury. Any concern means splint and transport. Otherwise an ice pack is sufficient.

### 12.3 Sprains and strains

1. Apply an ice pack to reduce swelling.
2. Wrap the area with an elastic bandage.
3. Advise the patient to keep weight off it.
4. Administer ibuprofen for pain and inflammation.

### 12.4 Fractures and broken bones

1. Do not attempt to realign the bone.
2. Apply a c-collar if there is any suspicion of neck or spinal involvement.
3. Immobilise the area — splint above and below the break, then wrap and stabilise the splint.
4. Compound fracture (bone exposed): bandage around the bone, do not push it back in.
5. Start an IV with lactated ringer's or saline if there are signs of blood loss or shock.
6. Apply a tourniquet if the patient is bleeding at the fracture site.
7. Administer ibuprofen for pain and swelling. Advanced providers may give IV morphine for compound fractures.
8. Transport.

### 12.5 Dislocated limbs

1. Identify the dislocated joint and check circulation below it.
2. Provide pain relief — lidocaine where you are certified to use it.
3. Attempt reduction only if both you and the patient are comfortable with it. Otherwise splint in place and transport.

### 12.6 Neck and spinal injury

1. Bring the head slowly into neutral alignment with the body.
2. Apply a c-collar to prevent further movement.
3. Strap the patient to a spinal board.
4. Start an IV with lactated ringer's if there are signs of shock.
5. Transport for further examination. Do not let the patient walk.

### 12.7 Head injury

1. Assess for loss of consciousness, confusion, vomiting and altered mental status.
2. Monitor pupil size and response to light.
3. Apply bandages or an IFAK to any visible head wound.
4. Start an IV with lactated ringer's if shock is present.
5. Administer paracetamol or acetaminophen for headache if appropriate. Avoid sedatives.
6. Transport immediately, monitoring vitals the whole way.

### 12.8 Stab wounds

**Object removed or absent:**

1. Apply direct pressure to stem the bleeding.
2. Clean the wound with saline.
3. Pack the wound with saline-soaked gauze.
4. Apply pressure bandages.
5. Start an IV with lactated ringer's if there is significant blood loss.

**Object still in place:**

1. Do not remove the object. It comes out in surgery.
2. Clean around the wound with saline.
3. Pack around the object with gauze.
4. Bandage around the object to stabilise it in place.
5. If bleeding cannot be controlled on a limb, apply a tourniquet high and tight — not on a joint, roughly two inches above the wound.
6. If the object is fixed to something, cut away as much of it as needed to move the patient, keeping the embedded portion secure.
7. Start an IV and transport.

### 12.9 Gunshot wounds

**Through and through:**

1. Apply a tourniquet if needed — arms and legs only.
2. Clean the wound with saline.
3. Seal the wound front and back.
4. Apply pressure bandages.
5. Start an IV with lactated ringer's if there are signs of shock or blood loss.
6. Administer high-flow oxygen if the patient reports dizziness or blacking out.
7. Administer ibuprofen for pain if appropriate, and transport.

**Round lodged:**

1. Apply a tourniquet if needed — arms and legs only.
2. Clean the wound with saline and pack it.
3. Apply pressure bandages. Do not attempt to remove the round; that is surgical.
4. Start an IV with lactated ringer's if there are signs of shock or blood loss.
5. Administer ibuprofen for pain if appropriate, and transport.

**Graze:**

1. Assess whether stitching is required.
2. Clean with saline and apply a bandage.
3. Administer ibuprofen if there is persistent pain or swelling.

### 12.10 Burns

**First and second degree:**

1. Cool and clean the area with saline.
2. Apply burn gel or silver sulfadiazine cream.
3. Cover loosely with non-adhesive gauze or cling film to retain moisture.
4. Administer paracetamol for pain and fever.

**Third and fourth degree:**

1. Wash with saline. Do not remove clothing that has fused to the burn.
2. Start an IV with lactated ringer's to replace fluid.
3. Cover and transport immediately.
4. Administer pain relief within your scope.

> Burns caused by an explosion carry a risk of internal injury and fractures from the shockwave. Monitor these patients continuously throughout treatment and transport, even if they look stable.

### 12.11 Impalement

1. Do not remove the object under any circumstances.
2. Apply pressure around the wound to control bleeding.
3. Bandage around the object to stabilise it.
4. On a limb, use a tourniquet if pressure alone is insufficient.
5. Stabilise the patient's movement, cutting away part of the object if needed to transport.

### 12.12 Shock

1. Lay the patient flat and elevate their legs, unless other injuries make that unsafe.
2. Cover with a thermal blanket to maintain body temperature.
3. Administer oxygen by mask.
4. Start an IV with lactated ringer's to support blood pressure.
5. Administer IV epinephrine if the pulse is critically low, below 60 bpm.
6. Monitor vitals and transport promptly.

### 12.13 Allergic reaction and anaphylaxis

1. Identify and remove the allergen if possible.
2. Check whether the airway is closing.
3. Administer an epinephrine auto-injector and check whether the airway clears.
4. Apply an oxygen mask if breathing is difficult.
5. Start an IV with fluids.
6. Monitor vitals and transport.

### 12.14 Overdose

- **Opioid overdose, unresponsive** — administer naloxone, IV where you are certified for it, nasal spray otherwise. Support the airway and ventilate.
- **Non-opioid overdose, conscious** — administer activated charcoal capsules.
- Support breathing with oxygen, monitor for arrest, and transport.

### 12.15 Seizures

1. Let the seizure run. Do not restrain the patient.
2. Clear the area of anything they could injure themselves on.
3. Do not put anything in their mouth.
4. Place them on their side once the seizure stops, to protect the airway.
5. Apply an oxygen mask after the seizure ends.
6. Administer a sedative within your scope if seizures continue — be cautious about mixing it with other medications.
7. Reassure them, tell them what happened, keep them calm, and transport if warranted.

### 12.16 Diabetic emergencies

- **Low blood sugar** — sugar by mouth if the patient is conscious and can swallow; IV dextrose if they cannot.
- **High blood sugar** — insulin, then transport for monitoring.

### 12.17 Drowning

**With a pulse:**

1. Get them out of the water.
2. Turn the patient onto their side and pat their back to help expel water.
3. Suction the mouth and airway if water or frothing is present.
4. Return them to their back and apply an oxygen mask.
5. Start an IV with a diuretic to clear residual fluid.
6. Transport — delayed complications such as secondary drowning are common.

**Without a pulse:**

1. Get them out of the water, onto their side, clear the airway.
2. Reposition on their back and begin two rounds of chest compressions.
3. If there is still no pulse: cut away clothing, dry the chest, apply AED pads to dry skin.
4. Analyse for a shockable rhythm and deliver up to three shocks.
5. Once a pulse returns, apply oxygen, start an IV, and start a second IV with epinephrine to stabilise vitals.
6. Transport to Central Medical Centre.

Watch for hypothermia, weak pulse, pale skin and difficulty breathing in all drowning patients.

### 12.18 Taser injuries

1. Grip the prong close to the skin and pull straight out quickly.
2. Clean the site with saline or antiseptic.
3. Apply burn gel or silver sulfadiazine cream.
4. Cover with a sterile non-adhesive bandage.
5. Monitor for arrhythmia. Administer oxygen if needed.
6. Check for secondary injuries from the fall.
7. Transport if symptoms are abnormal or the secondary injuries are significant.

### 12.19 Unconscious patient

1. Run DRCAB.
2. Apply an oxygen mask immediately.
3. Suction the airway if it is blocked by blood, vomit or water.
4. Start IV fluids.
5. Administer epinephrine if vitals are low.
6. Start a second IV with lactated ringer's if blood loss is significant.
7. Check for injuries and treat what you find.
8. Backboard and transport, monitoring continuously.

## 13. Code Blue and Resuscitation

### 13.1 Definition

A patient is Code Blue when they have no pulse or are not breathing — cardiac arrest, respiratory arrest, or both. It is a life-threatening emergency requiring immediate resuscitation.

Declare a Code Blue when the patient is unresponsive, not breathing, has no pulse, or has severe bradycardia or abnormal vitals with rapid deterioration.

### 13.2 Field protocol

1. **Assess.** Confirm the scene is safe. Tap and shout. Check breathing and pulse together, for no more than ten seconds.
2. **Declare.** Call it immediately on the radio: "Code Blue at [location]." Request additional units or Angel-1 if the location warrants it.
3. **Control bleeding.** Treat major bleeds first, seal chest wounds, apply tourniquets to limbs if needed. Compressions on a patient who is still bleeding out achieve nothing.
4. **Airway.** Clear any obstruction, suction if needed, apply an oxygen mask and start flow.
5. **Compressions.** 30 compressions at 100–120 per minute, 5–6 cm deep, on a hard surface or backboard. 30:2 with a bag valve mask if no advanced airway. Check for a pulse after each cycle.
6. **AED.** Cut away clothing and dry the chest. Apply the pads. If a shock is advised, ensure nobody is touching the patient, announce "Clear," and deliver. Reassess and repeat up to three shocks.
7. **Medication.** Administer IV epinephrine within your scope to stimulate cardiac activity, up to three doses. Consider antiarrhythmics for a shockable rhythm after defibrillation.
8. **Reassess every two minutes.** Pause briefly, check rhythm, check for return of spontaneous circulation.
9. **Transport regardless of outcome.** If there is still no pulse, continue compressions en route where you have a partner, or apply the LUCAS device for continuous compressions.

### 13.3 Working as a team

- Code Blue is a team job. While one medic runs compressions, another attaches pads, manages the airway or draws up medication.
- Where a full team is available, assign roles clearly: code leader, airway, compressions, medication, defibrillator, recorder.
- PD and bystanders can be directed to help with simple tasks. Use them.

### 13.4 After return of spontaneous circulation

- Apply an oxygen mask and maintain oxygenation.
- Start an IV with lactated ringer's, and a second with epinephrine to hold vitals.
- Treat the underlying injuries — the gunshot wound that caused the arrest still needs sealing.
- Transport to Central Medical Centre for ICU-level care and monitoring.

### 13.5 Reversible causes

Where a Code Blue is not responding, consider and treat what caused it — hypoxia, hypovolaemia, acidosis, electrolyte imbalance, hypothermia, tension pneumothorax, cardiac tamponade, toxins and thrombosis.

### 13.6 Stopping resuscitation

- You may stop resuscitation where you have done your due diligence and reasonably believe the patient is gone.
- You may not declare death. Only a doctor or Nancy can call a time or cause of death.
- Follow Section 18 for everything that happens after that point.

## 14. Medications and Scope of Practice

> Do not administer any medication you are not comfortable with or have not been trained on. Scope tiers below are referred to as Tier 1 (entry-level field provider), Tier 2 (certified field provider) and Tier 3 (advanced provider). Map these onto the department rank structure as published in the companion rank document.

### 14.1 Medication chart

| Medication | Use | T1 | T2 | T3 |
| --- | --- | --- | --- | --- |
| IV Saline | Improves blood pressure, fluid replacement | Y | Y | Y |
| Lactated Ringer's (IV) | Replaces fluids and electrolytes | Y | Y | Y |
| Oxygen | Improves oxygen saturation | Y | Y | Y |
| Ibuprofen (under 500mg) | Mild pain, inflammation and swelling | Y | Y | Y |
| Paracetamol / Acetaminophen | Pain relief, fever, headache | Y | Y | Y |
| EpiPen (auto-injector) | Anaphylaxis and allergic reaction — max 3 injections | Y | Y | Y |
| Naloxone (nasal) | Opioid overdose reversal | Y | Y | Y |
| Activated charcoal | Non-opioid overdose, conscious patient | Y | Y | Y |
| Methoxyflurane (green whistle) | Moderate to severe pain | Y | Y | Y |
| Insulin (injectable) | High blood sugar in diabetics | Y | Y | Y |
| Dextrose (IV) | Low blood sugar where the patient cannot eat | Y | Y | Y |
| Antibiotic ointment | Wound care | Y | Y | Y |
| Silver sulfadiazine / burn cream | First and second degree burns | Y | Y | Y |
| Nitroglycerin (tablet) | Cardiac chest pain only | N | Y | Y |
| Epinephrine (IV) | Cardiac output during arrest, low pulse under 60 bpm — max 3 doses | N | Y | Y |
| Naloxone (IV) | Opioid overdose reversal | N | Y | Y |
| Blood bag (IV) | Severe haemorrhage. Red label O-, blue label Rh-/Rh+ | N | Y | Y |
| Diuretic (IV) | Clears residual fluid in drowning patients | N | Y | Y |
| Midazolam (IV) | Sedation, ongoing seizures. Do not mix with other medication | N | Y | Y |
| Lorazepam (IV) | Seizures | N | Y | Y |
| Morphine (IV) | Severe pain, compound fractures, major trauma | N | N | Y |
| Fentanyl (IV) | Severe pain | N | N | Y |
| Lidocaine (injection) | Reduction of dislocated limbs | N | N | Y |

### 14.2 Handling and storage

- Medication is drawn from the locked box in your ambulance and from the medical supply cabinet.
- Medication is removed from the vehicle at the end of each shift. If the medic before you signed off, their kit went with them — check your stock before you take a call.
- Never give or sell medication to anyone outside the department. That is corruption and it is an immediate termination.
- Record every prescription and controlled substance you administer or supply in the MDT.
- Do not stack sedatives, opioids and other depressants. Note what you have already given during handover.

## 15. Equipment

### 15.1 Equipment chart

| Equipment | Use | T1 | T2+ |
| --- | --- | --- | --- |
| IFAK | Individual first aid kit for rapid field stabilisation | Y | Y |
| Trauma kit | Stabilise or revive a patient | Y | Y |
| Medical kit | General healing and wound care | Y | Y |
| Bandages / pressure dressings | Closes wounds, controls bleeding | Y | Y |
| Gauze | Packing wounds, cleaning | Y | Y |
| Tourniquet | Stops severe limb bleeding | Y | Y |
| Splint | Immobilises fractures and breaks | Y | Y |
| C-collar | Immobilises the neck | Y | Y |
| Stretcher / backboard | Spinal immobilisation and transport | Y | Y |
| Suction machine | Clears an airway blocked by blood, vomit or water | Y | Y |
| Oxygen mask | Oxygen delivery | Y | Y |
| Thermal blanket | Maintains body temperature in shock and exposure | Y | Y |
| Ice packs | Reduces swelling and bruising | Y | Y |
| Defibrillator (AED) | Detects and treats shockable rhythms; will not shock if inappropriate | Y | Y |
| LUCAS (auto-CPR) | Continuous compressions during transport or while treating | Y | Y |
| Encrypted radio | Department communications | Y | Y |
| Bag valve mask (BVM) | Ventilates a patient who cannot breathe unaided | N | Y |
| Surgery kit | Treatment of injuries in hospital, assisting Nancy | N | Y |

> Do not use equipment you have not been trained on or are not comfortable with. Giving away or selling department equipment is corruption.

### 15.2 Ambulance stock

A properly stocked ambulance carries: stretcher and backboard, c-collar, oxygen and masks, pressure bandages and gauze, saline and IV fluids, thermal blanket, ice packs, AED, LUCAS, suction unit, and the locked medication box.

- Check your stock at the start of every shift. Restock from the medical supply cabinet before you take your first call.
- Report broken or missing equipment to the shift lead.

## 16. Hospital Operations and Etiquette

### 16.1 Facilities

| Facility | Role |
| --- | --- |
| Central Medical Centre (CMC) | Primary hospital. Full ER, surgical suites, ICU, morgue. All critical patients and all mass casualties. |
| Sandy Shores Medical | County facility. Non-critical treatment and stabilisation. |
| Paleto Bay Clinic | Northern county facility. Non-critical treatment and stabilisation. |
| MRPD Medical Bay | Treatment of non-critical officers, medics and high-value targets in custody. No surgical or ICU capability. |
| Bolingbroke Penitentiary Medical Ward | Inmate treatment and ICU stays for high-value targets and violent offenders at LEO request. |

### 16.2 Access and public policy

- The hospital stays open to the public at all times, with free access to all areas except the break room, offices, motor pool and morgue.
- Access to treatment areas is never restricted. Do not physically lock treatment area doors.
- Keep your voice down in the hospital. Private medical information carries, and volume interferes with other people's treatment.
- Only the patient is permitted in the general ward during a procedure.

### 16.3 Parking

- The spaces closest to the hospital doors are for ambulances only.
- Personal vehicles go in the spaces furthest from the doors, parked so they do not clutter the motor pool. The same applies when retrieving a stored vehicle.
- The front of the hospital is for unloading patients. If you are not unloading, move to the ambulance bay or the garage.
- Patients in custody are always unloaded at the side or rear, never at the front.

### 16.4 Working inside the hospital

- If doctors are on duty at a nearby facility, bring patients there.
- EMS may treat minor injuries in the hospital — bumps, scrapes, superficial cuts and bruising. Anything more extensive needs Nancy or a doctor. You may assist in the surgical suites.
- Help other staff usher people in and out, direct patients to beds, and keep the recovery room and surgical hallway clear and quiet.
- Ask loiterers to leave once or twice. If that fails, call PD to escort them out.
- Doctors are expected to greet and offer their services to incoming patients. If a patient prefers Nancy, that is their choice and it is not disputed.

## 17. Intensive Care Unit

### 17.1 Admission

If doctors are on duty, they handle everything ICU-related. The procedure below applies when no doctors are available.

1. Confirm with Nancy that the patient needs ICU and for how long.
2. 24 hours or less — place the patient in a staged Emergency Room bed. No report is needed.
3. More than 24 hours — admit them properly to the ICU through the hospital admissions system.
4. Take the patient's state ID from their ID card or digital licence and verify their profile in the MDT.
5. Fill out the ICU admission form with their details and your medical statement, and file an MDT report tagged Injury, ICU and Surgery as applicable.
6. Confirm an empty room before placing the patient in it, and record the room on the ICU tracker.
7. If the patient has emergency contacts listed, contact them and inform them. You may open visitation to those contacts and their companions, and may close visitation at any time.

> Do not force anyone into the ICU system. Ask the patient whether they want to be admitted.

### 17.2 Patients in custody

- A patient in PD custody who needs 24 hours or less is released back into custody, and is cared for by the Bolingbroke Penitentiary medical team.
- For a patient in custody, do not contact emergency contacts and do not allow visitation by anyone except PD.
- Record the arresting officer on the admission form for future reference.
- High-value targets and violent offenders may serve their ICU stay at Bolingbroke at LEO request. Complete treatment, reporting and emergency-contact visitation at the hospital as normal, then assist with the transfer.

### 17.3 Discharge

1. Check the patient's report in the MDT or the ICU tracker and confirm their recommended stay has elapsed.
2. If it has not, confirm with Nancy that they are well enough to leave, and that they have measures in place in case of emergency. Recommend they see a doctor soon.
3. Check vitals. If they are erratic or outside normal range, record the readings on the report.
4. Check pain. If the patient is still uncomfortable or in severe pain, record that on the report.
5. Give your recommendation on whether they should stay. If they choose to leave against advice, record that too.
6. Fill out the ICU discharge form and add a discharge addendum to their existing report.
7. Confirm the hospital system is aware they are being discharged.

- For a patient in custody, 311 PD that the patient is ready and awaiting transfer. Do not complete the discharge until a LEO is available to take custody.

## 18. Declaration of Death, DOA and Perma

> EMS cannot legally declare death. Only a doctor or Nancy may call a time or cause of death. Before any of this begins, the player must confirm out of character that they intend to perma their character — ask twice, using /oocl, and accept a no without argument.

### 18.1 Confirming intent

- Ask /oocl Perma? and then /oocl Are you sure you want to perma?
- A permanent character death is entirely the player's decision. If there is any hesitation, treat it as a no and continue treatment.
- Never pressure or hint. This is the single most sensitive thing we do.

### 18.2 Doctors on duty

- Inform the doctors over the doctor frequency. Ask where they want to receive the patient.
- Assist with transport where you have the units to spare.
- Give the doctor a full statement: how you found the patient, what treatment you performed, and anything relevant from the scene.

### 18.3 No doctors on duty

1. Bring the patient to the hospital for processing and take them to Nancy, who will state the time of death.
2. Once time of death is announced, notify PD via 311 with the patient's name and state ID, if PD are not already present.
3. Move the body to the staging room near the Emergency Room for Nancy to conduct the autopsy.
4. Write the medical report while Nancy works. Tag it DOA and Autopsy.
5. Record all exterior physical trauma, working head to feet, whether or not it relates to the apparent cause of death.
6. Record the internal assessment — internal injuries, missing or damaged organs.
7. Record the blood test results — drugs, medications, foreign substances and blood type.
8. If PD have requested an official medical report, note that in the report and inform a doctor.

**Example report:** *[EMS statement]. Time of death 08:00 IST. Official cause of death is haemorrhage. On external examination the deceased presented a purplish bruise to the torso and a stab wound to the neck, with white powder residue around the neck. Internal examination found no internal injuries; all organs present and weighed. Blood testing returned a slight trace of oxycodone and no signs of intoxication. Blood type O positive.*

### 18.4 Information to capture

- Name and state ID
- Age and gender
- Next of kin and emergency contact report number, if available
- Personal effects on the person — jewellery, trinkets and items to pass on
- Time of death
- Full report of injuries and treatment performed

### 18.5 Notifications and visitation

- Confirm with PD whether death may be announced publicly — there may be an active investigation.
- Notify the emergency contacts and invite them for a final visit. Use that time to complete your paperwork.
- Public announcement template: *Central Medical Centre, with deepest sympathy, announces the passing of [name]. They were a beacon of light within the city and will be greatly missed and forever remembered.*
- Ask the emergency contacts and Nancy whether a public viewing is wanted. PD may block it if it would impede an investigation.
- Visitation announcement template: *Central Medical Centre is open to visitors for the next [time frame] for those wishing to say goodbye to [name].*
- One medic must be present for the duration of visitation, provided coverage allows. You may go 10-7 while handling it.
- When visitation ends, Nancy moves the body into cold storage.
- Submit the perma form and complete all paperwork before visitation closes.

## 19. Documentation and MDT Reporting

### 19.1 When a report is required

- Any severe injury treated by Nancy or a doctor. Tag it Follow-up and take the patient's phone number so a doctor or nurse can follow up.
- Any ICU admission or discharge.
- Any death, DOA or autopsy.
- Any incident where PD was called or a police report was filed.
- Any treatment given at MRPD or Bolingbroke, unless it is a mass casualty where documenting everything is unrealistic — in that case write one general incident report.
- Any office visit, procedure or prescription outside of an emergency response.
- Any use of force, or any incident where you were assaulted, kidnapped or obstructed.

### 19.2 What a report contains

- Patient name and state ID.
- Date, time and location of the incident.
- What happened, in the patient's words and yours.
- Injuries identified, and how they were identified.
- Treatment given, in order, including medications and doses.
- Disposition — released on scene, transported, admitted, refused care, deceased.
- Whether PD were contacted and why.
- Correct tags: Injury, ICU, Surgery, Follow-up, DOA, Autopsy, FTO Notes as applicable.

### 19.3 Standards

- Write reports before you clock off. Late or incomplete paperwork is a disciplinary matter.
- Prescriptions and controlled substances must be recorded in the MDT under government regulation.
- Never falsify a report. Falsification or evidence tampering is a major violation, and MDT corruption is grounds for immediate termination.
- Reports are a shared clinical record. Someone else will read yours to decide how to treat that patient next time.

## 20. Patient Confidentiality and Records Release

### 20.1 Confidentiality

Anything you learn about a patient in the course of your work is confidential. It may only be shared with other medical personnel, doctors, the patient's documented emergency contacts, relatives or caregivers.

- Do not discuss patients in public areas of the hospital, on open radio, or in social settings.
- Do not confirm to a third party that a named person is or was a patient.
- Gossip about a patient's injuries, involvement or affiliations is a serious breach.

### 20.2 Release of records

| Requester | Requirement |
| --- | --- |
| The patient themselves | No requirement. |
| District Attorney | No subpoena required. |
| Law enforcement, current investigation | No subpoena required for records relevant to that investigation. A formal records request should be filed on their end. |
| Documented emergency contacts | Recent injuries may be released. Historical records require the patient's permission. |
| Emergency contacts listed as legal counsel | Any requested report may be released. |
| Personal lawyers | Direct permission from the patient, or a subpoena. |
| Anyone else | Refuse and refer them to the patient. |

Limited information may be disclosed to PD without a formal request where it concerns a suspect, a crime that occurred during your response, or a patient's destination.

### 20.3 Court procedure

If you are subpoenaed to court or a bench trial, speak to Command beforehand wherever possible. Command will:

- Brief you on court etiquette — what you may and may not discuss as a witness — and arrange legal representation if needed.
- Help you write an accurate report of the incident in question.
- Confirm what patient information you are permitted to provide.

If you are asked for a written formal statement or to testify, escalate the request to Command and await instructions before responding.

## 21. Duty to Report

Public trust is the foundation of our job. If people stop believing they can call us safely, they stop calling, and people who need care do not get it. We balance the duty to report against that trust using reasonable suspicion, or direction from the patient or Nancy.

### 21.1 You must report

- **Stated intent to commit a crime.** If someone tells you they plan to commit a crime, report it.
- **A non-medical crime you witness.** If you observe a crime unrelated to your medical call, report it.
- **Acts of violence during a call.** Any violence you witness during an EMS response must be documented and reported.
- **Anything endangering officers or medics.** Threats to responder safety are always reported.

### 21.2 You need not report

- **Illegal activity at a medical call.** If you respond to an injured person who is in the middle of something illegal, your focus is the patient. No report required.
- **Wanted individuals.** Seeing a wanted person, on a call or otherwise, does not oblige you to report their location.
- Do not obstruct justice if PD asks you a direct question. Answer honestly within confidentiality rules.

### 21.3 Procedure

- **Conscious patient** — once treated, ask whether they would like to file a police report. If they say yes, you must also create a medical report.
- **Unconscious patient** — once treated, ask Nancy whether the situation seems suspicious and whether PD should be notified. If Nancy says yes, call PD, file a medical report and note in it that PD were contacted.
- **Unconscious patient, no answer from Nancy** — you must call PD. File a medical report and note that PD were contacted.
- A patient who remains unconscious after treatment is usually an ICU case, so you will be writing a report regardless.

## 22. Custody, MRPD and Bolingbroke Operations

### 22.1 Patients in custody

- All 10-95s and officers are brought into the hospital through the back garage.
- Every medic treating a 10-95 must have an officer escorting them. No exceptions.
- All 10-95s must be asked whether they want treatment at the hospital or at the MRPD medical bay. If they request the hospital, you transport them there.
- Patients must consent to being treated at MRPD.
- Avoid crowded areas and gang territory when transporting a suspect.

### 22.2 MRPD medical bay

| Treat at MRPD | Must go to CMC |
| --- | --- |
| Non-critical officers (yellow, green) | Any critical patient needing surgery or ICU |
| Non-critical medics (yellow, green) | All civilians |
| High-value targets | Critical officers and critical medics |
| High-value target DOAs | All other DOAs |
| Conscious yellows and greens in custody | Any mass casualty with multiple gunshot wounds |

- At MRPD you are assisting Nancy. There is no surgical suite and no ICU capability.
- If a patient is unconscious, ask Nancy whether extensive surgery or ICU will be needed. If so, they go to CMC.
- A conscious red is judged case by case.
- When entering the MRPD motor pool, do not park along the wall. Use a parking space.
- Have an officer escort you to the medical bay. Once treatment is complete, the officer escorts the patient to holding and a second officer escorts you back to your ambulance and lets you out of the motor pool.

### 22.3 Bolingbroke Penitentiary

- Corrections send a 311 alert when inmates need medical attention.
- If the nature of the injuries is not stated, the shift lead — or the responding medic if there is no shift lead — calls the requesting corrections officer to establish the number of patients and nature of injuries.
- Where multiple calls are pending, prioritise city 10-47s if the prison reports only minor injuries.
- We cannot refuse to treat an inmate who requests medical attention on the grounds that their injuries are minor or that they are not a true 10-47.
- Whether an inmate is transported to CMC or waits for an available unit is the warden's or the corrections officers' decision.
- Surgeries and treatment at the prison are performed with Nancy's assistance.
- A corrections officer must escort you at all times. You are never left alone with an inmate inside the walls, including in the infirmary.
- If there are no corrections staff on duty, a PD escort must be obtained before you enter.
- If inmates themselves send 311 or 911 alerts, reply that EMS will be en route once an escort is available.

## 23. Fleet and Vehicle Policy

### 23.1 Shared responsibility

- The fleet belongs to the department, not to you. After your shift, repair the vehicle, fuel it to at least 75%, and store it properly.
- Failure to maintain the fleet leads to suspension and, repeated, to termination.
- Do not modify shared vehicles — no colour, livery or cosmetic changes.
- Personal vehicles do not belong in shared EMS parking without permission and may be towed.
- Report vehicle damage or missing equipment to the shift lead.

### 23.2 Driving

- Drive carefully and obey traffic law in EMS vehicles, especially when not responding to a call. Unsafe driving is punishable by discipline and traffic citations.
- Use Code 1 for routine patrol, Code 2 for lights only, and Code 3 for lights and siren when responding.
- A wrecked ambulance and an injured medic help nobody. Speed is not worth the call.

### 23.3 Vehicle access

| Vehicle | Access and conditions |
| --- | --- |
| Standard ambulances (Rumpo, Speedo) | Available to all personnel at any time. These are the default response units. |
| Heavy ambulance / Trauma unit | Trauma certification required. Advanced providers only may drive it. Two additional ambulances must be on shift. Trainees are not trained on it as routine. |
| Pickup trucks (Sandstorm, Hellenbach, Caracara) | County units only, for mountain calls. Staging requires shift lead or command approval and at least two other full units on duty. Stored in the county. Available to all ranks. |
| Rapid response vehicles (Alamo, Dorado, Aleutian, Scout) | Senior field personnel and above. Intended for shift leads and command units. One permitted for every two regular ambulances on duty. Trainees are not trained on these as routine. |
| ATV | Events only, with command approval. |
| Command vehicles (Buffalo STX, V-STR) | Command personnel only. |
| Angel-1 (helicopter) | Flight certification required. See Section 24. |
| Rescue boat | Water certification required. |

> When you take out a specialty vehicle, dispatch the transition on the radio so everyone knows what you are in.

## 24. Air Rescue — Angel-1

Angel-1 is the department's air rescue helicopter, designated for rescue operations in mountainous or remote locations away from the city.

> Failure to follow these procedures may result in loss of the flight certification and the pilot's licence.

### 24.1 Operational rules

- Angel-1 is the callsign for the aircraft. Announce the transition on the radio: "Echo-50 transitioning to Angel-1." Paired: "Echo-50 plus one transitioning to Angel-1."
- Only advanced providers and above may request flight certification.
- A minimum of one pilot is required. Unless the mission requires otherwise, no more than one additional medic may fly.
- A 311 is required when refuelling or repairing at MRPD.
- Patients rescued by Angel-1 go to Central Medical Centre, unless their injuries do not need Nancy — in which case offer Paleto or Sandy.

### 24.2 When Angel-1 may be used

- Outside city limits.
- High elevations and terrain a ground unit cannot reach.
- Long-distance rapid response.
- Water rescue support where a boat cannot reach in time.

Within city limits, land in low-traffic areas to avoid locals and racers.

### 24.3 Refuel and repair

| Refuel | Repair |
| --- | --- |
| MRPD | MRPD |
| Paleto PD | Los Santos International Airport |
| Central Medical Centre helipad | |
| Vespucci PD, Vinewood PD | |
| Los Santos International Airport | |
| Marina helipad (not ideal) | |

### 24.4 Restricted airspace

Do not fly near the penitentiary or the military base unless PD grants permission.

### 24.5 Flight examination

Once a candidate is comfortable flying, a training officer takes off from the helipad, flies to the airstrip, and has the candidate demonstrate:

- Take off and land.
- Fly forward, backward, left and right under control.
- Turn 90, 180, 270 and 360 degrees.
- Perform a U-turn.
- Travel at 100 mph or more.
- Perform an emergency landing.
- Come to a complete stop and hold a hover.
- Hover over a building ledge with minimal movement.
- Coordinate a hovering drop-off, fly away, and return for a hovering pickup without landing.
- Complete a mountain rescue.

Pilots must wear a helmet on duty. Red is preferred.

## 25. Certifications and Specialty Units

### 25.1 Available certifications

| Certification | Covers |
| --- | --- |
| Fire | Fire scene inspection, hazard assessment, and calling Code 4 on fire scenes. |
| Water / Rescue Swimmer | Boat operation, dive and underwater rescue, drowning response, situational awareness in water rescues. |
| Flight | Angel-1 operation. See Section 24. |
| Trauma | Operation of the heavy trauma unit and lead role on major trauma scenes. |
| Advanced Care | Extended medication scope including opioid analgesia and advanced airway management. |
| Hazmat | Biohazard scene control, containment and clearance. |
| Field Training Officer | Authority to train, sign off and evaluate trainees. |

### 25.2 Obtaining a certification

- Certifications are granted by Command following training and a practical examination.
- Instructor certifications are available to experienced personnel who have demonstrated they can teach the material as well as perform it.
- You may not train for a standard certification and an instructor certification at the same time.
- Certifications can be revoked for misuse, unsafe practice, or failure to maintain currency.

## 26. Training Programme

### 26.1 Trainee expectations

- Read these SOPs in full before your first shift.
- Your first shift must be with a Field Training Officer. Where no FTO is available you may ride with a certified medic, but you stay at their side and do not break off.
- Minimum one shift per week, with reasonable effort toward completing training in a timely manner.
- Trainees inactive for two weeks with no contact are removed from the roster and may reapply when they can commit.

### 26.2 Curriculum

**SOPs and protocols** — efficient response and prioritisation of life threats; thorough patient assessment using the primary and secondary survey; communication with dispatch, other units and PD; correct handling of tools, equipment and vehicles.

**Scene scenarios** — hands-on simulations covering mass casualty with triage prioritisation, severe trauma including gunshot and stab wounds, acute medical emergencies such as cardiac events and anaphylaxis, routine patient interaction and bedside manner, surgical assistance with Nancy, and water rescue.

**Hands-on progression** — shadowing the FTO, then guided practice with real-time coaching, then independent practice where the FTO observes and intervenes only for safety or critical error.

**Cheat sheet** — trainees may keep a written reference of common injuries, treatments, supplies, triage stages and radio codes. It may be used on calls and in the field, but not during examinations.

### 26.3 Sign-offs

- There are four sign-offs: Dispatch, Patient Care, SOPs and Driving.
- Any Field Training Officer may award a sign-off.
- Once all four are held, the trainee is cleared to work solo under supervision.

### 26.4 Midterm evaluation

Conducted by the trainee's FTO, assessing:

- Protocol mastery and dynamic application of the SOPs.
- Treatment of common injuries under evolving conditions, while maintaining patient rapport.
- Radio use and code discipline under pressure.
- PD scene protocols — safety and professionalism around patients in custody, transport and coordination.
- Hospital protocols — ICU admission, MDT reporting and clean handovers.
- Driving proficiency, route planning and situational awareness.
- Code Blue response — AED and CPR application.
- Water rescue proficiency where the certification is being pursued.

### 26.5 Indicative timeline

| Stage | Focus | Outcome |
| --- | --- | --- |
| Day 1 | Observation and orientation. SOP overview, live-call observation, introduction to hospital and PD scene protocols. | Foundational knowledge and clear operational expectations. |
| Days 2–4 | Guided practice. Supervised surveys, basic radio use, driving and scene navigation, routine calls with step-by-step guidance. | Early competency in assessment and communication. |
| Days 5–7 | Intermediate independence. Trainee-led scenarios with intervention only as needed, radio under pressure, specialty training begins. | Trainee takes real responsibility on calls. |
| Days 8–10 | Advanced independence. Full calls including Code Blue and mass casualty under observation, full hospital protocol practice. | Ready for midterm evaluation. |
| Days 11–14 | Evaluation preparation. Mock evaluations across all criteria, final coaching on gaps. | Cleared for final evaluation. |

This timeline is a guideline, not a rule. Active, engaged trainees may move faster; trainees with no prior experience or limited availability may take longer. FTOs adapt to the individual while keeping clear documentation in the MDT training notes.

After two weeks of consistent participation without significant progress, the FTO documents the specific gaps and provides tailored support. Where progress remains unattainable, the trainee's fit for the programme is reassessed honestly and kindly.

### 26.6 Final evaluation

- Conducted by Command or an appointed senior evaluator, scheduled at least two days in advance.
- Covers all prior training areas plus new scenarios as needed.
- May involve a ride-along shift where the trainee runs calls independently while observed.
- Controlled scenarios, using a training dummy, cover rare emergencies such as Code Blue.
- Typically runs between 30 minutes and 4 hours at the evaluator's discretion.
- A minimum of 48 hours of duty time across the preceding two weeks is required before a final evaluation.

### 26.7 Feedback and continuous improvement

- Detailed post-shift reviews focused on actionable improvements, not fault-finding.
- Trainee self-reflection and peer feedback are encouraged.
- After Action Reviews are run for heavy scenes to capture lessons learned.
- FTOs meet to refine training strategy and rotate in fresh scenarios.

### 26.8 On completion

- Full understanding and application of these SOPs.
- Confidence managing diverse calls independently with minimal supervision.
- Constructive engagement with newer trainees.
- Contribution to a collaborative and professional department.

## 27. Ride-Alongs and Volunteers

- Certified medics and above may take ride-alongs. Taking one is never mandatory and you may decline.
- Change your callsign to reflect a ride-along and notify other units on duty.
- Ride-alongs must wear a visible high-visibility vest.
- Anyone may be a ride-along provided they have no violent felonies. A criminal record alone is not a disqualifier.
- Ride-alongs may not carry any weapon.
- Ride-alongs may leave the ambulance on scene only with the medic's permission. They may assist but must not interfere with treatment.
- During 52s, 13s and 14s, ride-alongs remain in the ambulance and do not interfere with the police scene.
- Ride-alongs are expected to behave professionally and must not negatively affect anyone's ability to work or receive treatment. End the ride-along if they do.

## 28. Uniform and Appearance

The uniform is how the city identifies us. It prevents accidents, de-escalates situations, and marks us as neutral. Command may ask anyone to change if their outfit is unfit for duty.

### 28.1 Standards

- The official department uniform is worn on duty, with the colour variant matching your rank tier as set out in the companion rank document.
- A stethoscope is worn with all uniform variants.
- Disposable gloves are equipped at all times.
- Fully enclosed shoes are mandatory. Heels, open toes, socks alone and bare feet are not permitted.
- Shirts must cover the torso.
- Pants and shoes otherwise allow personal choice, so long as it is work-appropriate.
- Certification uniforms — flight, water, fire, hazmat — are worn when operating in that role and are otherwise not worn.
- Doctors wear formal clothing or surgical scrubs, with a stethoscope and gloves.

> Medics work around explosions and shrapnel, blood and human material, ladders and cliff faces, and water rescues. Dress like someone who might have to do any of those in the next ten minutes.

### 28.2 Casual days

- Casual Fridays, weekends and events may relax the uniform requirement at Command's discretion.
- Even on a casual day you must remain clearly identifiable as EMS, and the essential items above still apply.

### 28.3 Off duty

Do not wear an EMS or doctor uniform while off duty. Impersonating on-duty medical staff is a disciplinary matter.

## 29. Discipline

The Disciplinary Action Point system tracks rule violations and misconduct consistently, so that consequences are predictable rather than personal.

### 29.1 How points work

- Disciplinary Action Points (DAP) are issued from 1 to 10 depending on the situation, and remain active for 30 days before falling off.
- Points are issued by Command and above. Senior field personnel may recommend them.
- Any medic may raise an issue through the chain of command and recommend retraining.
- On-duty performance issues should be addressed by retraining first. Command retains the right to require retraining as a disciplinary measure.

### 29.2 Thresholds

- At 5 DAP, a mandatory 24-hour administrative suspension is imposed.
- Each additional point after 5 adds a further 24-hour suspension.
- At 10 DAP, an automatic indefinite suspension applies pending a High Command panel.
- A medic may also be suspended administratively while an investigation is ongoing. A suspended medic may not come on duty.
- Severe infractions, continued disregard for procedure, or abuse of the suspension system result in termination. Command retains the right to terminate at any time.

### 29.3 Violation tiers

These are minimums. Actual outcomes vary with severity and repetition.

| Tier | Points | Examples |
| --- | --- | --- |
| Minor | 1 DAP | Failure to submit or correctly complete paperwork on time. Inappropriate use of department equipment or resources. Minor uniform infractions. Failure to follow the chain of command. Failure to follow SOPs. Lesser conduct unbecoming. |
| Moderate | 3 DAP | Insubordination or failure to follow a direct order. Misuse of authority. Misconduct or negligence. Non-serious conduct unbecoming. |
| Major | 5 DAP | Serious breach of confidentiality. Falsifying reports or tampering with evidence. Corruption or bribery. Criminal behaviour such as theft or assault. Gross misconduct or gross negligence. |
| Cardinal | Termination | Any form of MDT corruption. Conviction of a violent felony. Selling or distributing department equipment or medication. Severe or repeated abuse of the allowlist. |

## 30. Command and Chat Reference

| Command | Function |
| --- | --- |
| /callsign [callsign] | Sets or updates your callsign in the city. |
| /dutyon ems | Signs on duty. Use only after a disconnect — otherwise clock in at the terminal. |
| /911r [ID] [message] | Replies to a 911 call. |
| /311r [ID] [message] | Replies to a 311 call. |
| /page | Pages a doctor on duty. |
| /clear | Clears all call markers from your GPS. |
| /oocl [message] | Out-of-character local. Used for perma confirmation and consent checks. |
| /me [action] | Emote. Supports speech, never replaces it. |

Vehicle controls default to Q for lights and Alt for sirens. Specialty vehicle and equipment commands are covered during the relevant certification training.

## Appendix A — Field Quick Reference

**On every scene**

1. DRCAB — Danger, Response, Circulation, Airway, Breathing.
2. Control catastrophic bleeding first.
3. Treat only what the patient or Nancy tells you.
4. Talk to your patient throughout.
5. Stabilise, then transport or release.
6. Report it before you clock off.

**Triage at a glance**

| Red | Yellow | Green | White | Black |
| --- | --- | --- | --- | --- |
| Critical, transport now | Stable, needs hospital | Walking wounded | First aid only | Expectant / deceased |

**Priority order**

14-A > 14-B > 13-A > 13-B > 10-47

**Codes you will use hourly**

10-41 on duty · 10-42 off duty · 10-76 en route · 10-23 on scene · 10-24 complete · 10-8 back in service · 10-7 short break · 10-12 staging · 10-78 emergency backup · Code 4 safe to enter

**Absolute rules**

- Never enter an active scene before Code 4.
- Never declare a death — only a doctor or Nancy can.
- Never treat an injury you were not told about.
- Never confirm a perma without asking twice out of character.
- Never sell or give away department equipment or medication.
- Never leave the fleet unrepaired or unfuelled.

## Appendix B — Document Control and Changelog

**Document control**

| Field | Value |
| --- | --- |
| Document | Nexus Emergency Medical Services — Standard Operating Procedures |
| Version | 1.0 |
| Owner | EMS High Command |
| Applies to | All allowlisted EMS personnel |
| Companion documents | Rank Structure and Promotion Criteria; Callsign Register; Treatment Cheat Sheet |
| Review cycle | Reviewed by Command on change of policy or by request |

**Changelog**

**Version 1.0 — Initial consolidated release**

- Consolidated all previously separate EMS, general medical, field training, air rescue and scenario documents into a single set of procedures.
- Unified conduct, powergaming, toxicity and read-the-room standards into one standards-of-conduct section.
- Standardised dispatch, radio codes, call priority and response examples across the department.
- Merged the two previous treatment guides into a single set of treatment procedures, and consolidated Code Blue into one protocol covering field and hospital response.
- Restructured medication and equipment authority into scope-of-practice tiers pending publication of the rank structure.
- Consolidated ICU admission and discharge, declaration of death, DOA processing and perma procedure.
- Combined the mandatory reporting, confidentiality and records release policies into one confidentiality and reporting framework.
- Merged fleet, air rescue, certification and training procedures, and added a consolidated discipline framework.
- Rank structure, promotion criteria and callsign allocation deliberately excluded, to be issued as a companion document.

*Future amendments are recorded here with date, section and a one-line summary of what changed.*
`;

async function main() {
  const existing = await prisma.sopDocument.findFirst({ where: { title: TITLE } });

  if (existing) {
    await prisma.sopDocument.update({
      where: { id: existing.id },
      data: { content: CONTENT },
    });
    console.log(`Updated existing "${TITLE}" (${existing.id}).`);
    return;
  }

  const maxOrder = await prisma.sopDocument.aggregate({ _max: { order: true } });
  const doc = await prisma.sopDocument.create({
    data: {
      title: TITLE,
      content: CONTENT,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  console.log(`Created "${TITLE}" (${doc.id}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
