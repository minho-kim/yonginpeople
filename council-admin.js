import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/+esm";
import { TIMELINE_SUPABASE_CONFIG } from "./config.js";

const TABLE_NAME = "council_monitoring";
const STORAGE_BUCKET = "council-documents";
const DRAFT_STORAGE_KEY = "yonginCouncilMonitoringAdminDraft";
const MAX_DOCUMENT_FILE_SIZE = 50 * 1024 * 1024;
const SIGNED_DOCUMENT_URL_TTL_SECONDS = 60 * 60;
const ALLOWED_DOCUMENT_EXTENSIONS = [
  "pdf", "hwp", "hwpx", "doc", "docx", "xls", "xlsx", "csv", "txt", "jpg", "jpeg", "png", "webp"
];
const CONTENT_TYPE_BY_EXTENSION = {
  pdf: "application/pdf",
  hwp: "application/x-hwp",
  hwpx: "application/vnd.hancom.hwpx",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

let supabaseClient = null;
let records = [];
let selectedRecordId = "";
let currentAttachments = [];
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
let monitoringDate = null;
let councilTerm = null;
let monitoringPublished = null;
let sessionName = null;
let committeeName = null;
let meetingType = null;
let monitoringTitle = null;
let monitoringDescription = null;
let monitoringMembers = null;
let monitoringKeywords = null;
let monitoringSearchText = null;
let monitoringSourceUrl = null;
let documentFiles = null;
let uploadButton = null;
let uploadStatus = null;
let attachmentList = null;
let saveButton = null;
let deleteButton = null;

document.addEventListener("DOMContentLoaded", initializeCouncilAdmin);

async function initializeCouncilAdmin() {
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
} // End of initializeCouncilAdmin

function cacheElements() {
  adminStatus = document.getElementById("councilAdminStatus");
  configNotice = document.getElementById("configNotice");
  authSection = document.getElementById("authSection");
  adminSection = document.getElementById("councilAdminSection");
  loginForm = document.getElementById("loginForm");
  loginEmail = document.getElementById("loginEmail");
  loginPassword = document.getElementById("loginPassword");
  loginButton = document.getElementById("loginButton");
  logoutButton = document.getElementById("councilLogoutButton");
  recordCountText = document.getElementById("councilRecordCountText");
  refreshButton = document.getElementById("councilRefreshButton");
  newRecordButton = document.getElementById("councilNewRecordButton");
  adminSearch = document.getElementById("councilAdminSearch");
  recordList = document.getElementById("councilRecordList");
  recordForm = document.getElementById("councilRecordForm");
  formTitle = document.getElementById("councilFormTitle");
  formSubtitle = document.getElementById("councilFormSubtitle");
  recordId = document.getElementById("councilRecordId");
  monitoringDate = document.getElementById("monitoringDate");
  councilTerm = document.getElementById("councilTerm");
  monitoringPublished = document.getElementById("monitoringPublished");
  sessionName = document.getElementById("sessionName");
  committeeName = document.getElementById("committeeName");
  meetingType = document.getElementById("meetingType");
  monitoringTitle = document.getElementById("monitoringTitle");
  monitoringDescription = document.getElementById("monitoringDescription");
  monitoringMembers = document.getElementById("monitoringMembers");
  monitoringKeywords = document.getElementById("monitoringKeywords");
  monitoringSearchText = document.getElementById("monitoringSearchText");
  monitoringSourceUrl = document.getElementById("monitoringSourceUrl");
  documentFiles = document.getElementById("councilDocumentFiles");
  uploadButton = document.getElementById("councilUploadButton");
  uploadStatus = document.getElementById("councilUploadStatus");
  attachmentList = document.getElementById("councilAttachmentList");
  saveButton = document.getElementById("councilSaveButton");
  deleteButton = document.getElementById("councilDeleteButton");
} // End of cacheElements

function bindEvents() {
  loginForm.addEventListener("submit", handleLoginSubmit);
  logoutButton.addEventListener("click", handleLogoutClick);
  refreshButton.addEventListener("click", handleRefreshClick);
  newRecordButton.addEventListener("click", handleNewRecordClick);
  adminSearch.addEventListener("input", handleAdminSearchInput);
  recordList.addEventListener("click", handleRecordListClick);
  recordForm.addEventListener("submit", handleSaveSubmit);
  recordForm.addEventListener("input", handleFormInput);
  recordForm.addEventListener("change", handleFormInput);
  uploadButton.addEventListener("click", handleUploadClick);
  attachmentList.addEventListener("click", handleAttachmentListClick);
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

  if (config.url.includes("YOUR_SUPABASE_URL") || config.anonKey.includes("YOUR_SUPABASE_ANON_KEY")) {
    return false;
  }

  return true;
} // End of isSupabaseConfigured

function showConfigNotice() {
  configNotice.classList.remove("d-none");
  authSection.classList.add("d-none");
  adminSection.classList.add("d-none");
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
    setStatus(getErrorMessage(response.error), "danger");
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
  const didRestoreDraft = restoreFormDraft();
  if (didRestoreDraft) {
    await refreshAttachmentUrls(currentAttachments);
    renderAttachmentList();
  }
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
    .order("monitoring_date", { ascending: false })
    .order("created_at", { ascending: false });
  setListBusy(false);

  if (response.error) {
    records = [];
    renderRecordList([]);
    setStatus(getErrorMessage(response.error), "warning");
    return;
  }

  records = normalizeRecords(response.data || []);
  await refreshAttachmentAccessUrls(records);
  renderFilteredRecordList();

  if (selectedRecordId) {
    selectRecordById(selectedRecordId, false);
  }
} // End of loadRecords

function renderFilteredRecordList() {
  const query = normalizeSearchText(adminSearch.value);
  const filteredRecords = [];

  for (let index = 0; index < records.length; index += 1) {
    if (!query || buildAdminSearchHaystack(records[index]).includes(query)) {
      filteredRecords.push(records[index]);
    }
  }

  renderRecordList(filteredRecords);
} // End of renderFilteredRecordList

function renderRecordList(nextRecords) {
  recordList.innerHTML = "";
  recordCountText.textContent = `현재 ${records.length}개의 기록이 있습니다.`;

  if (!nextRecords.length) {
    const empty = document.createElement("div");
    empty.className = "empty-records";
    empty.textContent = records.length ? "검색 조건에 맞는 기록이 없습니다." : "등록된 모니터링 기록이 없습니다.";
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
  date.textContent = formatDate(record.monitoring_date);

  const title = document.createElement("div");
  title.className = "record-title";
  title.textContent = record.title || "제목 없음";

  const meta = document.createElement("div");
  meta.className = "record-meta";
  meta.textContent = [record.session_name, record.committee].filter(Boolean).join(" · ") || "회기 정보 없음";

  const badges = document.createElement("div");
  badges.className = "council-record-badges";
  appendBadge(badges, record.meeting_type || "기타", "");
  appendBadge(badges, record.is_published ? "공개 예정" : "비공개", record.is_published ? "" : "is-private");

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

function handleAdminSearchInput() {
  renderFilteredRecordList();
} // End of handleAdminSearchInput

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
  monitoringDate.value = record.monitoring_date;
  councilTerm.value = record.council_term;
  monitoringPublished.value = record.is_published ? "true" : "false";
  sessionName.value = record.session_name;
  committeeName.value = record.committee;
  meetingType.value = record.meeting_type || "기타";
  monitoringTitle.value = record.title;
  monitoringDescription.value = record.description;
  monitoringMembers.value = record.members.join("\n");
  monitoringKeywords.value = record.keywords.join(", ");
  monitoringSearchText.value = record.search_text;
  monitoringSourceUrl.value = record.source_url;
  currentAttachments = normalizeAttachments(record.attachments);
  formTitle.textContent = "모니터링 기록 수정";
  formSubtitle.textContent = record.title || "저장된 기록";
  deleteButton.classList.remove("d-none");
  documentFiles.value = "";
  setUploadStatus("");
  renderAttachmentList();
} // End of renderRecordForm

function resetFormForNewRecord() {
  selectedRecordId = "";
  recordId.value = "";
  monitoringDate.value = getTodayInputValue();
  councilTerm.value = "";
  monitoringPublished.value = "false";
  sessionName.value = "";
  committeeName.value = "";
  meetingType.value = "본회의";
  monitoringTitle.value = "";
  monitoringDescription.value = "";
  monitoringMembers.value = "";
  monitoringKeywords.value = "";
  monitoringSearchText.value = "";
  monitoringSourceUrl.value = "";
  currentAttachments = [];
  formTitle.textContent = "새 기록";
  formSubtitle.textContent = "저장 전";
  deleteButton.classList.add("d-none");
  documentFiles.value = "";
  setUploadStatus("");
  renderAttachmentList();
  renderFilteredRecordList();
} // End of resetFormForNewRecord

function handleNewRecordClick() {
  clearFormDraft();
  resetFormForNewRecord();
  setStatus("새 모니터링 기록을 작성합니다.", "neutral");
} // End of handleNewRecordClick

async function handleRefreshClick() {
  saveFormDraft();
  await loadRecords();

  if (restoreFormDraft()) {
    await refreshAttachmentUrls(currentAttachments);
    renderAttachmentList();
    setStatus("목록을 새로고침하고 작성 중이던 내용을 복원했습니다.", "neutral");
    return;
  }

  setStatus("목록을 새로고침했습니다.", "success");
} // End of handleRefreshClick

function handleFormInput() {
  saveFormDraft();
} // End of handleFormInput

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
  setStatus("모니터링 기록이 저장되었습니다.", "success");
  await loadRecords();
  selectRecordById(savedRecord.id, false);
} // End of handleSaveSubmit

function buildPayloadFromForm() {
  if (!monitoringDate.value || !monitoringTitle.value.trim()) {
    setStatus("모니터링 날짜와 기록 제목은 필수입니다.", "danger");
    return null;
  }

  const sourceUrlResult = normalizeOptionalHttpUrl(monitoringSourceUrl.value);
  if (!sourceUrlResult.isValid) {
    setStatus("원문 출처 URL은 http:// 또는 https:// 주소로 입력해 주세요.", "danger");
    monitoringSourceUrl.focus();
    return null;
  }

  return {
    monitoring_date: monitoringDate.value,
    council_term: councilTerm.value.trim() || null,
    session_name: sessionName.value.trim() || null,
    committee: committeeName.value.trim() || null,
    meeting_type: meetingType.value.trim() || "기타",
    title: monitoringTitle.value.trim(),
    description: monitoringDescription.value.trim() || null,
    members: parseDelimitedValues(monitoringMembers.value),
    keywords: parseDelimitedValues(monitoringKeywords.value),
    search_text: monitoringSearchText.value.trim() || null,
    source_url: sourceUrlResult.value,
    attachments: serializeAttachmentsForStorage(currentAttachments),
    is_published: monitoringPublished.value === "true",
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
    setStatus(getErrorMessage(response.error), "danger");
    return null;
  }

  return normalizeRecord(response.data, 0);
} // End of saveRecord

async function handleDeleteClick() {
  const currentId = recordId.value.trim();

  if (!currentId) {
    return;
  }

  const recordToDelete = findRecordById(currentId);
  const shouldDelete = window.confirm("이 모니터링 기록과 연결된 첨부 자료를 삭제할까요?");
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

  const storagePaths = recordToDelete
    ? recordToDelete.attachments.map(function getAttachmentPath(attachment) {
        return attachment.path;
      }).filter(Boolean)
    : [];
  const storageWasRemoved = await removeStorageObjects(storagePaths);
  selectedRecordId = "";
  clearFormDraft();
  setStatus(
    storageWasRemoved ? "모니터링 기록과 첨부 자료가 삭제되었습니다." : "기록은 삭제했지만 일부 저장소 파일을 확인하지 못했습니다.",
    storageWasRemoved ? "success" : "warning"
  );
  await loadRecords();
  resetFormForNewRecord();
} // End of handleDeleteClick

async function handleUploadClick() {
  const files = documentFiles.files ? Array.from(documentFiles.files) : [];

  if (!files.length) {
    setStatus("업로드할 자료를 선택하세요.", "danger");
    return;
  }

  for (let index = 0; index < files.length; index += 1) {
    const validationMessage = getFileValidationMessage(files[index]);
    if (validationMessage) {
      setStatus(validationMessage, "danger");
      return;
    }
  }

  uploadButton.disabled = true;
  setUploadStatus(`0/${files.length} 업로드 중`);
  const uploadResult = await uploadDocuments(files);
  uploadButton.disabled = false;

  if (uploadResult.attachments.length) {
    currentAttachments = mergeAttachments(currentAttachments, uploadResult.attachments);
    documentFiles.value = "";
    renderAttachmentList();
    saveFormDraft();

    if (recordId.value.trim()) {
      const didSave = await saveCurrentRecordAttachments(currentAttachments);
      if (!didSave) {
        setUploadStatus("파일은 업로드되었지만 기록 반영에 실패했습니다. 저장 버튼을 다시 눌러 주세요.");
        return;
      }
    }
  }

  if (uploadResult.errorMessage) {
    setStatus(uploadResult.errorMessage, "warning");
    setUploadStatus(`${uploadResult.attachments.length}/${files.length}개 업로드 완료`);
    return;
  }

  const completionMessage = recordId.value.trim()
    ? "자료 업로드와 기록 반영이 완료되었습니다."
    : "자료 업로드가 완료되었습니다. 새 기록 저장을 누르면 관리자 기록에 반영됩니다.";
  setStatus(completionMessage, "success");
  setUploadStatus(`${uploadResult.attachments.length}개 업로드 완료`);
} // End of handleUploadClick

async function uploadDocuments(files) {
  const uploadedAttachments = [];
  let errorMessage = "";

  for (let index = 0; index < files.length; index += 1) {
    setUploadStatus(`${index + 1}/${files.length} ${files[index].name} 업로드 중`);
    const result = await uploadDocument(files[index]);

    if (!result.attachment) {
      errorMessage = result.errorMessage || "파일 업로드에 실패했습니다.";
      break;
    }

    uploadedAttachments.push(result.attachment);
  }

  return { attachments: uploadedAttachments, errorMessage: errorMessage };
} // End of uploadDocuments

async function uploadDocument(file) {
  const storagePath = buildDocumentStoragePath(file);
  const contentType = getDocumentContentType(file);
  const response = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: contentType,
      upsert: false
    });

  if (response.error) {
    return { attachment: null, errorMessage: getErrorMessage(response.error) };
  }

  const signedUrl = await createSignedDocumentUrl(storagePath);

  if (!signedUrl) {
    await removeStorageObject(storagePath);
    return { attachment: null, errorMessage: "업로드한 파일의 관리자 열람 주소를 만들지 못했습니다." };
  }

  return {
    attachment: {
      id: getRandomSegment(),
      name: file.name,
      url: signedUrl,
      path: storagePath,
      mime_type: contentType,
      size: Number(file.size || 0)
    },
    errorMessage: ""
  };
} // End of uploadDocument

