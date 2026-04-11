# Task ID: 12

**Title:** Build Business Profile Confirmation and Edit Page

**Status:** pending

**Dependencies:** 2, 9, 11

**Priority:** high

**Description:** Create the profile confirmation screen (onboarding Step 2) and the /app/profile page for viewing and editing business information after onboarding.

**Details:**

Onboarding Step 2 (in wizard):
- Pre-fill all fields from CR extraction response
- Editable fields: name_ar (required), name_en, cr_number (required, 10-digit validation), activity_type (required), city (required), capital, owners (JSON editor or structured form), cr_issuance_date, cr_expiry_date
- Logo upload (PNG/JPG, max 2MB, preview with crop to 512x512)
- Stamp upload (PNG/JPG, max 2MB, preview)
- Save creates businesses record in Supabase + team_member record for the owner
- Duplicate CR check: if cr_number exists, show error

/app/profile page:
- Display all business info in organized sections: Identity, Ownership, Contact, Branding
- Edit mode per section (toggle)
- Save records version in profile_history JSONB
- Logo/stamp upload with archive (old not deleted)
- Empty fields show 'Not set' with edit prompt

Bilingual field labels. Saudi phone validation for contact_phone.

**Test Strategy:**

Submit profile with pre-filled data. Verify business record created. Edit a field, verify profile_history is updated. Try duplicate CR number, verify error. Upload logo, verify preview and storage.
