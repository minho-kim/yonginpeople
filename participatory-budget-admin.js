import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/+esm";
import { TIMELINE_SUPABASE_CONFIG } from "./config.js";

const TABLE_NAME = "participatory_budget_projects";
const PRIVATE_NOTES_TABLE_NAME = "participatory_budget_private_notes";
const DRAFT_STORAGE_KEY = "yonginParticipatoryBudgetAdminDraft";
let supabaseClient = null;
let records = [];
let selectedRecordId = "";
let adminStatus = null;
let configNotice = null;
let authSection = null;
let adminSection = null;
let loginForm = null;
let loginEmail = null;
let loginPassword = null;
let loginButton = null;
let logoutButton = null;
let recordCountText = null;
let refreshButton = null;
let newRecordButton = null;
let adminSearch = null;
let recordList = null;
let recordForm = null;
let formTitle = null;
let formSubtitle = null;
let recordId = null;
let fiscalYear = null;
let proposalDate = null;
let published = null;
let projectName = null;
let district = null;
let category = null;
let description = null;
let publicNote = null;
let internalNote = null;
let sourceUrl = null;
let saveButton = null;
let deleteButton = null;

document.addEventListener("DOMContentLoaded", initializeBudgetAdmin);

async function initializeBudgetAdmin() {
  cacheElements();
  bindEvents();
  renderIcons();

  const config = getSupabaseConfig();
  if (!isSupabaseConfigured(config)) {
    showConfigNotice();
    return;
  }

  supabaseClient = createClient(config.url, config.anonKey);
  await bootstrapAuthState();
} // End of initializeBudgetAdmin

function cacheElements() {
  adminStatus = document.getElementById("budgetAdminStatus");
  configNotice = document.getElementById("budgetConfigNotice");
  authSection = document.getElementById("budgetAuthSection");
  adminSection = document.getElementById("budgetAdminSection");
  loginForm = document.getElementById("budgetLoginForm");
  loginEmail = document.getElementById("budgetLoginEmail");
  loginPassword = document.getElementById("budgetLoginPassword");
  loginButton = document.getElementById("budgetLoginButton");
  logoutButton = document.getElementById("budgetLogoutButton");
  recordCountText = document.getElementById("budgetRecordCountText");
  refreshButton = document.getElementById("budgetRefreshButton");
  newRecordButton = document.getElementById("budgetNewRecordButton");
  adminSearch = document.getElementById("budgetAdminSearch");
  recordList = document.getElementById("budgetRecordList");
  recordForm = document.getElementById("budgetRecordForm");
  formTitle = document.getElementById("budgetFormTitle");
  formSubtitle = document.getElementById("budgetFormSubtitle");
  recordId = document.getElementById("budgetRecordId");
  fiscalYear = document.getElementById("budgetFiscalYear");
  proposalDate = document.getElementById("budgetProposalDate");
  published = document.getElementById("budgetPublished");
  projectName = document.getElementById("budgetProjectName");
  district = document.getElementById("budgetDistrict");
  category = document.getElementById("budgetCategory");
  description = document.getElementById("budgetDescription");
  publicNote = document.getElementById("budgetPublicNote");
  internalNote = document.getElementById("budgetInternalNote");
  sourceUrl = document.getElementById("budgetSourceUrl");
  saveButton = document.getElementById("budgetSaveButton");
  deleteButton = document.getElementById("budgetDeleteButton");
} // End of cacheElements

function bindEvents() {
  loginForm.addEventListener("submit", handleLoginSubmit);
  logoutButton.addEventListener("click", handleLogoutClick);
  refreshButton.addEventListener("click", handleRefreshClick);
  newRecordButton.addEventListener("click", handleNewRecordClick);
  adminSearch.addEventListener("input", renderFilteredRecordList);
  recordList.addEventListener("click", handleRecordListClick);
  recordForm.addEventListener("submit", handleSaveSubmit);
  recordForm.addEventListener("input", saveFormDraft);
  recordForm.addEventListener("change", saveFormDraft);
  deleteButton.addEventListener("click", handleDeleteClick);
} // End of bindEvents

function renderIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
} // End of renderIcons

function getSupabaseConfig() {
  const rawConfig = TIMELINE_SUPABASE_CONFIG || window.TIMELINE_SUPABASE_CONFIG || {};
  return {
    url: typeof rawConfig.url === "string" ? rawConfig.url.trim() : "",
    anonKey: typeof rawConfig.anonKey === "string" ? rawConfig.anonKey.trim() : ""
  };
} // End of getSupabaseConfig

