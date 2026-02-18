---
name: request-my-ehi
description: Help a patient request their complete Electronic Health Information (EHI) Export from their healthcare provider. Supports Epic and 70+ other certified EHR vendors. Explains what EHI is, why it matters, identifies the provider's EHR system, generates a vendor-specific appendix, guides through gathering details, finding forms, and producing a ready-to-submit PDF package.
argument-hint: [provider-name]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch, Task
---

# Request My EHI Export

## Background: What Is an EHI Export and Why Does It Matter?

Every patient has a right to their complete medical record. In practice, when patients request "their records," they usually get a small, curated summary (a CCDA document or MyChart printout) that omits the vast majority of the data their provider actually stores about them.

The **EHI Export** is different. It's a certified feature (ONC § 170.315(b)(10)) that all EHR vendors have been required to support since December 31, 2023. It produces a **bulk export of all structured data** in a patient's record -- the format varies by vendor (TSV files for Epic, CSV/NDJSON/SQL for others) but the result is the same: the closest thing to a complete copy of everything the provider's system knows about the patient.

Most patients don't know this feature exists, and many providers haven't used it before. Your job is to be a knowledgeable, patient, and supportive guide -- helping the patient understand what they're asking for, why they're entitled to it, and how to navigate any friction they encounter.

This skill supports **Epic** and **70+ other certified EHR vendors**. You can identify the vendor from the patient's portal URL or provider name, then generate vendor-specific documentation.

### Key concepts to convey to the patient

- **EHI Export is NOT the same as a CCDA, patient portal download, or standard records release.** Those are summaries. The EHI Export is the full database extract.
- **It's their legal right.** HIPAA's Right of Access (45 CFR § 164.524) entitles patients to receive their PHI in the electronic form and format they request, if readily producible. Since EHI Export is a built-in certified feature, it is readily producible.
- **Refusing is potentially information blocking.** Under the 21st Century Cures Act (45 CFR Part 171), declining to use an available, certified export feature when a patient requests it could constitute information blocking.
- **The provider must act within 30 days** (with one 30-day extension if they notify the patient in writing).
- **Patient identifiers should NOT be encrypted** in the patient's own copy -- since it's their data, encrypted IDs make it unusable.
- **Every certified EHR has this feature.** The format varies by vendor -- Epic uses TSV, others use CSV, NDJSON, SQL, etc. -- but the legal requirement is the same across all vendors.

## What You're Producing

A **ready-to-submit PDF package** consisting of:
1. An authorization/release form filled out with the patient's details -- ideally the provider's own ROI form, or our generic HIPAA-compliant authorization if the provider's form isn't available
2. An appendix (page 2) explaining what EHI Export is, the legal basis, and step-by-step instructions for the provider's IT team to produce it

## Step 1: Understand the Patient's Situation

Start by understanding where the patient is in the process:
- Do they know which provider they want to request from?
- Have they requested records before? Do they know what they got (probably a CCDA)?
- Are they comfortable with the process, or do they need more explanation about what EHI is and why it's different?

Be ready to explain things in plain language. Many patients are frustrated because they've asked for "all my records" before and received an incomplete summary. Validate that experience and explain how the EHI Export addresses it.

## Step 2: Identify the EHR Vendor

Figure out which EHR system the provider uses. This determines the vendor-specific details in the appendix (export format, documentation URL, entity counts, etc.).

### How to identify the vendor

1. **Ask the patient** -- they may know (e.g., "we use Epic" or "we use athena")
2. **Check their patient portal URL** -- the portal domain often reveals the vendor:
   - `mychart.*` or `*.epic.com` → Epic
   - `*.athenahealth.com` or `*.athenanet.athenahealth.com` → athenahealth
   - `*.eclinicalworks.com` → eClinicalWorks
   - `*.nextgen.com` → NextGen
   - `*.allscripts.com` or `*.veradigm.com` → Veradigm/Allscripts
   - `*.elationhealth.com` → Elation Health
   - `*.drchrono.com` → DrChrono
   - `*.kareo.com` → Kareo/Tebra
   - `*.advancedmd.com` → AdvancedMD
   - `*.modmed.com` → Modernizing Medicine
3. **Search the web** for `"[provider name]" EHR` or `"[provider name]" "electronic health record"` or `"[provider name]" "patient portal"`
4. **Check CHPL** (ONC Certified Health IT Product List) if needed

### Look up vendor details

Use the vendor database at `https://joshuamandel.com/ehi-export-analysis/data/vendors.json` (71 vendors with detailed export information). The lookup script makes this easy:

```bash
node <skill-dir>/scripts/lookup-vendor.mjs "athena"
```