async function createSignedDocumentUrl(storagePath) {
  if (!storagePath) {
    return "";
  }

  const response = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_DOCUMENT_URL_TTL_SECONDS);

  if (response.error || !response.data || !response.data.signedUrl) {
    return "";
  }

  return normalizeStoredUrl(response.data.signedUrl);
} // End of createSignedDocumentUrl

async function refreshAttachmentAccessUrls(nextRecords) {
  const tasks = [];

  for (let recordIndex = 0; recordIndex < nextRecords.length; recordIndex += 1) {
    tasks.push(refreshAttachmentUrls(nextRecords[recordIndex].attachments));
  }

  await Promise.all(tasks);
} // End of refreshAttachmentAccessUrls

async function refreshAttachmentUrls(attachments) {
  const tasks = [];

  for (let index = 0; index < attachments.length; index += 1) {
    if (attachments[index].path) {
      tasks.push(refreshAttachmentAccessUrl(attachments[index]));
    }
  }

  await Promise.all(tasks);
} // End of refreshAttachmentUrls

async function refreshAttachmentAccessUrl(attachment) {
  const signedUrl = await createSignedDocumentUrl(attachment.path);
  attachment.url = signedUrl;
} // End of refreshAttachmentAccessUrl

function getFileValidationMessage(file) {
  if (!file) {
    return "파일을 확인해 주세요.";
  }

  const extension = getFileExtension(file.name);
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extension)) {
    return `${file.name}: 지원하지 않는 파일 형식입니다.`;
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    return `${file.name}: 파일 크기는 50MB 이하여야 합니다.`;
  }

  return "";
} // End of getFileValidationMessage