function isSupabaseConfigured(config) {
  if (!config || !config.url || !config.anonKey) {
    return false;
  }

  return !config.url.includes("YOUR_SUPABASE_URL") && !config.anonKey.includes("YOUR_SUPABASE_ANON_KEY");
} // End of isSupabaseConfigured

function showConfigNotice() {
  configNotice.classList.remove("d-none");
  authSection.classList.add("d-none");
  adminSection.classList.add("d-none");
  setStatus("config.js의 Supabase 공개 키 설정을 확인해 주세요.", "warning");
} // End of showConfigNotice

async function bootstrapAuthState() {
  setStatus("로그인 상태를 확인하는 중입니다.", "neutral");
  const response = await supabaseClient.auth.getSession();

  if (response.error) {
    setStatus(response.error.message, "danger");
    showUnauthenticatedState();
    return;
  }

  supabaseClient.auth.onAuthStateChange(handleAuthStateChange);

  if (response.data && response.data.session) {
    await handleAuthenticatedSession(response.data.session.user);
    return;
  }

  showUnauthenticatedState();
} // End of bootstrapAuthState

async function handleAuthStateChange(eventName, session) {
  if (eventName === "SIGNED_IN" && session && session.user) {
    await handleAuthenticatedSession(session.user);
    return;
  }

  if (eventName === "SIGNED_OUT") {
    showUnauthenticatedState();
  }
} // End of handleAuthStateChange

async function handleAuthenticatedSession(user) {
  const isAdmin = await checkCurrentUserIsAdmin(user);

  if (!isAdmin) {
    showUnauthorizedState(user);
    return;
  }

  await showAuthenticatedState(user);
} // End of handleAuthenticatedSession

async function checkCurrentUserIsAdmin(user) {
  const userId = user && user.id ? String(user.id) : "";

  if (!userId) {
    return false;
  }

  const response = await supabaseClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (response.error) {
    setStatus(response.error.message, "danger");
    return false;
  }

  return Boolean(response.data && response.data.user_id);
} // End of checkCurrentUserIsAdmin

async function handleLoginSubmit(event) {
  event.preventDefault();
  setLoginBusy(true);
  setStatus("로그인 중입니다.", "neutral");
  const response = await supabaseClient.auth.signInWithPassword({
    email: loginEmail.value.trim(),
    password: loginPassword.value
  });
  setLoginBusy(false);

  if (response.error) {
    setStatus(response.error.message, "danger");
    return;
  }

  setStatus("로그인되었습니다.", "success");
} // End of handleLoginSubmit

async function handleLogoutClick() {
  setStatus("로그아웃 중입니다.", "neutral");
  const response = await supabaseClient.auth.signOut();

  if (response.error) {
    setStatus(response.error.message, "danger");
    return;
  }

  showUnauthenticatedState();
} // End of handleLogoutClick

async function showAuthenticatedState(user) {
  const email = user && user.email ? user.email : "관리자";
  configNotice.classList.add("d-none");
  authSection.classList.add("d-none");
  adminSection.classList.remove("d-none");
  resetFormForNewRecord();
  setStatus(`${email} 계정으로 접속 중입니다.`, "success");
  await loadRecords();
  restoreFormDraft();
} // End of showAuthenticatedState

function showUnauthenticatedState() {
  authSection.classList.remove("d-none");
  adminSection.classList.add("d-none");
  loginPassword.value = "";
  setStatus("관리자 계정으로 로그인하세요.", "neutral");
} // End of showUnauthenticatedState

function showUnauthorizedState(user) {
  const email = user && user.email ? user.email : "현재 계정";
  authSection.classList.remove("d-none");
  adminSection.classList.add("d-none");
  loginPassword.value = "";
  setStatus(`${email}은 관리자 목록에 없습니다.`, "danger");
} // End of showUnauthorizedState