This returns the vendor's:
- **Product name** and developer
- **Export formats** (CSV, NDJSON, TSV, SQL, etc.)
- **EHI documentation URL** -- the official vendor page documenting their export
- **Entity/field counts** -- how many data tables and fields the export includes
- **Grade and coverage** -- quality assessment of the export
- **Analysis report URL** -- a detailed markdown report you can fetch for deeper details

If the vendor has an analysis report, fetch it to learn:
- How the export is produced (UI-based? API? bulk?)
- What data categories are included (clinical, billing, scheduling, etc.)
- Any quirks or limitations
- Specific instructions for the provider's IT team

```bash
# The analysis report URL follows this pattern:
# https://joshuamandel.com/ehi-export-analysis/data/analyses/{slug}.md
```

### If you can't identify the vendor

If the patient doesn't know and you can't determine the vendor, default to generic language in the appendix. The legal requirements are the same regardless of vendor -- every certified EHR must support EHI Export.

## Step 3: Gather Patient Details

Ask the patient for their information. They can either:
- **Upload a file** (e.g., a FHIR Patient resource JSON, or any structured file with their details)
- **Provide details directly** in conversation

You need:
- Full name
- Date of birth
- Street address, city, state, zip
- Phone number
- Email address

If they provide a FHIR Patient resource or similar file, extract all details from it. Confirm the details with the patient before proceeding.

## Step 4: Find and Obtain an Authorization Form

Using the provider's own ROI (Release of Information) form is ideal -- it reduces friction because the records department recognizes their own paperwork. But it's not required. HIPAA just requires a valid written authorization with specific elements (45 CFR 164.508). If you can't find the provider's form, use our generic authorization template instead.

### Strategy A: Find the provider's own form

Help the patient get this form through multiple approaches:

1. **Ask if they have it already** -- they may have downloaded it from their provider's website or picked one up at the office.
2. **Search the web** with several query variations:
   - `"[provider name]" "authorization" "release" "protected health information" filetype:pdf`
   - `"[provider name]" "medical records" "release form" filetype:pdf`
   - `"[provider name]" "ROI" OR "release of information" form filetype:pdf`
   - `site:[provider-domain] authorization release`
3. **Navigate the provider's website** -- look for sections like:
   - "Patients & Visitors" / "Patient Resources" / "Forms"
   - "Medical Records" / "Health Information Management (HIM)"
   - "Release of Information" / "Request Your Records"
4. **Check if the provider is part of a larger health system** -- the form may be on the parent system's website rather than the individual clinic's.
5. **Look for the provider's patient portal** -- some portals have downloadable forms.

Download the PDF form to `/tmp/provider_form.pdf`.

### Strategy B: Use the generic authorization form

If the provider's own form can't be found, use the generic HIPAA-compliant fillable PDF at `templates/authorization-form.pdf`. This is a proper interactive PDF form with labeled fields that any user could open and fill in a standard PDF reader. It includes all elements required by 45 CFR 164.508:
- Description of information to be disclosed
- Who is authorized to make the disclosure
- Who the disclosure is to
- Purpose of the disclosure
- Expiration date or event
- Patient's right to revoke
- Signature and date

To use it programmatically, copy it to `/tmp/provider_form.pdf` and fill it with pdf-lib's form field API -- the same approach used for provider forms:
```javascript
const form = doc.getForm();
form.getTextField('patientName').setText(patient.name);
form.getTextField('dob').setText(patient.dob);
form.getCheckBox('ehiExport').check();
// ... etc
form.flatten();
```

The generic form is clean and professional. Let the patient know you're using a standard authorization form and explain that providers are legally required to accept any valid HIPAA authorization -- they cannot insist on their own form.

### Either way, also suggest the patient:
- Call the provider's medical records department to confirm the best way to submit
- Ask about turnaround time and preferred delivery method (fax, mail, in person, portal)

## Step 5: Find the Provider's Fax Number and Address

While searching for the form, also look for the provider's **medical records / HIM department fax number and mailing address**. The patient will need these to submit the completed request. Search for:
- `"[provider name]" "medical records" fax`
- `"[provider name]" "release of information" fax`
- `"[provider name]" "HIM" OR "health information management" fax`

Note these for the delivery guidance at the end.

## Step 6: Fill the Authorization Form

If you used the **generic authorization template** (Strategy B), the form is already filled -- the placeholders were substituted before rendering to PDF. Skip ahead to Step 6 (signature) or Step 7 (appendix) as appropriate. The signature placeholder `{{SIGNATURE}}` in the generic form can be left blank if the patient will print and sign, or you can overlay a signature image after rendering.

If you're working with the **provider's own PDF form**, continue below.