function getDocumentContentType(file) {
  const extension = getFileExtension(file && file.name);
  return CONTENT_TYPE_BY_EXTENSION[extension] || (file && file.type) || "application/octet-stream";
} // End of getDocumentContentType

function getFileExtension(fileName) {
  const normalizedName = String(fileName || "").trim().toLowerCase();
  const segments = normalizedName.split(".");
  return segments.length > 1 ? segments[segments.length - 1] : "";
} // End of getFileExtension

function buildDocumentStoragePath(file) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const extension = getFileExtension(file.name);
  const originalBaseName = String(file.name || "document").replace(/\.[^.]+$/, "");
  const safeBaseName = sanitizeFileSegment(originalBaseName) || "document";
  const safeFileName = extension ? `${safeBaseName}.${extension}` : safeBaseName;
  return `council-monitoring/${year}/${month}/${Date.now()}-${getRandomSegment()}-${safeFileName}`;
} // End of buildDocumentStoragePath

function sanitizeFileSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
} // End of sanitizeFileSegment

function getRandomSegment() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
} // End of getRandomSegment

function mergeAttachments(firstAttachments, secondAttachments) {
  const combinedAttachments = normalizeAttachments(firstAttachments).concat(normalizeAttachments(secondAttachments));
  const uniqueAttachments = [];
  const seenKeys = new Set();

  for (let index = 0; index < combinedAttachments.length; index += 1) {
    const attachment = combinedAttachments[index];
    const key = attachment.path || attachment.url;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueAttachments.push(attachment);
    }
  }

  return uniqueAttachments;
} // End of mergeAttachments

