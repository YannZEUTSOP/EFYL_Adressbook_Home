#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  EFYL Digital Address Book Sprint S4: 
  1. Survey wizard must START with "Household or Commerce?" choice and bifurcate steps accordingly.
  2. Commerce addresses must be PUBLIC (visible to everyone) — household addresses stay private.
  3. Generate comprehensive bilingual prompt + Excel QA script.

backend:
  - task: "GET /api/commerces public endpoint"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New endpoint returns all addresses where is_commerce=true, regardless of owner_id. Needs testing."
  - task: "POST /api/surveys sets is_commerce on address when survey_type=commerce"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "When survey_type='commerce', the linked address must be flagged is_commerce=true so it becomes public."
  - task: "GET /api/addresses includes public commerces from other owners"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "By default include_public_commerces=true, so users see other people's commerce addresses too. Verify no household leak."

frontend:
  - task: "Survey wizard typeChoice step (Household vs Commerce)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/survey/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "First step now shows two cards. Selecting Household routes through 19 steps; Commerce routes through 3 steps."
  - task: "Home screen Community Commerces section"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New section displays public commerces fetched from /api/commerces below user's own addresses."
  - task: "Map tab community commerces toggle"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/map.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Orange storefront pins for community commerces, toggleable."
  - task: "AddressCard commerce badge"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/AddressCard.tsx"
    stuck_count: 0
    priority: "low"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Small orange storefront badge displayed next to contact name when is_commerce=true."

metadata:
  created_by: "main_agent"
  version: "2.1.0"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "GET /api/commerces public endpoint"
    - "POST /api/surveys sets is_commerce on address when survey_type=commerce"
    - "GET /api/addresses includes public commerces from other owners"
    - "Survey wizard typeChoice step (Household vs Commerce)"
    - "Home screen Community Commerces section"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Offline Maps feature (June 2026): /offline-maps screen (download OSM tiles per city, radius 2/5/10km, zooms 12-17),
      offlineTiles.ts service, LeafletMap offlineMode prop (GridLayer + RN bridge serving local tiles when offline).
      Frontend tested iteration_5.json: 7/7 pass, no regressions. Native tile download requires device (Expo Go/build), not web.
  - agent: "main"
    message: |
      Sprint S4 implementation complete. Critical changes:
      1. Survey wizard now starts with typeChoice; chose Household → 19 steps; Commerce → 3 steps.
      2. /api/commerces endpoint added; /api/addresses now merges public commerces.
      3. AppContext fetches publicCommerces via Api.listCommerces() and merges in Home + Map.
      4. Bilingual QA Excel + comprehensive prompt generated in /app/memory/.
      Test focus: confirm public commerce isolation (households stay private), survey bifurcation flow, sync.
      Mock OTP: 123456. Test user phone: +237 600 000 000.

agent_communication_v4:
  - agent: "main"
    message: |
      Iteration 7 (Message-241 batch): all items validated by testing agent — 13 new backend tests
      (tests/test_efyl_v4_batch7.py), 70/70 total; frontend 12/12 (admin PIN gate, heritage wizard,
      back-preserves-answers, lieux fréquentés, draft resume, compass text, step-4 CTA labels,
      blank-screen bugfix on remote public address). Post-test security fix applied by main agent:
      GET /api/addresses/{id} fallback now only returns community-visible records
      (is_commerce/is_public/is_heritage) — private households 404 cross-owner. Re-verified: 70/70 pass.

agent_communication_v5:
  - agent: "main"
    message: |
      Iteration 8: quota crash root-cause fix (PhotoStore + startup migration) and account system
      (phone+PIN, EFYL ID, JWT restore) both validated green by testing agent (23/23 new backend tests
      in tests/test_efyl_v5_account.py; frontend migration validated end-to-end incl. saturated-device
      repair). Post-review: /restore user projection made explicit. Test account: +237699000111 /
      PIN 1234 / EFYL-90AF88. OTP still MOCKED (123456).

agent_communication_v6:
  - agent: "main"
    message: |
      Iteration 9 (data-quality batch): all green — 109/109 backend (new tests/test_efyl_v6_batch9.py),
      frontend flows validated (admin search, QR survey CTA, kitchen hint, persons count banner,
      places required, workers/capacity/usage/hours public+commerce). Azimuth step-3 guard verified
      via source (web GPS flaky under Playwright). Legacy test_s4_bifurcation updated for heritage.

