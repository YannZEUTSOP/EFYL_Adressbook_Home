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