async function saveCurrentRecordAttachments(nextAttachments) {
  const currentId = recordId.value.trim();

  if (!currentId) {
    return false;
  }

  const response = await supabaseClient
    .from(TABLE_NAME)
    .update({
      attachments: serializeAttachmentsForStorage(nextAttachments),
      updated_at: new Date().toISOString()
    })
    .eq("id", currentId)
    .select("*")
    .single();

  if (response.error) {
    setStatus(getErrorMessage(response.error), "danger");
    return false;
  }

  updateRecordAttachments(currentId, nextAttachments);
  return true;
} // End of saveCurrentRecordAttachments

function updateRecordAttachments(currentId, nextAttachments) {
  for (let index = 0; index < records.length; index += 1) {
    if (records[index].id === currentId) {
      records[index].attachments = normalizeAttachments(nextAttachments);
      records[index].updated_at = new Date().toISOString();
      break;
    }
  }
} // End of updateRecordAttachments

function renderAttachmentList() {
  attachmentList.innerHTML = "";

  if (!currentAttachments.length) {
    const empty = document.createElement("div");
    empty.className = "council-admin-empty";
    empty.textContent = "업로드된 첨부 자료가 없습니다.";
    attachmentList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let index = 0; index < currentAttachments.length; index += 1) {
    fragment.appendChild(createAttachmentRow(currentAttachments[index], index));
  }

  attachmentList.appendChild(fragment);
  renderIcons();
} // End of renderAttachmentList