async function loadRecords() {
  setListBusy(true);
  const response = await supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .order("fiscal_year", { ascending: false })
    .order("proposal_date", { ascending: false })
    .order("created_at", { ascending: false });
  setListBusy(false);

  if (response.error) {
    records = [];
    renderRecordList([]);
    setStatus(getErrorMessage(response.error), "warning");
    return;
  }

  const notesResponse = await supabaseClient
    .from(PRIVATE_NOTES_TABLE_NAME)
    .select("project_id,internal_note");
  const privateNotes = notesResponse.error ? [] : notesResponse.data || [];
  records = mergePrivateNotes(normalizeRecords(response.data || []), privateNotes);
  renderFilteredRecordList();

  if (notesResponse.error) {
    setStatus("사업 목록은 불러왔지만 내부 메모 연결은 아직 준비되지 않았습니다.", "warning");
  }

  if (selectedRecordId) {
    selectRecordById(selectedRecordId, false);
  }
} // End of loadRecords

function renderFilteredRecordList() {
  const query = normalizeSearchText(adminSearch.value);
  const filteredRecords = [];

  for (let index = 0; index < records.length; index += 1) {
    if (!query || buildSearchHaystack(records[index]).includes(query)) {
      filteredRecords.push(records[index]);
    }
  }

  renderRecordList(filteredRecords);
} // End of renderFilteredRecordList

function renderRecordList(nextRecords) {
  recordList.innerHTML = "";
  recordCountText.textContent = `현재 ${records.length}개의 제안이 있습니다.`;

  if (!nextRecords.length) {
    const empty = document.createElement("div");
    empty.className = "empty-records";
    empty.textContent = records.length ? "검색 조건에 맞는 제안이 없습니다." : "등록된 주민참여예산 제안이 없습니다.";
    recordList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < nextRecords.length; index += 1) {
    fragment.appendChild(createRecordButton(nextRecords[index]));
  }

  recordList.appendChild(fragment);
} // End of renderRecordList

function createRecordButton(record) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = selectedRecordId === record.id ? "record-button is-active" : "record-button";
  button.dataset.recordId = record.id;

  const date = document.createElement("div");
  date.className = "record-date";
  date.textContent = `${record.fiscal_year}년 · ${record.proposal_date ? formatDate(record.proposal_date) : "접수일 미정"}`;

  const title = document.createElement("div");
  title.className = "record-title";
  title.textContent = record.project_name || "제목 없음";

  const meta = document.createElement("div");
  meta.className = "record-meta";
  meta.textContent = [record.district, record.category].filter(Boolean).join(" · ") || "분류 없음";

  const badges = document.createElement("div");
  badges.className = "budget-record-badges";
  if (record.category) {
    appendBadge(badges, record.category, "");
  }
  appendBadge(badges, record.is_published ? "공개" : "비공개", record.is_published ? "" : "is-private");

  button.appendChild(date);
  button.appendChild(title);
  button.appendChild(meta);
  button.appendChild(badges);
  return button;
} // End of createRecordButton

function appendBadge(container, label, className) {
  const badge = document.createElement("span");
  badge.className = className || "";
  badge.textContent = label;
  container.appendChild(badge);
} // End of appendBadge

function handleRecordListClick(event) {
  const button = event.target.closest(".record-button");

  if (!button) {
    return;
  }

  selectRecordById(button.dataset.recordId || "", true);
} // End of handleRecordListClick

function selectRecordById(nextRecordId, persistDraft) {
  const record = findRecordById(nextRecordId);

  if (!record) {
    selectedRecordId = "";
    resetFormForNewRecord();
    renderFilteredRecordList();
    return;
  }

  selectedRecordId = record.id;
  renderRecordForm(record);
  renderFilteredRecordList();

  if (persistDraft) {
    saveFormDraft();
  }
} // End of selectRecordById

function renderRecordForm(record) {
  recordId.value = record.id;
  fiscalYear.value = String(record.fiscal_year);
  proposalDate.value = record.proposal_date;
  published.value = record.is_published ? "true" : "false";
  projectName.value = record.project_name;
  district.value = record.district;
  category.value = record.category;
  description.value = record.description;
  publicNote.value = record.public_note;
  internalNote.value = record.internal_note;
  sourceUrl.value = record.source_url;
  formTitle.textContent = "주민참여예산 제안 수정";
  formSubtitle.textContent = record.project_name || "저장된 제안";
  deleteButton.classList.remove("d-none");
} // End of renderRecordForm

function resetFormForNewRecord() {
  selectedRecordId = "";
  recordId.value = "";
  fiscalYear.value = String(getCurrentFiscalYear());
  proposalDate.value = "";
  published.value = "true";
  projectName.value = "";
  district.value = "";
  category.value = "";
  description.value = "";
  publicNote.value = "";
  internalNote.value = "";
  sourceUrl.value = "";
  formTitle.textContent = "새 제안";
  formSubtitle.textContent = "저장 전";
  deleteButton.classList.add("d-none");
  renderFilteredRecordList();
} // End of resetFormForNewRecord

