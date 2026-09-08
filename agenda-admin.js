import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/+esm";
import { TIMELINE_SUPABASE_CONFIG } from "./config.js";

const TABLE_NAME = "agendas";
const DRAFT_STORAGE_KEY = "yonginAgendaAdminDraft";
const ACTIVE_STATUSES = ["discussing"];
const VALID_STATUSES = ["discussing", "dropped"];
const STATUS_LABELS = {
  discussing: "논의 중",
  dropped: "논의 중단"
};

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
let recordList = null;
let recordCountText = null;
let newRecordButton = null;
let refreshButton = null;
let agendaForm = null;
let formTitle = null;
let formSubtitle = null;
let recordId = null;
let proposedDate = null;
let agendaStatus = null;
let agendaCategory = null;
let agendaTitle = null;
let agendaDescription = null;
let statusNote = null;
let participants = null;
let participantCountPreview = null;
let agendaTags = null;
let nextMeetingDate = null;
let nextMeetingTime = null;
let nextMeetingLocation = null;
let addUpdateButton = null;
let updateRows = null;
let saveButton = null;
let deleteButton = null;

document.addEventListener("DOMContentLoaded", initializeAgendaAdmin);

async function initializeAgendaAdmin() {
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
} // End of initializeAgendaAdmin

function cacheElements() {
  adminStatus = document.getElementById("adminStatus");
  configNotice = document.getElementById("configNotice");
  authSection = document.getElementById("authSection");
  adminSection = document.getElementById("adminSection");
  loginForm = document.getElementById("loginForm");
  loginEmail = document.getElementById("loginEmail");
  loginPassword = document.getElementById("loginPassword");
  loginButton = document.getElementById("loginButton");
  logoutButton = document.getElementById("logoutButton");
  recordList = document.getElementById("recordList");
  recordCountText = document.getElementById("recordCountText");
  newRecordButton = document.getElementById("newRecordButton");
  refreshButton = document.getElementById("refreshButton");
  agendaForm = document.getElementById("agendaForm");
  formTitle = document.getElementById("formTitle");
  formSubtitle = document.getElementById("formSubtitle");
  recordId = document.getElementById("recordId");
  proposedDate = document.getElementById("proposedDate");
  agendaStatus = document.getElementById("agendaStatus");
  agendaCategory = document.getElementById("agendaCategory");
  agendaTitle = document.getElementById("agendaTitle");
  agendaDescription = document.getElementById("agendaDescription");
  statusNote = document.getElementById("statusNote");
  participants = document.getElementById("participants");
  participantCountPreview = document.getElementById("participantCountPreview");
  agendaTags = document.getElementById("agendaTags");
  nextMeetingDate = document.getElementById("nextMeetingDate");
  nextMeetingTime = document.getElementById("nextMeetingTime");
  nextMeetingLocation = document.getElementById("nextMeetingLocation");
  addUpdateButton = document.getElementById("addUpdateButton");
  updateRows = document.getElementById("updateRows");
  saveButton = document.getElementById("saveButton");
  deleteButton = document.getElementById("deleteButton");
} // End of cacheElements

function bindEvents() {
  loginForm.addEventListener("submit", handleLoginSubmit);
  logoutButton.addEventListener("click", handleLogoutClick);
  recordList.addEventListener("click", handleRecordListClick);
  newRecordButton.addEventListener("click", handleNewRecordClick);
  refreshButton.addEventListener("click", handleRefreshClick);
  agendaForm.addEventListener("submit", handleSaveSubmit);
  agendaForm.addEventListener("input", handleFormInput);
  agendaForm.addEventListener("change", handleFormInput);
  deleteButton.addEventListener("click", handleDeleteClick);
  participants.addEventListener("input", updateParticipantCountPreview);
  addUpdateButton.addEventListener("click", handleAddUpdateClick);
  updateRows.addEventListener("click", handleUpdateRowsClick);
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

  if (config.url.includes("YOUR_SUPABASE_URL") || config.anonKey.includes("YOUR_SUPABASE_ANON_KEY")) {
    return false;
  }

  return true;
} // End of isSupabaseConfigured