function createAttachmentRow(attachment, index) {
  const row = document.createElement("div");
  row.className = "council-admin-attachment";
  row.dataset.attachmentIndex = String(index);
  row.innerHTML = '<i data-lucide="file-text" aria-hidden="true"></i>';

  const copy = document.createElement("div");
  copy.className = "council-admin-attachment-copy";

  const name = document.createElement("strong");
  name.textContent = attachment.name;

  const meta = document.createElement("span");
  meta.textContent = formatFileSize(attachment.size);

  copy.appendChild(name);
  copy.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "council-admin-attachment-actions";

  const openLink = document.createElement(attachment.url ? "a" : "span");
  openLink.title = attachment.url ? "자료 열기" : "열람 주소를 준비하지 못했습니다";
  openLink.setAttribute("aria-label", attachment.url ? `${attachment.name} 열기` : `${attachment.name} 열람 불가`);
  openLink.innerHTML = '<i data-lucide="external-link" aria-hidden="true"></i>';

  if (attachment.url) {
    openLink.href = attachment.url;
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
  } else {
    openLink.className = "is-disabled";
  }

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "council-attachment-remove";
  removeButton.title = "자료 삭제";
  removeButton.setAttribute("aria-label", `${attachment.name} 삭제`);
  removeButton.innerHTML = '<i data-lucide="trash-2" aria-hidden="true"></i>';

  actions.appendChild(openLink);
  actions.appendChild(removeButton);
  row.appendChild(copy);
  row.appendChild(actions);
  return row;
} // End of createAttachmentRow