function handleNewRecordClick() {
  clearFormDraft();
  resetFormForNewRecord();
  setStatus("새 주민참여예산 제안을 작성합니다.", "neutral");
} // End of handleNewRecordClick

async function handleRefreshClick() {
  saveFormDraft();
  await loadRecords();

  if (restoreFormDraft()) {
    setStatus("목록을 새로고침하고 작성 중이던 내용을 복원했습니다.", "neutral");
    return;
  }

  setStatus("목록을 새로고침했습니다.", "success");
} // End of handleRefreshClick

async function handleSaveSubmit(event) {
  event.preventDefault();
  const payload = buildPayloadFromForm();

  if (!payload) {
    return;
  }

  setFormBusy(true);
  const saveResult = await saveRecord(payload, internalNote.value.trim());
  setFormBusy(false);

  if (!saveResult.record) {
    return;
  }

  const savedRecord = saveResult.record;
  selectedRecordId = savedRecord.id;
  clearFormDraft();
  setStatus(
    saveResult.noteError ? "제안은 저장했지만 내부 메모 저장에 실패했습니다." : "주민참여예산 제안이 저장되었습니다.",
    saveResult.noteError ? "warning" : "success"
  );
  await loadRecords();
  selectRecordById(savedRecord.id, false);
} // End of handleSaveSubmit

function buildPayloadFromForm() {
  const yearValue = Number.parseInt(fiscalYear.value, 10);
  if (!Number.isInteger(yearValue) || yearValue < 2000 || yearValue > 2200 || !projectName.value.trim()) {
    setStatus("사업연도와 제안명은 필수입니다.", "danger");
    return null;
  }

  const sourceUrlResult = normalizeOptionalHttpUrl(sourceUrl.value);
  if (!sourceUrlResult.isValid) {
    setStatus("관련 자료 URL은 http:// 또는 https:// 주소로 입력해 주세요.", "danger");
    sourceUrl.focus();
    return null;
  }

  return {
    fiscal_year: yearValue,
    proposal_date: normalizeDateValue(proposalDate.value) || null,
    project_name: projectName.value.trim(),
    district: district.value.trim() || null,
    category: category.value.trim() || null,
    description: description.value.trim() || null,
    public_note: publicNote.value.trim() || null,
    source_url: sourceUrlResult.value,
    is_published: published.value === "true",
    updated_at: new Date().toISOString()
  };
} // End of buildPayloadFromForm

async function saveRecord(payload, privateNoteValue) {
  const currentId = recordId.value.trim();
  const query = currentId
    ? supabaseClient.from(TABLE_NAME).update(payload).eq("id", currentId).select("*").single()
    : supabaseClient.from(TABLE_NAME).insert(payload).select("*").single();
  const response = await query;

  if (response.error) {
    setStatus(getErrorMessage(response.error), "danger");
    return { record: null, noteError: response.error };
  }

  const noteError = await savePrivateNote(response.data.id, privateNoteValue);
  const savedRecord = normalizeRecord(response.data, 0);
  savedRecord.internal_note = privateNoteValue;
  return { record: savedRecord, noteError: noteError };
} // End of saveRecord

async function savePrivateNote(projectId, privateNoteValue) {
  const normalizedNote = String(privateNoteValue || "").trim();
  let response = null;

  if (normalizedNote) {
    response = await supabaseClient
      .from(PRIVATE_NOTES_TABLE_NAME)
      .upsert({
        project_id: projectId,
        internal_note: normalizedNote,
        updated_at: new Date().toISOString()
      }, { onConflict: "project_id" });
  } else {
    response = await supabaseClient
      .from(PRIVATE_NOTES_TABLE_NAME)
      .delete()
      .eq("project_id", projectId);
  }

  return response.error || null;
} // End of savePrivateNote