agent_communication_v6_1:
  - agent: "main"
    message: |
      Enriched CSV export added (read-only copy, auto_completed column): 611 azimuths recovered from
      photo bearings, legacy frequented_place text converted to places, 3 orphan surveys re-attached.
      CSV survey lookup now owner-first. Verified on production data via curl; 109/109 pytest green.

agent_communication_v7:
  - agent: "main"
    message: |
      v7 batch (June 2026) — TWO new features, ready for full test:
      (A) RÉPERTOIRE EFYL (public directory + search):
          Backend routes/directory.py + shared.py:
            GET /api/directory/summary
            GET /api/directory/entries?category=household|commerce|public|heritage&q=&sort=name|near|recent&limit=&offset=&lat=&lng=
            GET /api/directory/entry/{address_id}
            POST /api/admin/import/matricules?pin=237237  body {csv_text, dry_run}
          New Address fields: matricule, nav_lat, nav_lng, nav_note (+ 4 new CSV columns before quality_issues in both exports).
          PRIVACY CONTRACT (must be verified): a household entry MUST NOT return any survey data
          (no persons, income, phones, materials, total_persons). Commerce/public/heritage return their
          public fields only. Households also must not expose contact_phone.
          Frontend: new 5th tab app/(tabs)/directory.tsx, app/directory/list/[category].tsx,
          app/directory/fiche/[id].tsx, admin CSV import UI in app/admin.tsx.
      (B) GUEST IDENTITY bound to the device — routes/guest.py:
            POST /api/guest/register {name, device_hash, device_id, device_label}
            POST /api/guest/device-check {device_hash}
            POST /api/guest/lookup {name, device_hash}
            POST /api/guest/login {pin, ref|guest_id, device_hash}
          Rules: server-generated 4-digit PIN (weak PINs excluded), bcrypt, guest_id EFYL-G-XXXXXX,
          lookup by first name is case/accent-insensitive and returns MASKED ids + opaque 15-min `ref`,
          5 wrong PINs → 429 lock 15 min, device_hash registered in users.devices[], /api/restore works
          with the guest token, user_id = guest-<device_id> when free (data continuity).
          Frontend login.tsx modes: guest-choice / guest-new / guest-done / guest-lookup / guest-pin,
          Profile shows guest id + revealable PIN, offline creation stored in prefs.pendingGuestName and
          finalised by AppContext.ensurePendingGuest() when the network returns.
      Already smoke-tested by main agent (web preview): categories 1108/84/39/15, search "alimentation"
      84→12, fiche renders (photo, azimut, nav CTA), guest creation returned EFYL-G-FEECBB / PIN 6069.
      Existing suites (109 tests) must stay green — no old endpoint was modified except the CSV headers.

agent_communication_v7_1:
  - agent: "main"
    message: |
      User audit question ("why 2148 in Admin but 1246 in Directory?") → real bug found in MY design
      assumption, now fixed. Verified on production data: 2148 address rows for only 1166 distinct
      codes; 363 codes are shared by 2-8 DIFFERENT buildings (49 m to 1247 m apart, different
      surveyors); no (code, owner) duplicate exists; 77 codes span 2 categories. The code is derived
      from quartier+secteur+rue+maison typed by hand (buildAddressId) → collisions between teams.
      FIX: routes/directory.py no longer groups by address_id. One record per recorded building, key =
      immutable doc uuid `id` (2148 distinct). Counts now match Admin exactly (2003/89/41/15 = 2148).
      /api/directory/entry/{key} accepts the uuid (new) or the address code (fallback). New response
      fields: key, surveyor, shared_code + UI warning banner and "Relevé par X • date" line.
      Index cache TTL 45s → 10s (full rebuild measured at ~50 ms). tests/test_efyl_v7_directory_guest.py
      pagination test updated to compare `key` instead of `address_id`. Full suite re-run: 142/142 green.
      ZZ* test rows purged, production data untouched (matricule/nav_* still empty everywhere).
      OPEN DATA DEBT for the user to decide: address code is not unique (1345/2148 buildings involved).