First, install pdf-lib if needed:
```bash
npm install --prefix /tmp pdf-lib
```

Use the reference script at `scripts/list-form-fields.mjs` to enumerate all form fields:
```bash
node <skill-dir>/scripts/list-form-fields.mjs /tmp/provider_form.pdf
```

This will show each field's type, name, current value, and widget position (x, topY, width, height). Use this to understand the form's structure.

Then write a script to fill the form using pdf-lib's form field API. Map fields intelligently:

- **Patient name fields**: Look for fields containing "name", "patient" -- note that field names are sometimes misleading (e.g., "Address" might actually be the patient name field if it's the first field at the top). Use widget positions to disambiguate.
- **Date of birth**: Fields with "birth", "dob", "date of birth"
- **Address fields**: "street", "address", "city", "state", "zip"
- **Provider/facility fields** (the "I authorize" section): Fill with the provider's own name and address
- **Recipient fields** (the "Release to" section): Fill with the patient's name and address (they are requesting their own records), appending "(myself)" to the name
- **Email/fax fields**: Patient's email
- **PHI description**: Write "See Appendix A (attached)" -- use drawText if no form field exists for this area
- **Purpose checkboxes**: Check "Personal" and/or "Other" (with text "See Appendix A"). Determine checkbox purpose by examining widget positions relative to form layout.
- **Include Images**: Check if available
- **Date fields**: Today's date
- **Signature**: Handle in the next step

Always flatten the form after filling so fields render as static text.

**Important**: Only include page 1 of the provider's form (skip "Additional Information" or "For Office Use Only" pages unless the patient specifically needs them).

## Step 7: Handle Signature

There are three options for getting the patient's signature, in order of preference:

### Option A: Live E2EE Signature Capture (Recommended)

If the EHI relay server is available, use encrypted live signature capture. This lets the patient draw their signature on their phone or computer -- it's encrypted end-to-end so the server never sees the signature.

1. Create a signature session:
```bash
node <skill-dir>/scripts/create-signature-session.mjs <server-url> \
  --authorization-text "I, [Patient Name], authorize [Provider] to release..." \
  --signer-name "[Patient Name]"
```
This outputs JSON with `sessionId`, `signUrl`, `privateKeyJwk`, and `authorizationTextHash`.

2. Share the `signUrl` with the patient (it opens a mobile-friendly signing page).

3. Poll for completion (run in background):
```bash
node <skill-dir>/scripts/poll-signature.mjs <server-url> <session-id> '<private-key-jwk>' \
  --output-dir /tmp --expected-hash <hash>
```
This writes `/tmp/signature.png` (transparent background) and `/tmp/signature-metadata.json` when the patient signs.

4. Embed the signature PNG on the form using `page.drawImage()` as in Option B below.

### Option B: Signature Image Upload

Ask the patient if they have a signature image to embed. If they provide one:
1. Make white pixels transparent: `convert input.png -fuzz 20% -transparent white /tmp/signature-transparent.png` (or use `magick` depending on the ImageMagick version available)
2. Embed the transparent PNG on the signature line using `page.drawImage()`
3. Scale to approximately 28-30px height, positioned just above the signature label line
4. Remove the PDF's signature form field (if any) so it doesn't overlay the image

### Option C: Print and Sign

If they don't have a signature image and live capture isn't available, let them know they'll need to print the final PDF and sign by hand before submitting.

## Step 8: Generate the Appendix

The appendix contains no patient-specific information -- it explains what an EHI Export is, the legal basis, how to produce it, and delivery preferences.

### For Epic providers

Use the pre-built static PDF at `templates/appendix.pdf`. Just copy it to `/tmp/appendix.pdf`.

### For non-Epic providers

Generate a vendor-specific appendix using the `scripts/generate-appendix.mjs` script. Pass the vendor details from Step 2:

```bash
node <skill-dir>/scripts/generate-appendix.mjs '{
  "vendor": {
    "developer": "athenahealth, Inc.",
    "product_name": "athenaClinicals",
    "export_formats": ["NDJSON", "HTML", "PDF"],
    "ehi_documentation_url": "https://docs.athenahealth.com/athenaone-dataexports/",
    "entity_count": 133,
    "field_count": 6809
  }
}'
```

This generates `/tmp/appendix.pdf` with:
- The vendor's product name and developer in the request description
- The vendor's official EHI documentation URL in the reference table
- Export format details (CSV, NDJSON, etc.) and entity/field counts
- Vendor-appropriate delivery language (MyChart for Epic, generic for others)

All fields are optional -- the script gracefully falls back to generic language for any missing details.

## Step 9: Merge into Final Package

Use pdf-lib to merge:
1. Page 1 of the filled provider form
2. The appendix PDF (1 page)

The reference script at `scripts/fill-and-merge.mjs` shows the full pattern. Save the final 2-page PDF to the working directory with a descriptive name like `ehi-request-[provider].pdf`.

## Step 10: Help the Patient Submit

This is where many patients get stuck. Don't just hand them the PDF -- help them actually submit it.

1. **Fax via relay server** (recommended if available): If the EHI relay server is running and you found the provider's fax number, send the fax directly:
```bash
node <skill-dir>/scripts/send-fax.mjs <server-url> <fax-number> ./ehi-request-provider.pdf
```
This outputs a `faxId`. Check delivery status with:
```bash
node <skill-dir>/scripts/check-fax-status.mjs <server-url> <fax-id>
```
The fax outbox UI at `<server-url>/fax-outbox` shows all queued/sent faxes and their status.

2. **Fax** (manual): If you found the fax number earlier, tell them exactly where to fax. Many online fax services work if they don't have a physical fax machine.
3. **In person**: They can print and drop it off at the provider's medical records or HIM department.
4. **Mail**: Provide the mailing address if known.
5. **Patient portal**: Some providers accept ROI requests electronically -- check if this is an option.
6. **Email**: Some providers accept scanned/emailed forms -- less common but worth mentioning.

Also prepare them for potential pushback:
- The records department may not be familiar with "EHI Export" -- the appendix explains it and points them to their vendor's documentation.
- They may try to give the patient a CCDA, portal download, or printed summary instead -- the patient should politely insist on the full EHI Export, which is a specific certified feature in their EHR system.
- If the provider claims they can't do it, the patient can reference the ONC certification requirement (it's been mandatory since Dec 31, 2023) and suggest the provider contact their EHR vendor's support team.
- If the provider misses the 30-day deadline, the patient can file a complaint with the HHS Office for Civil Rights (OCR).