function showConfigNotice() {
  configNotice.classList.remove("d-none");
  authSection.classList.add("d-none");
  adminSection.classList.add("d-none");
  logoutButton.classList.add("d-none");
  setStatus("config.js의 Supabase 공개 키 설정을 확인해 주세요.", "warning");
} // End of showConfigNotice

async function bootstrapAuthState() {
  setStatus("로그인 상태를 확인하는 중입니다.", "neutral");
  const sessionResponse = await supabaseClient.auth.getSession();

  if (sessionResponse.error) {
    setStatus(sessionResponse.error.message, "danger");
    showUnauthenticatedState();
    return;
  }

  supabaseClient.auth.onAuthStateChange(handleAuthStateChange);

  if (sessionResponse.data && sessionResponse.data.session) {
    await handleAuthenticatedSession(sessionResponse.data.session.user);
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

  const loginResponse = await supabaseClient.auth.signInWithPassword({
    email: loginEmail.value.trim(),
    password: loginPassword.value
  });

  setLoginBusy(false);

  if (loginResponse.error) {
    setStatus(loginResponse.error.message, "danger");
    return;
  }

  setStatus("로그인되었습니다.", "success");
} // End of handleLoginSubmit

async function handleLogoutClick() {
  setStatus("로그아웃 중입니다.", "neutral");
  const logoutResponse = await supabaseClient.auth.signOut();

  if (logoutResponse.error) {
    setStatus(logoutResponse.error.message, "danger");
    return;
  }

  clearFormDraft();
  showUnauthenticatedState();
} // End of handleLogoutClick

async function showAuthenticatedState(user) {
  const email = user && user.email ? user.email : "관리자";
  configNotice.classList.add("d-none");
  authSection.classList.add("d-none");
  adminSection.classList.remove("d-none");
  logoutButton.classList.remove("d-none");
  resetFormForNewRecord();
  setStatus(`${email} 계정으로 접속 중입니다.`, "success");
  await loadRecords();
  restoreFormDraft();
} // End of showAuthenticatedState

function showUnauthenticatedState() {
  authSection.classList.remove("d-none");
  adminSection.classList.add("d-none");
  logoutButton.classList.add("d-none");
  loginPassword.value = "";
  setStatus("관리자 계정으로 로그인하세요.", "neutral");
} // End of showUnauthenticatedState

function showUnauthorizedState(user) {
  const email = user && user.email ? user.email : "현재 계정";
  authSection.classList.remove("d-none");
  adminSection.classList.add("d-none");
  logoutButton.classList.remove("d-none");
  loginPassword.value = "";
  setStatus(`${email}은 관리자 목록에 없습니다.`, "danger");
} // End of showUnauthorizedState

async function loadRecords() {
  setListBusy(true);
  const response = await supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .order("updated_at", { ascending: false });
  setListBusy(false);

  if (response.error) {
    setStatus(response.error.message, "danger");
    return;
  }

  records = sortRecords(normalizeRecords(response.data || []));
  renderRecordList(records);

  if (selectedRecordId) {
    selectRecordById(selectedRecordId);
  }
} // End of loadRecords

function renderRecordList(nextRecords) {
  recordList.innerHTML = "";
  recordCountText.textContent = `${nextRecords.length}개`;

  if (!nextRecords.length) {
    const empty = document.createElement("div");
    empty.className = "empty-records";
    empty.textContent = "등록된 의제가 없습니다.";
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
  date.textContent = formatDate(record.proposed_date);

  const title = document.createElement("div");
  title.className = "record-title";
  title.textContent = record.title;

  const meta = document.createElement("div");
  meta.className = "record-meta";

  const statusSwatch = document.createElement("span");
  statusSwatch.className = `agenda-record-status is-${record.status}`;
  statusSwatch.setAttribute("aria-hidden", "true");

  const metaText = document.createElement("span");
  metaText.textContent = `${getStatusLabel(record.status)} · ${record.participants.length}명`;

  meta.appendChild(statusSwatch);
  meta.appendChild(metaText);
  button.appendChild(date);
  button.appendChild(title);
  button.appendChild(meta);
  return button;
} // End of createRecordButton

function handleRecordListClick(event) {
  const button = event.target.closest(".record-button");

  if (!button) {
    return;
  }

  selectRecordById(button.dataset.recordId || "");
} // End of handleRecordListClick

function selectRecordById(nextRecordId) {
  const record = findRecordById(nextRecordId);

  if (!record) {
    selectedRecordId = "";
    resetFormForNewRecord();
    renderRecordList(records);
    return;
  }

  selectedRecordId = record.id;
  renderRecordForm(record);
  renderRecordList(records);
} // End of selectRecordById

function renderRecordForm(record) {
  const meetingInputValues = getMeetingInputValues(record.next_meeting_at);
  recordId.value = record.id;
  proposedDate.value = record.proposed_date;
  agendaStatus.value = record.status;
  agendaCategory.value = record.category;
  agendaTitle.value = record.title;
  agendaDescription.value = record.description;
  statusNote.value = record.status_note;
  participants.value = record.participants.join("\n");
  agendaTags.value = record.tags.join(", ");
  nextMeetingDate.value = meetingInputValues.date;
  nextMeetingTime.value = meetingInputValues.time;
  nextMeetingLocation.value = record.next_meeting_location;
  formTitle.textContent = "의제 수정";
  formSubtitle.textContent = record.title;
  deleteButton.classList.remove("d-none");
  renderUpdateRows(record.updates);
  updateParticipantCountPreview();
  renderIcons();
} // End of renderRecordForm

function resetFormForNewRecord() {
  selectedRecordId = "";
  recordId.value = "";
  proposedDate.value = getTodayInputValue();
  agendaStatus.value = "discussing";
  agendaCategory.value = "";
  agendaTitle.value = "";
  agendaDescription.value = "";
  statusNote.value = "";
  participants.value = "";
  agendaTags.value = "";
  nextMeetingDate.value = "";
  nextMeetingTime.value = "";
  nextMeetingLocation.value = "";
  formTitle.textContent = "새 의제";
  formSubtitle.textContent = "저장 전";
  deleteButton.classList.add("d-none");
  renderUpdateRows([]);
  updateParticipantCountPreview();
  renderRecordList(records);
  renderIcons();
} // End of resetFormForNewRecord

function handleNewRecordClick() {
  clearFormDraft();
  resetFormForNewRecord();
  setStatus("새 의제를 작성합니다.", "neutral");
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
  const savedRecord = await saveRecord(payload);
  setFormBusy(false);

  if (!savedRecord) {
    return;
  }

  selectedRecordId = savedRecord.id;
  clearFormDraft();
  setStatus("의제가 저장되었습니다.", "success");
  await loadRecords();
  selectRecordById(savedRecord.id);
} // End of handleSaveSubmit

function buildPayloadFromForm() {
  if (!proposedDate.value || !agendaTitle.value.trim()) {
    setStatus("논의 시작일과 제목은 필수입니다.", "danger");
    return null;
  }

  const parsedParticipants = parseDelimitedValues(participants.value);
  if (parsedParticipants.length < 3) {
    setStatus("참여자는 3명 이상 입력해 주세요.", "danger");
    participants.focus();
    return null;
  }

  const updateResult = getUpdatesFromForm();
  if (!updateResult.isValid) {
    setStatus(updateResult.message, "danger");
    return null;
  }

  const meetingDateTime = buildMeetingDateTime();
  if (!meetingDateTime.isValid) {
    setStatus(meetingDateTime.message, "danger");
    return null;
  }

  return {
    proposed_date: proposedDate.value,
    title: agendaTitle.value.trim(),
    category: agendaCategory.value.trim() || null,
    description: agendaDescription.value.trim() || null,
    status: sanitizeStatus(agendaStatus.value),
    status_note: statusNote.value.trim() || null,
    participants: parsedParticipants,
    tags: parseDelimitedValues(agendaTags.value),
    updates: updateResult.updates,
    next_meeting_at: meetingDateTime.value,
    next_meeting_location: nextMeetingLocation.value.trim() || null,
    updated_at: new Date().toISOString()
  };
} // End of buildPayloadFromForm

async function saveRecord(payload) {
  const currentId = recordId.value.trim();
  const query = currentId
    ? supabaseClient.from(TABLE_NAME).update(payload).eq("id", currentId).select("*").single()
    : supabaseClient.from(TABLE_NAME).insert(payload).select("*").single();
  const response = await query;

  if (response.error) {
    setStatus(response.error.message, "danger");
    return null;
  }

  return normalizeRecord(response.data, 0);
} // End of saveRecord

async function handleDeleteClick() {
  const currentId = recordId.value.trim();

  if (!currentId) {
    return;
  }

  const shouldDelete = window.confirm("이 의제를 삭제할까요? 중단된 의제도 기록이므로 상태를 '논의 중단'으로 바꾸는 방법을 권장합니다.");
  if (!shouldDelete) {
    return;
  }

  setFormBusy(true);
  const response = await supabaseClient.from(TABLE_NAME).delete().eq("id", currentId);
  setFormBusy(false);

  if (response.error) {
    setStatus(response.error.message, "danger");
    return;
  }

  selectedRecordId = "";
  clearFormDraft();
  setStatus("의제가 삭제되었습니다.", "success");
  await loadRecords();
  resetFormForNewRecord();
} // End of handleDeleteClick

function handleAddUpdateClick() {
  const emptyMessage = updateRows.querySelector(".agenda-update-empty");
  if (emptyMessage) {
    emptyMessage.remove();
  }

  updateRows.appendChild(createUpdateRow({ date: getDefaultUpdateDate(), title: "", content: "" }));
  renderIcons();
  saveFormDraft();
} // End of handleAddUpdateClick

function handleUpdateRowsClick(event) {
  const removeButton = event.target.closest(".agenda-update-remove");

  if (!removeButton) {
    return;
  }

  const row = removeButton.closest(".agenda-update-row");
  if (row) {
    row.remove();
  }

  if (!updateRows.querySelector(".agenda-update-row")) {
    renderUpdateRows([]);
  }

  saveFormDraft();
} // End of handleUpdateRowsClick

function renderUpdateRows(updates) {
  updateRows.innerHTML = "";

  if (!updates.length) {
    const empty = document.createElement("div");
    empty.className = "agenda-update-empty";
    empty.textContent = "아직 빌드업 기록이 없습니다.";
    updateRows.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  const sortedUpdates = [...updates].sort(compareUpdatesOldestFirst);

  for (let index = 0; index < sortedUpdates.length; index += 1) {
    fragment.appendChild(createUpdateRow(sortedUpdates[index]));
  }

  updateRows.appendChild(fragment);
} // End of renderUpdateRows

function createUpdateRow(update) {
  const row = document.createElement("div");
  row.className = "agenda-update-row";

  const dateInput = document.createElement("input");
  dateInput.className = "form-control agenda-update-date";
  dateInput.type = "date";
  dateInput.value = normalizeDateValue(update.date);
  dateInput.min = normalizeDateValue(proposedDate.value);
  dateInput.setAttribute("aria-label", "기록 날짜");

  const titleInput = document.createElement("input");
  titleInput.className = "form-control agenda-update-title";
  titleInput.type = "text";
  titleInput.maxLength = 255;
  titleInput.placeholder = "기록 제목";
  titleInput.value = String(update.title || "");
  titleInput.setAttribute("aria-label", "기록 제목");

  const removeButton = document.createElement("button");
  removeButton.className = "btn btn-outline-danger icon-only agenda-update-remove";
  removeButton.type = "button";
  removeButton.setAttribute("aria-label", "빌드업 기록 삭제");
  removeButton.title = "기록 삭제";
  removeButton.innerHTML = '<i data-lucide="trash-2" aria-hidden="true"></i>';

  const contentInput = document.createElement("textarea");
  contentInput.className = "form-control agenda-update-content";
  contentInput.rows = 3;
  contentInput.placeholder = "어떤 논의가 있었는지 기록";
  contentInput.value = String(update.content || "");
  contentInput.setAttribute("aria-label", "기록 내용");

  row.appendChild(dateInput);
  row.appendChild(titleInput);
  row.appendChild(removeButton);
  row.appendChild(contentInput);
  return row;
} // End of createUpdateRow

function getUpdatesFromForm() {
  const rows = Array.from(updateRows.querySelectorAll(".agenda-update-row"));
  const updates = [];

  for (let index = 0; index < rows.length; index += 1) {
    const dateInput = rows[index].querySelector(".agenda-update-date");
    const titleInput = rows[index].querySelector(".agenda-update-title");
    const contentInput = rows[index].querySelector(".agenda-update-content");
    const dateValue = dateInput ? dateInput.value : "";
    const titleValue = titleInput ? titleInput.value.trim() : "";
    const contentValue = contentInput ? contentInput.value.trim() : "";

    if (!dateValue && !titleValue && !contentValue) {
      continue;
    }

    if (!dateValue || (!titleValue && !contentValue)) {
      return {
        isValid: false,
        message: "빌드업 기록은 날짜와 제목 또는 내용을 입력해야 합니다.",
        updates: []
      };
    }

    if (proposedDate.value && dateValue < proposedDate.value) {
      if (dateInput) {
        dateInput.focus();
      }
      return {
        isValid: false,
        message: "빌드업 기록 날짜는 논의 시작일보다 빠를 수 없습니다.",
        updates: []
      };
    }

    updates.push({
      date: dateValue,
      title: titleValue || "논의 기록",
      content: contentValue
    });
  }

  return {
    isValid: true,
    message: "",
    updates: updates.sort(compareUpdatesOldestFirst)
  };
} // End of getUpdatesFromForm

function parseDelimitedValues(value) {
  const rawItems = String(value || "").split(/\r?\n|,/);
  const normalizedItems = [];

  for (let index = 0; index < rawItems.length; index += 1) {
    const item = rawItems[index].trim();

    if (item && !normalizedItems.includes(item)) {
      normalizedItems.push(item);
    }
  }

  return normalizedItems;
} // End of parseDelimitedValues

function buildMeetingDateTime() {
  const dateValue = nextMeetingDate.value;
  const timeValue = nextMeetingTime.value;

  if (!dateValue && !timeValue) {
    return { isValid: true, message: "", value: null };
  }

  if (!dateValue || !timeValue) {
    return {
      isValid: false,
      message: "다음 모임은 날짜와 시간을 모두 입력하거나 모두 비워 주세요.",
      value: null
    };
  }

  const parsedDate = new Date(`${dateValue}T${timeValue}:00+09:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return { isValid: false, message: "다음 모임 날짜와 시간을 확인해 주세요.", value: null };
  }

  return { isValid: true, message: "", value: parsedDate.toISOString() };
} // End of buildMeetingDateTime

function getMeetingInputValues(dateTimeValue) {
  if (!dateTimeValue) {
    return { date: "", time: "" };
  }

  const parsedDate = new Date(dateTimeValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return { date: "", time: "" };
  }

  const formatParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(parsedDate);
  const partMap = {};

  for (let index = 0; index < formatParts.length; index += 1) {
    partMap[formatParts[index].type] = formatParts[index].value;
  }

  return {
    date: `${partMap.year}-${partMap.month}-${partMap.day}`,
    time: `${partMap.hour}:${partMap.minute}`
  };
} // End of getMeetingInputValues

function updateParticipantCountPreview() {
  const participantCount = parseDelimitedValues(participants.value).length;
  participantCountPreview.textContent = `${participantCount}명`;
} // End of updateParticipantCountPreview

function handleFormInput() {
  syncUpdateDateMinimums();
  updateParticipantCountPreview();
  saveFormDraft();
} // End of handleFormInput

function syncUpdateDateMinimums() {
  const minimumDate = normalizeDateValue(proposedDate.value);
  const dateInputs = updateRows.querySelectorAll(".agenda-update-date");

  for (let index = 0; index < dateInputs.length; index += 1) {
    dateInputs[index].min = minimumDate;
  }
} // End of syncUpdateDateMinimums

function saveFormDraft() {
  const draftStorage = getDraftStorage();

  if (!draftStorage || adminSection.classList.contains("d-none")) {
    return;
  }

  const draft = {
    record_id: recordId.value.trim(),
    proposed_date: proposedDate.value,
    status: sanitizeStatus(agendaStatus.value),
    category: agendaCategory.value,
    title: agendaTitle.value,
    description: agendaDescription.value,
    status_note: statusNote.value,
    participants: participants.value,
    tags: agendaTags.value,
    next_meeting_date: nextMeetingDate.value,
    next_meeting_time: nextMeetingTime.value,
    next_meeting_location: nextMeetingLocation.value,
    updates: getUpdateDraftsFromForm()
  };

  if (!isMeaningfulDraft(draft)) {
    clearFormDraft();
    return;
  }

  try {
    draftStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn("Failed to save agenda draft:", error);
  }
} // End of saveFormDraft

function getUpdateDraftsFromForm() {
  const rows = Array.from(updateRows.querySelectorAll(".agenda-update-row"));
  const updates = [];

  for (let index = 0; index < rows.length; index += 1) {
    const dateInput = rows[index].querySelector(".agenda-update-date");
    const titleInput = rows[index].querySelector(".agenda-update-title");
    const contentInput = rows[index].querySelector(".agenda-update-content");
    const update = {
      date: dateInput ? dateInput.value : "",
      title: titleInput ? titleInput.value : "",
      content: contentInput ? contentInput.value : ""
    };

    if (update.date || update.title || update.content) {
      updates.push(update);
    }
  }

  return updates.sort(compareUpdatesOldestFirst);
} // End of getUpdateDraftsFromForm

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
  proposedDate.value = normalizeDateValue(draft.proposed_date) || getTodayInputValue();
  agendaStatus.value = sanitizeStatus(draft.status);
  agendaCategory.value = String(draft.category || "");
  agendaTitle.value = String(draft.title || "");
  agendaDescription.value = String(draft.description || "");
  statusNote.value = String(draft.status_note || "");
  participants.value = String(draft.participants || "");
  agendaTags.value = String(draft.tags || "");
  nextMeetingDate.value = normalizeDateValue(draft.next_meeting_date);
  nextMeetingTime.value = String(draft.next_meeting_time || "");
  nextMeetingLocation.value = String(draft.next_meeting_location || "");
  renderUpdateRows(Array.isArray(draft.updates) ? draft.updates : []);
  updateParticipantCountPreview();
  renderRecordList(records);
  renderIcons();
  setStatus("작성 중이던 의제를 복원했습니다.", "neutral");
  return true;
} // End of restoreFormDraft

function readFormDraft() {
  const draftStorage = getDraftStorage();

  if (!draftStorage) {
    return null;
  }

  try {
    const rawDraft = draftStorage.getItem(DRAFT_STORAGE_KEY);
    return rawDraft ? JSON.parse(rawDraft) : null;
  } catch (error) {
    console.warn("Failed to read agenda draft:", error);
    return null;
  }
} // End of readFormDraft

function clearFormDraft() {
  const draftStorage = getDraftStorage();

  if (!draftStorage) {
    return;
  }

  try {
    draftStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear agenda draft:", error);
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

  if (draft.record_id || draft.title || draft.description || draft.status_note || draft.participants || draft.tags || draft.next_meeting_location) {
    return true;
  }

  return Array.isArray(draft.updates) && draft.updates.length > 0;
} // End of isMeaningfulDraft

function normalizeRecords(rawRecords) {
  const normalizedRecords = [];

  for (let index = 0; index < rawRecords.length; index += 1) {
    normalizedRecords.push(normalizeRecord(rawRecords[index], index));
  }

  return normalizedRecords;
} // End of normalizeRecords

function normalizeRecord(rawRecord, index) {
  const sourceRecord = rawRecord || {};
  return {
    id: String(sourceRecord.id || `agenda-${index + 1}`),
    created_at: String(sourceRecord.created_at || ""),
    updated_at: String(sourceRecord.updated_at || sourceRecord.created_at || ""),
    proposed_date: normalizeDateValue(sourceRecord.proposed_date),
    title: String(sourceRecord.title || ""),
    category: String(sourceRecord.category || ""),
    description: String(sourceRecord.description || ""),
    status: sanitizeStatus(sourceRecord.status),
    status_note: String(sourceRecord.status_note || ""),
    participants: normalizeStringArray(sourceRecord.participants),
    tags: normalizeStringArray(sourceRecord.tags),
    updates: normalizeUpdates(sourceRecord.updates),
    next_meeting_at: String(sourceRecord.next_meeting_at || ""),
    next_meeting_location: String(sourceRecord.next_meeting_location || "")
  };
} // End of normalizeRecord

function normalizeStringArray(value) {
  let sourceValues = value;

  if (typeof sourceValues === "string" && sourceValues.trim()) {
    try {
      sourceValues = JSON.parse(sourceValues);
    } catch (error) {
      sourceValues = sourceValues.split(/\r?\n|,/);
    }
  }

  if (!Array.isArray(sourceValues)) {
    return [];
  }

  return parseDelimitedValues(sourceValues.map(function mapValue(item) {
    if (typeof item === "object" && item) {
      return String(item.name || item.label || "");
    }

    return String(item || "");
  }).join("\n"));
} // End of normalizeStringArray

function normalizeUpdates(value) {
  let sourceUpdates = value;
  const normalizedUpdates = [];

  if (typeof sourceUpdates === "string" && sourceUpdates.trim()) {
    try {
      sourceUpdates = JSON.parse(sourceUpdates);
    } catch (error) {
      sourceUpdates = [];
    }
  }

  if (!Array.isArray(sourceUpdates)) {
    return normalizedUpdates;
  }

  for (let index = 0; index < sourceUpdates.length; index += 1) {
    const sourceUpdate = sourceUpdates[index] || {};
    const dateValue = normalizeDateValue(sourceUpdate.date);
    const titleValue = String(sourceUpdate.title || "").trim();
    const contentValue = String(sourceUpdate.content || "").trim();

    if (dateValue || titleValue || contentValue) {
      normalizedUpdates.push({
        date: dateValue,
        title: titleValue || "논의 기록",
        content: contentValue
      });
    }
  }

  return normalizedUpdates.sort(compareUpdatesOldestFirst);
} // End of normalizeUpdates

function sortRecords(nextRecords) {
  return [...nextRecords].sort(compareRecords);
} // End of sortRecords

function compareRecords(firstRecord, secondRecord) {
  const firstRank = ACTIVE_STATUSES.includes(firstRecord.status) ? 0 : 1;
  const secondRank = ACTIVE_STATUSES.includes(secondRecord.status) ? 0 : 1;

  if (firstRank !== secondRank) {
    return firstRank - secondRank;
  }

  return String(secondRecord.updated_at || "").localeCompare(String(firstRecord.updated_at || ""));
} // End of compareRecords

function compareUpdatesOldestFirst(firstUpdate, secondUpdate) {
  return String(firstUpdate.date || "").localeCompare(String(secondUpdate.date || ""));
} // End of compareUpdatesOldestFirst

function findRecordById(nextRecordId) {
  const recordIdValue = String(nextRecordId || "");

  for (let index = 0; index < records.length; index += 1) {
    if (records[index].id === recordIdValue) {
      return records[index];
    }
  }

  return null;
} // End of findRecordById

function normalizeDateValue(value) {
  const rawValue = String(value || "").trim();
  const match = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
} // End of normalizeDateValue

function getTodayInputValue() {
  const formatParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const partMap = {};

  for (let index = 0; index < formatParts.length; index += 1) {
    partMap[formatParts[index].type] = formatParts[index].value;
  }

  return `${partMap.year}-${partMap.month}-${partMap.day}`;
} // End of getTodayInputValue

function getDefaultUpdateDate() {
  const discussionStartDate = normalizeDateValue(proposedDate.value);
  const today = getTodayInputValue();

  if (discussionStartDate && discussionStartDate > today) {
    return discussionStartDate;
  }

  return today;
} // End of getDefaultUpdateDate

function formatDate(value) {
  const normalizedDate = normalizeDateValue(value);

  if (!normalizedDate) {
    return "날짜 미정";
  }

  const parts = normalizedDate.split("-");
  return `${Number(parts[0])}년 ${Number(parts[1])}월 ${Number(parts[2])}일`;
} // End of formatDate

function sanitizeStatus(value) {
  const rawValue = String(value || "discussing").trim();
  return VALID_STATUSES.includes(rawValue) ? rawValue : "discussing";
} // End of sanitizeStatus

function getStatusLabel(status) {
  return STATUS_LABELS[sanitizeStatus(status)];
} // End of getStatusLabel

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
  addUpdateButton.disabled = isBusy;
  agendaStatus.disabled = isBusy;
} // End of setFormBusy

function setStatus(message, type) {
  adminStatus.textContent = message || "";
  adminStatus.classList.remove("is-success", "is-danger", "is-warning", "is-neutral");
  adminStatus.classList.add(`is-${type || "neutral"}`);
} // End of setStatus
