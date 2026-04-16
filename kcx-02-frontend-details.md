# Frontend Implementation (KCX-02)

## 1. Overview
The frontend currently provides two user experiences: a public marketing site and an authenticated client workspace. Public visitors can discover product information, read blog content, and schedule a demo. Logged-in users can onboard billing data, connect AWS, analyze costs in dashboards, manage support workflows, and administer team access (role-based).

## 2. Core Features Implemented

### Public Website
- Landing and marketing content pages are implemented.
- About pages are implemented: Our Story, Leadership, Careers.
- Careers includes a visible role listing/filter experience.
- AWS integration marketing page is implemented as an informational page.

### Demo Scheduling
- A working schedule-demo journey is implemented.
- Users can submit contact/business details, pick a slot, and complete a booking flow.
- The flow includes validation and success confirmation.

### Authentication
- Login flow is implemented and routes users into the client workspace.
- Forgot password flow is implemented.
- Reset password flow is implemented with token handling.
- Route protection is implemented for authenticated areas.

### Blog & Resources
- Blog listing is implemented with search/filter behavior.
- Blog detail pages are implemented with article navigation behavior.
- Documentation page exists but functions as placeholder content only.

### Client Workspace Home
- Client overview page is implemented with clear onboarding CTAs.
- Users can start file upload or cloud connection directly from the overview.

### Billing Onboarding: Local Upload
- Users can upload billing files from local machine.
- Upload history and ingestion status are visible.
- Users can retry failed/warning uploads and open analytics from selected uploaded files.

### Billing Onboarding: S3 Import
- Users can configure S3 import details and browse/select files.
- Selected files can be imported into ingestion.
- After ingestion starts, users are routed into upload-scoped analytics.

### Cloud Connections
- Connection management view is implemented.
- AWS connection setup is implemented and actionable.
- AWS setup supports automatic and manual guided paths.
- Non-AWS providers are present as coming-soon states (not active integrations).

### Dashboards (Main)
- Main dashboard routes are implemented for cost visibility.
- Working views include overview, cost explorer, anomalies/alerts, budget, and optimization.
- Date range and filter controls are implemented and actively affect shown data.
- Budget workflows (create/edit/status) are implemented.
- Optimization includes actionable recommendation workflows in active categories.

### Upload-Scoped Dashboards
- A separate dashboard experience is implemented for uploaded billing data.
- Ingestion-progress handling is visible before analytics become available.
- Working views include overview, cost explorer, and anomalies.

### Actions Center
- AWS EC2 action center is implemented.
- Users can view instance inventory and trigger start/stop/reboot/change-type actions.
- Confirmation and result feedback behaviors are implemented.

### Support Workflows
- Ticket management is implemented with draft + submitted paths.
- Users can create tickets, view ticket details, exchange messages, and update ticket state where allowed.
- Meetings workflow is implemented with scheduling, history, cancellation, and join behavior.
- Live chat page exists but chat experience is placeholder-only.

### Team & Access (Admin)
- Admin users can invite team members, approve pending users, and activate/deactivate access.
- Search/filter and user status visibility are implemented.
- Access is role-gated in the frontend.

### User Profile
- Profile page is implemented with user identity display.
- Email notification preference toggle is present as frontend behavior.

## 3. User Flows (Frontend Perspective)

### Flow A: Visitor to Demo Request
1. User visits the public site.
2. User opens Schedule Demo.
3. User enters business/contact details.
4. User selects an available time slot.
5. User submits and sees success confirmation.

### Flow B: Login to Billing Upload Analytics
1. User logs in.
2. User lands in client workspace.
3. User uploads billing files.
4. User tracks ingestion status/history.
5. User opens upload-scoped dashboard views.

### Flow C: Login to AWS Cloud Connection
1. User logs in and opens cloud integration.
2. User adds AWS connection.
3. User follows automatic or manual setup path.
4. User completes setup and reaches success state.
5. User proceeds to dashboards/actions.

### Flow D: Cost Monitoring & Optimization
1. User opens main dashboard.
2. User sets date and dimension filters.
3. User reviews cost overview and explorer.
4. User investigates anomalies.
5. User manages budgets and takes optimization actions.

### Flow E: Support Journey
1. User opens tickets.
2. User creates ticket or draft.
3. User views details and exchanges messages.
4. User resolves/reopens/cancels when eligible.
5. User schedules or joins support meetings as needed.

### Flow F: Admin Team Access Journey
1. Admin opens Team & Access.
2. Admin invites users.
3. Admin approves pending invites.
4. Admin activates/deactivates user access.

## 4. API Interaction (High-Level)
- Authentication flows call backend services for login and password reset operations.
- Demo and meeting scheduling features call backend services for slot availability and booking actions.
- Billing upload and S3 import flows call backend services to create ingestion jobs, monitor processing, retry failures, and load upload-scoped analytics.
- Cloud connection flows call backend services to create/manage connection state and complete AWS setup.
- Dashboard features call backend services for overview, explorer, anomaly, budget, and optimization data.
- Actions center calls backend services for instance inventory and operational actions.
- Ticket workflows call backend services for creation, updates, conversation, and status transitions.
- Team & access workflows call backend services for invitation, approval, status change, and listing operations.

## 5. Scope Notes
- This document includes only visible, implemented frontend behavior.
- Placeholder/incomplete items are not treated as full features (for example: live chat window experience, non-AWS cloud integrations, documentation content depth).
