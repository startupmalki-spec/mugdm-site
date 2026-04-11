# Task ID: 10

**Title:** Build CR Upload Component with Camera Support

**Status:** pending

**Dependencies:** 4, 9

**Priority:** high

**Description:** Create a reusable file upload component used in onboarding Step 1 for CR document upload. Supports drag-and-drop, file picker, and native camera capture on mobile.

**Details:**

Create src/components/upload/FileUpload.tsx:
- Drag-and-drop zone with visual feedback (react-dropzone)
- File picker button
- Camera capture button (uses input accept='image/*' capture='environment' on mobile)
- Accepted formats: PDF, PNG, JPG, JPEG
- Max file size validation (configurable, 10MB for CR)
- Upload progress bar
- Preview after upload (image thumbnail or PDF icon)
- Upload to Supabase Storage vault bucket
- Returns file URL and metadata on completion
- Error states: wrong format, too large, upload failed
- Bilingual labels and error messages

**Test Strategy:**

Upload a PDF. Upload a JPG. Try uploading a .exe (should reject). Try uploading a 15MB file (should reject). Verify progress bar shows. Verify preview renders.