async function handleDeleteClick() {
  const currentId = recordId.value.trim();

  if (!currentId) {
    return;
  }

  const shouldDelete = window.confirm("이 주민참여예산 제안을 삭제할까요? 공개만 멈추려면 비공개로 바꾸는 편이 좋습니다.");
  if (!shouldDelete) {
    return;
  }

  setFormBusy(true);
  const response = await supabaseClient.from(TABLE_NAME).delete().eq("id", currentId);
  setFormBusy(false);

  if (response.error) {
    setStatus(getErrorMessage(response.error), "danger");
    return;
  }

  selectedRecordId = "";
  clearFormDraft();
  setStatus("주민참여예산 제안이 삭제되었습니다.", "success");
  await loadRecords();
  resetFormForNewRecord();
} // End of handleDeleteClick

function saveFormDraft() {
  const storage = getDraftStorage();

  if (!storage || adminSection.classList.contains("d-none")) {
    return;
  }

  const draft = {
    record_id: recordId.value.trim(),
    fiscal_year: fiscalYear.value,
    proposal_date: proposalDate.value,
    is_published: published.value,
    project_name: projectName.value,
    district: district.value,
    category: category.value,
    description: description.value,
    public_note: publicNote.value,
    internal_note: internalNote.value,
    source_url: sourceUrl.value
  };

  if (!isMeaningfulDraft(draft)) {
    clearFormDraft();
    return;
  }

  try {
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn("Failed to save participatory budget draft:", error);
  }
} // End of saveFormDraft

function restoreFormDraft() {
  const draft = readFormDraft();

  if (!draft) {
    return false;
  }

  const matchingRecord = findRecordById(draft.record_id);
  if (matchingRecord) {
    selectedRecordId = matchingRecord.id;
    renderRecordForm(matchingRecord);
  } else {
    resetFormForNewRecord();
  }

  recordId.value = matchingRecord ? matchingRecord.id : "";
  selectedRecordId = matchingRecord ? matchingRecord.id : "";
  fiscalYear.value = String(normalizeFiscalYear(draft.fiscal_year));
  proposalDate.value = normalizeDateValue(draft.proposal_date);
  published.value = String(draft.is_published) === "false" ? "false" : "true";
  projectName.value = String(draft.project_name || "");
  district.value = String(draft.district || "");
  category.value = String(draft.category || "");
  description.value = String(draft.description || "");
  publicNote.value = String(draft.public_note || "");
  internalNote.value = String(draft.internal_note || "");
  sourceUrl.value = String(draft.source_url || "");
  renderFilteredRecordList();
  setStatus("작성 중이던 주민참여예산 제안을 복원했습니다.", "neutral");
  return true;
} // End of restoreFormDraft

function readFormDraft() {
  const storage = getDraftStorage();

  if (!storage) {
    return null;
  }

  try {
    const rawDraft = storage.getItem(DRAFT_STORAGE_KEY);
    return rawDraft ? JSON.parse(rawDraft) : null;
  } catch (error) {
    console.warn("Failed to read participatory budget draft:", error);
    return null;
  }
} // End of readFormDraft

function clearFormDraft() {
  const storage = getDraftStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(DRAFT_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear participatory budget draft:", error);
  }
} // End of clearFormDraft

function getDraftStorage() {
  try {
    return window.localStorage || null;
  } catch (error) {
    console.warn("Draft storage is not available:", error);
    return null;
  }
} // End of getDraftStorage

function isMeaningfulDraft(draft) {
  if (!draft) {
    return false;
  }

  return Boolean(
    draft.record_id
    || draft.project_name
    || draft.district
    || draft.category
    || draft.description
    || draft.public_note
    || draft.internal_note
    || draft.source_url
  );
} // End of isMeaningfulDraft

function normalizeRecords(rawRecords) {
  const normalizedRecords = [];

  for (let index = 0; index < rawRecords.length; index += 1) {
    normalizedRecords.push(normalizeRecord(rawRecords[index], index));
  }

  return normalizedRecords.sort(compareRecordsNewestFirst);
} // End of normalizeRecords

function mergePrivateNotes(projectRecords, privateNotes) {
  const noteMap = new Map();

  for (let index = 0; index < privateNotes.length; index += 1) {
    const note = privateNotes[index] || {};
    noteMap.set(String(note.project_id || ""), String(note.internal_note || ""));
  }

  for (let index = 0; index < projectRecords.length; index += 1) {
    projectRecords[index].internal_note = noteMap.get(projectRecords[index].id) || "";
  }

  return projectRecords;
} // End of mergePrivateNotes