## Key Legal References

- **HIPAA Right of Access**: 45 CFR § 164.524
- **Information Blocking**: 45 CFR Part 171 (21st Century Cures Act)
- **ONC Certification**: § 170.315(b)(10) - EHI Export (required since December 31, 2023)
- **ONC certification test method**: https://www.healthit.gov/test-method/electronic-health-information-export
- **File a HIPAA complaint**: https://www.hhs.gov/hipaa/filing-a-complaint/index.html
- **Vendor EHI export database**: https://joshuamandel.com/ehi-export-analysis/data/vendors.json (71 vendors)

## Technical Notes

- Use pdf-lib's form field API (not coordinate-based text drawing) wherever possible
- Install pdf-lib if needed: `npm install --prefix /tmp pdf-lib`
- The appendix is a static PDF (`templates/appendix.pdf`) with no patient-specific content -- just copy and merge it
- The generic authorization form (`templates/authorization-form.pdf`) is a fillable PDF with these field names: `patientName`, `dob`, `phone`, `patientAddress`, `email`, `providerName`, `providerAddress`, `recipientName`, `recipientAddress`, `recipientEmail`, `ehiExport` (checkbox), `includeDocuments` (checkbox), `additionalDescription`, `purposePersonal` (checkbox), `purposeOther` (checkbox), `purposeOtherText`, `signature`, `signatureDate`
- When the provider's form is not a fillable PDF (no AcroForm fields), fall back to coordinate-based text drawing using drawText, but prefer form fields when available
- No browser engine (Chrome/Chromium) is required -- all PDFs are generated and manipulated with pdf-lib

## Relay Server

The optional relay server (`server/`) provides two features: E2EE signature capture and a simulated fax outbox. It runs on Bun + Hono and is **not** included in skill.zip.

### Local development
```bash
cd <skill-dir>/server && bun install && bun run dev
```
The server starts at `http://localhost:3000`. Set `BASE_URL` env var if running behind a tunnel/proxy.

### Endpoints
- `GET /health` -- health check
- `POST /api/signatures/sessions` -- create signature session
- `GET /api/signatures/sessions/:id/info` -- get session info (browser)
- `GET /api/signatures/sessions/:id/poll` -- long-poll for completion (agent)
- `POST /api/signatures/sessions/:id/submit` -- submit encrypted signature (browser)
- `GET /sign/:sessionId` -- signature capture UI
- `POST /api/fax/send` -- queue a fax
- `GET /api/fax/status/:id` -- check fax status
- `GET /api/fax/jobs` -- list all fax jobs
- `POST /api/fax/jobs/:id/simulate` -- simulate workflow events
- `GET /fax-outbox` -- fax outbox UI

### Deployment
See `server/Dockerfile` and `server/fly.toml` for Fly.io deployment. Set `BASE_URL` to the public URL.