async function handleAttachmentListClick(event) {
  const removeButton = event.target.closest(".council-attachment-remove");

  if (!removeButton) {
    return;
  }

  const row = removeButton.closest(".council-admin-attachment");
  const index = row ? Number(row.dataset.attachmentIndex) : -1;
  const attachment = currentAttachments[index];

  if (!attachment) {
    return;
  }

  const shouldRemove = window.confirm(`${attachment.name} 자료를 삭제할까요?`);
  if (!shouldRemove) {
    return;
  }

  removeButton.disabled = true;
  const nextAttachments = currentAttachments.filter(function filterAttachment(item, itemIndex) {
    return itemIndex !== index;
  });

  if (recordId.value.trim()) {
    const didSave = await saveCurrentRecordAttachments(nextAttachments);
    if (!didSave) {
      removeButton.disabled = false;
      return;
    }
  }

  const storageWasRemoved = await removeStorageObject(attachment.path);
  currentAttachments = nextAttachments;
  renderAttachmentList();
  saveFormDraft();
  setStatus(
    storageWasRemoved ? "자료가 삭제되었습니다." : "목록에서는 삭제했지만 저장소 파일 삭제는 확인하지 못했습니다.",
    storageWasRemoved ? "success" : "warning"
  );
} // End of handleAttachmentListClick

async function removeStorageObject(storagePath) {
  if (!storagePath) {
    return true;
  }

  const response = await supabaseClient.storage.from(STORAGE_BUCKET).remove([storagePath]);
  return !response.error;
} // End of removeStorageObject

async function removeStorageObjects(storagePaths) {
  const normalizedPaths = Array.from(new Set((storagePaths || []).filter(Boolean)));

  if (!normalizedPaths.length) {
    return true;
  }

  const response = await supabaseClient.storage.from(STORAGE_BUCKET).remove(normalizedPaths);
  return !response.error;
} // End of removeStorageObjects