function normalizeRecord(rawRecord, index) {
  const sourceRecord = rawRecord || {};
  return {
    id: String(sourceRecord.id || `budget-${index + 1}`),
    created_at: String(sourceRecord.created_at || ""),
    updated_at: String(sourceRecord.updated_at || sourceRecord.created_at || ""),
    fiscal_year: normalizeFiscalYear(sourceRecord.fiscal_year),
    proposal_date: normalizeDateValue(sourceRecord.proposal_date),
    project_name: String(sourceRecord.project_name || ""),
    district: String(sourceRecord.district || ""),
    category: String(sourceRecord.category || ""),
    description: String(sourceRecord.description || ""),
    public_note: String(sourceRecord.public_note || ""),
    internal_note: "",
    source_url: normalizeStoredUrl(sourceRecord.source_url),
    is_published: sourceRecord.is_published !== false
  };
} // End of normalizeRecord

function compareRecordsNewestFirst(firstRecord, secondRecord) {
  if (secondRecord.fiscal_year !== firstRecord.fiscal_year) {
    return secondRecord.fiscal_year - firstRecord.fiscal_year;
  }

  const dateComparison = String(secondRecord.proposal_date || "").localeCompare(String(firstRecord.proposal_date || ""));
  if (dateComparison !== 0) {
    return dateComparison;
  }

  return String(secondRecord.created_at || "").localeCompare(String(firstRecord.created_at || ""));
} // End of compareRecordsNewestFirst

function findRecordById(nextRecordId) {
  const normalizedId = String(nextRecordId || "");

  for (let index = 0; index < records.length; index += 1) {
    if (records[index].id === normalizedId) {
      return records[index];
    }
  }

  return null;
} // End of findRecordById

function buildSearchHaystack(record) {
  return normalizeSearchText([
    record.fiscal_year,
    record.proposal_date,
    record.project_name,
    record.district,
    record.category,
    record.description,
    record.public_note,
    record.internal_note
  ].join(" "));
} // End of buildSearchHaystack

function normalizeSearchText(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
} // End of normalizeSearchText

function normalizeFiscalYear(value) {
  const numericValue = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(numericValue) && numericValue >= 2000 && numericValue <= 2200
    ? numericValue
    : getCurrentFiscalYear();
} // End of normalizeFiscalYear

function getCurrentFiscalYear() {
  return Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric" }).format(new Date()));
} // End of getCurrentFiscalYear

function normalizeDateValue(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
} // End of normalizeDateValue

function formatDate(value) {
  const normalizedDate = normalizeDateValue(value);

  if (!normalizedDate) {
    return "날짜 미정";
  }

  const parts = normalizedDate.split("-");
  return `${Number(parts[0])}년 ${Number(parts[1])}월 ${Number(parts[2])}일`;
} // End of formatDate

function normalizeOptionalHttpUrl(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return { isValid: true, value: null };
  }

  try {
    const parsedUrl = new URL(rawValue);
    const isAllowedProtocol = parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    return { isValid: isAllowedProtocol, value: isAllowedProtocol ? parsedUrl.href : null };
  } catch (error) {
    return { isValid: false, value: null };
  }
} // End of normalizeOptionalHttpUrl

function normalizeStoredUrl(value) {
  const result = normalizeOptionalHttpUrl(value);
  return result.isValid && result.value ? result.value : "";
} // End of normalizeStoredUrl

function getErrorMessage(error) {
  const message = error && error.message ? String(error.message) : "요청을 처리하지 못했습니다.";
  const code = error && error.code ? String(error.code) : "";

  if (code === "42P01" || code === "PGRST205") {
    return "주민참여예산용 Supabase 표가 아직 준비되지 않았습니다. SQL 초안을 적용하면 사용할 수 있습니다.";
  }

  return message;
} // End of getErrorMessage

function setLoginBusy(isBusy) {
  loginButton.disabled = isBusy;
  loginEmail.disabled = isBusy;
  loginPassword.disabled = isBusy;
} // End of setLoginBusy

function setListBusy(isBusy) {
  refreshButton.disabled = isBusy;
  newRecordButton.disabled = isBusy;
} // End of setListBusy

function setFormBusy(isBusy) {
  saveButton.disabled = isBusy;
  deleteButton.disabled = isBusy;
} // End of setFormBusy

function setStatus(message, type) {
  adminStatus.textContent = message || "";
  adminStatus.classList.remove("is-success", "is-danger", "is-warning", "is-neutral");
  adminStatus.classList.add(`is-${type || "neutral"}`);
} // End of setStatus
