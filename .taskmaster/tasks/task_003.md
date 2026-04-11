# Task ID: 3

**Title:** Configure Row Level Security Policies

**Status:** pending

**Dependencies:** 2

**Priority:** high

**Description:** Enable RLS on all 7 tables and create ownership-based policies. Users can only access data belonging to businesses they own (auth.uid() = businesses.user_id).

**Details:**

Enable RLS on: businesses, team_members, documents, obligations, transactions, bank_statement_uploads, generated_documents.

Policy pattern:
- businesses: USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
- All other tables: USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())) WITH CHECK (same)

Create SELECT, INSERT, UPDATE, DELETE policies for each table. Ensure no data leaks between users.

**Test Strategy:**

Create two test users. Insert data for User A. Verify User B cannot SELECT, UPDATE, or DELETE User A's data. Test with Supabase client using both user tokens.