function saveFormDraft() {
  const storage = getDraftStorage();

  if (!storage || adminSection.classList.contains("d-none")) {
    return;
  }

  const draft = {
    record_id: recordId.value.trim(),
    monitoring_date: monitoringDate.value,
    council_term: councilTerm.value,
    is_published: monitoringPublished.value,
    session_name: sessionName.value,
    committee: committeeName.value,
    meeting_type: meetingType.value,
    title: monitoringTitle.value,
    description: monitoringDescription.value,
    members: monitoringMembers.value,
    keywords: monitoringKeywords.value,
    search_text: monitoringSearchText.value,
    source_url: monitoringSourceUrl.value,
    attachments: normalizeAttachments(currentAttachments)
  };

  if (!isMeaningfulDraft(draft)) {
    clearFormDraft();
    return;
  }

  try {
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn("Failed to save council monitoring draft:", error);
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
  monitoringDate.value = normalizeDateValue(draft.monitoring_date) || getTodayInputValue();
  councilTerm.value = String(draft.council_term || "");
  monitoringPublished.value = String(draft.is_published) === "false" ? "false" : "true";
  sessionName.value = String(draft.session_name || "");
  committeeName.value = String(draft.committee || "");
  meetingType.value = String(draft.meeting_type || "본회의");
  monitoringTitle.value = String(draft.title || "");
  monitoringDescription.value = String(draft.description || "");
  monitoringMembers.value = String(draft.members || "");
  monitoringKeywords.value = String(draft.keywords || "");
  monitoringSearchText.value = String(draft.search_text || "");
  monitoringSourceUrl.value = String(draft.source_url || "");
  currentAttachments = normalizeAttachments(draft.attachments);
  renderAttachmentList();
  renderFilteredRecordList();
  setStatus("작성 중이던 모니터링 기록을 복원했습니다.", "neutral");
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
    console.warn("Failed to read council monitoring draft:", error);
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
    console.warn("Failed to clear council monitoring draft:", error);
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

  if (draft.record_id || draft.title || draft.description || draft.members || draft.keywords || draft.search_text || draft.source_url) {
    return true;
  }

  return Array.isArray(draft.attachments) && draft.attachments.length > 0;
} // End of isMeaningfulDraft

function normalizeRecords(rawRecords) {
  const normalizedRecords = [];

  for (let index = 0; index < rawRecords.length; index += 1) {
    normalizedRecords.push(normalizeRecord(rawRecords[index], index));
  }

  return normalizedRecords.sort(compareRecordsNewestFirst);
} // End of normalizeRecords

function normalizeRecord(rawRecord, index) {
  const sourceRecord = rawRecord || {};
  return {
    id: String(sourceRecord.id || `council-${index + 1}`),
    created_at: String(sourceRecord.created_at || ""),
    updated_at: String(sourceRecord.updated_at || sourceRecord.created_at || ""),
    monitoring_date: normalizeDateValue(sourceRecord.monitoring_date),
    council_term: String(sourceRecord.council_term || ""),
    session_name: String(sourceRecord.session_name || ""),
    committee: String(sourceRecord.committee || ""),
    meeting_type: String(sourceRecord.meeting_type || "기타"),
    title: String(sourceRecord.title || ""),
    description: String(sourceRecord.description || ""),
    members: normalizeStringArray(sourceRecord.members),
    keywords: normalizeStringArray(sourceRecord.keywords),
    search_text: String(sourceRecord.search_text || ""),
    source_url: normalizeStoredUrl(sourceRecord.source_url),
    attachments: normalizeAttachments(sourceRecord.attachments),
    is_published: sourceRecord.is_published !== false
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

  const values = [];
  for (let index = 0; index < sourceValues.length; index += 1) {
    const item = typeof sourceValues[index] === "object" && sourceValues[index]
      ? sourceValues[index].name || sourceValues[index].label
      : sourceValues[index];
    const normalizedItem = String(item || "").trim();

    if (normalizedItem && !values.includes(normalizedItem)) {
      values.push(normalizedItem);
    }
  }

  return values;
} // End of normalizeStringArray

function normalizeAttachments(value) {
  let sourceAttachments = value;

  if (typeof sourceAttachments === "string" && sourceAttachments.trim()) {
    try {
      sourceAttachments = JSON.parse(sourceAttachments);
    } catch (error) {
      sourceAttachments = [];
    }
  }

  if (!Array.isArray(sourceAttachments)) {
    return [];
  }

  const attachments = [];
  for (let index = 0; index < sourceAttachments.length; index += 1) {
    const sourceAttachment = sourceAttachments[index] || {};
    const path = String(sourceAttachment.path || "").trim();
    const url = normalizeStoredUrl(sourceAttachment.url);

    if (!url && !path) {
      continue;
    }

    attachments.push({
      id: String(sourceAttachment.id || path || url),
      name: String(sourceAttachment.name || getFileNameFromUrl(url || path) || "첨부 자료"),
      url: url,
      path: path,
      mime_type: String(sourceAttachment.mime_type || sourceAttachment.type || ""),
      size: Number(sourceAttachment.size || 0)
    });
  }

  return attachments;
} // End of normalizeAttachments

function serializeAttachmentsForStorage(value) {
  const normalizedAttachments = normalizeAttachments(value);
  const storedAttachments = [];

  for (let index = 0; index < normalizedAttachments.length; index += 1) {
    const attachment = normalizedAttachments[index];
    const storedAttachment = {
      id: attachment.id,
      name: attachment.name,
      path: attachment.path,
      mime_type: attachment.mime_type,
      size: attachment.size
    };

    if (!attachment.path && attachment.url) {
      storedAttachment.url = attachment.url;
    }

    storedAttachments.push(storedAttachment);
  }

  return storedAttachments;
} // End of serializeAttachmentsForStorage

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

function compareRecordsNewestFirst(firstRecord, secondRecord) {
  const dateComparison = String(secondRecord.monitoring_date || "").localeCompare(String(firstRecord.monitoring_date || ""));

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

function buildAdminSearchHaystack(record) {
  return normalizeSearchText([
    record.monitoring_date,
    record.council_term,
    record.session_name,
    record.committee,
    record.meeting_type,
    record.title,
    record.description,
    record.members.join(" "),
    record.keywords.join(" "),
    record.search_text,
    record.attachments.map(function getAttachmentName(attachment) {
      return attachment.name;
    }).join(" ")
  ].join(" "));
} // End of buildAdminSearchHaystack

function normalizeSearchText(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
} // End of normalizeSearchText

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

function getFileNameFromUrl(url) {
  try {
    const pathnameParts = new URL(url).pathname.split("/");
    return decodeURIComponent(pathnameParts[pathnameParts.length - 1] || "");
  } catch (error) {
    return "";
  }
} // End of getFileNameFromUrl

function formatFileSize(size) {
  const numericSize = Number(size || 0);

  if (!numericSize) {
    return "크기 정보 없음";
  }

  if (numericSize < 1024) {
    return `${numericSize} B`;
  }

  if (numericSize < 1024 * 1024) {
    return `${(numericSize / 1024).toFixed(1)} KB`;
  }

  return `${(numericSize / (1024 * 1024)).toFixed(1)} MB`;
} // End of formatFileSize

function getErrorMessage(error) {
  const message = error && error.message ? String(error.message) : "요청을 처리하지 못했습니다.";
  const code = error && error.code ? String(error.code) : "";

  if (code === "42P01" || code === "PGRST205") {
    return "모니터링용 Supabase 표가 아직 준비되지 않았습니다. 협의 후 SQL 초안을 적용하면 사용할 수 있습니다.";
  }

  if (message.toLocaleLowerCase("en-US").includes("bucket not found")) {
    return "모니터링 자료 저장소가 아직 준비되지 않았습니다. 협의 후 Storage 설정을 적용해 주세요.";
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
  uploadButton.disabled = isBusy;
} // End of setFormBusy

function setUploadStatus(message) {
  uploadStatus.textContent = message || "";
} // End of setUploadStatus

function setStatus(message, type) {
  adminStatus.textContent = message || "";
  adminStatus.classList.remove("is-success", "is-danger", "is-warning", "is-neutral");
  adminStatus.classList.add(`is-${type || "neutral"}`);
} // End of setStatus
