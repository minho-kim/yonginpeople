import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/+esm";
import { TIMELINE_SUPABASE_CONFIG } from "./config.js";

const TABLE_NAME = "timeline_history";
const STORAGE_BUCKET = "event-images";
const VALID_BADGE_COLORS = ["primary", "secondary", "success", "info", "dark", "warning"];
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
const MAX_IMAGE_FILE_SIZE = 15 * 1024 * 1024;
const IMAGE_TYPE_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif"
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
let timelineForm = null;
let formTitle = null;
let formSubtitle = null;
let recordId = null;
let eventDate = null;
let badgeColor = null;
let badgeText = null;
let eventTitle = null;
let description = null;
let imageUrl = null;
let imageFile = null;
let uploadImageButton = null;
let clearImageButton = null;
let imagePreviewWrap = null;
let imagePreview = null;
let articleRows = null;
let addArticleButton = null;
let saveButton = null;
let deleteButton = null;

document.addEventListener("DOMContentLoaded", initializeAdmin);

async function initializeAdmin() {
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
} // End of initializeAdmin

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
  timelineForm = document.getElementById("timelineForm");
  formTitle = document.getElementById("formTitle");
  formSubtitle = document.getElementById("formSubtitle");
  recordId = document.getElementById("recordId");
  eventDate = document.getElementById("eventDate");
  badgeColor = document.getElementById("badgeColor");
  badgeText = document.getElementById("badgeText");
  eventTitle = document.getElementById("eventTitle");
  description = document.getElementById("description");
  imageUrl = document.getElementById("imageUrl");
  imageFile = document.getElementById("imageFile");
  uploadImageButton = document.getElementById("uploadImageButton");
  clearImageButton = document.getElementById("clearImageButton");
  imagePreviewWrap = document.getElementById("imagePreviewWrap");
  imagePreview = document.getElementById("imagePreview");
  articleRows = document.getElementById("articleRows");
  addArticleButton = document.getElementById("addArticleButton");
  saveButton = document.getElementById("saveButton");
  deleteButton = document.getElementById("deleteButton");
} // End of cacheElements

function bindEvents() {
  loginForm.addEventListener("submit", handleLoginSubmit);
  logoutButton.addEventListener("click", handleLogoutClick);
  recordList.addEventListener("click", handleRecordListClick);
  newRecordButton.addEventListener("click", handleNewRecordClick);
  refreshButton.addEventListener("click", handleRefreshClick);
  timelineForm.addEventListener("submit", handleSaveSubmit);
  deleteButton.addEventListener("click", handleDeleteClick);
  uploadImageButton.addEventListener("click", handleUploadImageClick);
  clearImageButton.addEventListener("click", handleClearImageClick);
  imageUrl.addEventListener("input", handleImageUrlInput);
  addArticleButton.addEventListener("click", handleAddArticleClick);
  articleRows.addEventListener("click", handleArticleRowsClick);
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
  setStatus("config.js에 Supabase 공개 키가 아직 없습니다.", "warning");
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
  const isAdmin = await checkCurrentUserIsAdmin();

  if (!isAdmin) {
    showUnauthorizedState(user);
    return;
  }

  await showAuthenticatedState(user);
} // End of handleAuthenticatedSession

async function checkCurrentUserIsAdmin() {
  const response = await supabaseClient.rpc("is_timeline_admin");

  if (response.error) {
    setStatus(response.error.message, "danger");
    return false;
  }

  return response.data === true;
} // End of checkCurrentUserIsAdmin

async function handleLoginSubmit(event) {
  event.preventDefault();
  setLoginBusy(true);
  setStatus("로그인 중입니다.", "neutral");

  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  const loginResponse = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
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

  showUnauthenticatedState();
} // End of handleLogoutClick

async function showAuthenticatedState(user) {
  const email = user && user.email ? user.email : "관리자";
  configNotice.classList.add("d-none");
  authSection.classList.add("d-none");
  adminSection.classList.remove("d-none");
  logoutButton.classList.remove("d-none");
  setStatus(`${email} 계정으로 접속 중입니다.`, "success");
  resetFormForNewRecord();
  await loadRecords();
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
    .order("created_at", { ascending: false });

  setListBusy(false);

  if (response.error) {
    setStatus(response.error.message, "danger");
    return;
  }

  records = getNewestFirstRecords(normalizeRecords(response.data || []));
  renderRecordList(records);

  if (!selectedRecordId) {
    resetFormForNewRecord();
  } else {
    selectRecordById(selectedRecordId);
  }
} // End of loadRecords

function renderRecordList(nextRecords) {
  recordList.innerHTML = "";
  recordCountText.textContent = `${nextRecords.length}개`;

  if (!nextRecords.length) {
    const empty = document.createElement("div");
    empty.className = "empty-records";
    empty.textContent = "등록된 기록이 없습니다.";
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
  date.textContent = record.event_date;

  const title = document.createElement("div");
  title.className = "record-title";
  title.textContent = record.title;

  const meta = document.createElement("div");
  meta.className = "record-meta";
  meta.textContent = record.badge_text;

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
  let record = null;

  for (let index = 0; index < records.length; index += 1) {
    if (records[index].id === nextRecordId) {
      record = records[index];
      break;
    }
  }

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
  recordId.value = record.id;
  eventDate.value = getDateInputValue(record.event_date);
  badgeColor.value = sanitizeBadgeColor(record.badge_color);
  badgeText.value = record.badge_text;
  eventTitle.value = record.title;
  description.value = record.description;
  imageUrl.value = record.image_url;
  formTitle.textContent = "기록 수정";
  formSubtitle.textContent = record.title;
  deleteButton.classList.remove("d-none");
  renderArticleRows(record.articles);
  updateImagePreview();
  renderIcons();
} // End of renderRecordForm

function resetFormForNewRecord() {
  selectedRecordId = "";
  recordId.value = "";
  eventDate.value = "";
  badgeColor.value = "primary";
  badgeText.value = "";
  eventTitle.value = "";
  description.value = "";
  imageUrl.value = "";
  imageFile.value = "";
  formTitle.textContent = "새 기록";
  formSubtitle.textContent = "저장 전";
  deleteButton.classList.add("d-none");
  renderArticleRows([]);
  updateImagePreview();
  renderRecordList(records);
  renderIcons();
} // End of resetFormForNewRecord

function handleNewRecordClick() {
  resetFormForNewRecord();
  setStatus("새 기록을 작성합니다.", "neutral");
} // End of handleNewRecordClick

async function handleRefreshClick() {
  await loadRecords();
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
  setStatus("저장되었습니다.", "success");
  await loadRecords();
  selectRecordById(savedRecord.id);
} // End of handleSaveSubmit

function buildPayloadFromForm() {
  if (!eventDate.value.trim() || !badgeText.value.trim() || !eventTitle.value.trim()) {
    setStatus("날짜, 배지, 제목은 필수입니다.", "danger");
    return null;
  }

  const payload = {
    event_date: formatDateForStorage(eventDate.value),
    badge_text: badgeText.value.trim(),
    badge_color: sanitizeBadgeColor(badgeColor.value),
    title: eventTitle.value.trim(),
    description: description.value.trim() || null,
    image_url: imageUrl.value.trim() || null,
    articles: getArticlesFromForm()
  };

  return payload;
} // End of buildPayloadFromForm

function getArticlesFromForm() {
  const rows = Array.from(articleRows.querySelectorAll(".article-row"));
  const articles = [];

  for (let index = 0; index < rows.length; index += 1) {
    const titleInput = rows[index].querySelector(".article-title-input");
    const urlInput = rows[index].querySelector(".article-url-input");
    const titleValue = titleInput ? titleInput.value.trim() : "";
    const urlValue = urlInput ? urlInput.value.trim() : "";

    if (titleValue && urlValue) {
      articles.push({
        title: titleValue,
        url: urlValue
      });
    }
  }

  return articles;
} // End of getArticlesFromForm

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

  const shouldDelete = window.confirm("이 기록을 삭제할까요?");
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
  setStatus("삭제되었습니다.", "success");
  await loadRecords();
  resetFormForNewRecord();
} // End of handleDeleteClick

async function handleUploadImageClick() {
  const file = imageFile.files && imageFile.files.length ? imageFile.files[0] : null;

  if (!file) {
    setStatus("업로드할 사진을 선택하세요.", "danger");
    return;
  }

  if (!isAllowedImageFile(file)) {
    setStatus("JPG, PNG, WebP, GIF, HEIC 형식의 15MB 이하 사진만 업로드할 수 있습니다.", "danger");
    return;
  }

  uploadImageButton.disabled = true;
  setStatus("사진을 업로드하는 중입니다.", "neutral");

  const publicUrl = await uploadImage(file);
  uploadImageButton.disabled = false;

  if (!publicUrl) {
    return;
  }

  imageUrl.value = publicUrl;
  updateImagePreview();

  if (recordId.value.trim()) {
    await saveCurrentRecordImageUrl(publicUrl);
    return;
  }

  setStatus("사진 업로드가 완료되었습니다. 새 기록 저장을 누르면 화면에 반영됩니다.", "success");
} // End of handleUploadImageClick

function isAllowedImageFile(file) {
  if (!file || !getAllowedImageType(file)) {
    return false;
  }

  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return false;
  }

  return true;
} // End of isAllowedImageFile

function getAllowedImageType(file) {
  if (!file) {
    return "";
  }

  if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return file.type;
  }

  const extension = getFileExtension(file.name);
  return IMAGE_TYPE_BY_EXTENSION[extension] || "";
} // End of getAllowedImageType

function getFileExtension(fileName) {
  const normalizedName = String(fileName || "").trim().toLowerCase();
  const segments = normalizedName.split(".");

  if (segments.length < 2) {
    return "";
  }

  return segments[segments.length - 1];
} // End of getFileExtension

async function saveCurrentRecordImageUrl(publicUrl) {
  const currentId = recordId.value.trim();

  if (!currentId) {
    return;
  }

  const response = await supabaseClient
    .from(TABLE_NAME)
    .update({
      image_url: publicUrl
    })
    .eq("id", currentId)
    .select("*")
    .single();

  if (response.error) {
    setStatus(response.error.message, "danger");
    return;
  }

  setStatus("사진 업로드와 기록 반영이 완료되었습니다.", "success");
  await loadRecords();
  selectRecordById(currentId);
} // End of saveCurrentRecordImageUrl

async function uploadImage(file) {
  const storagePath = buildStoragePath(file);
  const contentType = getAllowedImageType(file);
  const uploadResponse = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: contentType,
      upsert: false
    });

  if (uploadResponse.error) {
    setStatus(uploadResponse.error.message, "danger");
    return "";
  }

  const publicUrlResponse = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return publicUrlResponse.data && publicUrlResponse.data.publicUrl ? publicUrlResponse.data.publicUrl : "";
} // End of uploadImage

function buildStoragePath(file) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const randomSegment = getRandomSegment();
  const fileName = sanitizeFileSegment(file.name || "event-image");
  return `timeline-history/${year}/${month}/${Date.now()}-${randomSegment}-${fileName}`;
} // End of buildStoragePath

function getRandomSegment() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
} // End of getRandomSegment

function sanitizeFileSegment(value) {
  const normalizedValue = String(value || "image").trim().toLowerCase();
  const safeValue = normalizedValue.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  if (safeValue) {
    return safeValue;
  }

  return "image";
} // End of sanitizeFileSegment

function handleClearImageClick() {
  imageUrl.value = "";
  imageFile.value = "";
  updateImagePreview();
} // End of handleClearImageClick

function handleImageUrlInput() {
  updateImagePreview();
} // End of handleImageUrlInput

function updateImagePreview() {
  const value = imageUrl.value.trim();

  if (!value) {
    imagePreview.removeAttribute("src");
    imagePreviewWrap.classList.add("d-none");
    return;
  }

  imagePreview.src = value;
  imagePreviewWrap.classList.remove("d-none");
} // End of updateImagePreview

function handleAddArticleClick() {
  appendArticleRow({
    title: "",
    url: ""
  });
  renderIcons();
} // End of handleAddArticleClick

function renderArticleRows(articles) {
  articleRows.innerHTML = "";

  for (let index = 0; index < articles.length; index += 1) {
    appendArticleRow(articles[index]);
  }
} // End of renderArticleRows

function appendArticleRow(article) {
  articleRows.appendChild(createArticleRow(article));
} // End of appendArticleRow

function createArticleRow(article) {
  const row = document.createElement("div");
  row.className = "article-row";

  const titleInput = document.createElement("input");
  titleInput.className = "form-control article-title-input";
  titleInput.type = "text";
  titleInput.placeholder = "기사 제목";
  titleInput.value = article && article.title ? article.title : "";

  const urlInput = document.createElement("input");
  urlInput.className = "form-control article-url-input";
  urlInput.type = "url";
  urlInput.placeholder = "https://";
  urlInput.value = article && article.url ? article.url : "";

  const removeButton = document.createElement("button");
  removeButton.className = "btn btn-outline-danger icon-only article-remove-button";
  removeButton.type = "button";
  removeButton.setAttribute("aria-label", "기사 삭제");
  removeButton.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';

  row.appendChild(titleInput);
  row.appendChild(urlInput);
  row.appendChild(removeButton);
  return row;
} // End of createArticleRow

function handleArticleRowsClick(event) {
  const button = event.target.closest(".article-remove-button");

  if (!button) {
    return;
  }

  const row = button.closest(".article-row");

  if (row) {
    row.remove();
  }
} // End of handleArticleRowsClick

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
  uploadImageButton.disabled = isBusy;
} // End of setFormBusy

function setStatus(message, type) {
  adminStatus.textContent = message || "";
  adminStatus.classList.remove("is-success", "is-danger", "is-warning", "is-neutral");
  adminStatus.classList.add(`is-${type || "neutral"}`);
} // End of setStatus

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
    id: String(sourceRecord.id || `record-${index + 1}`),
    created_at: String(sourceRecord.created_at || ""),
    event_date: String(sourceRecord.event_date || ""),
    badge_text: String(sourceRecord.badge_text || ""),
    badge_color: sanitizeBadgeColor(sourceRecord.badge_color),
    title: String(sourceRecord.title || ""),
    description: String(sourceRecord.description || ""),
    image_url: String(sourceRecord.image_url || ""),
    articles: normalizeArticles(sourceRecord.articles)
  };
} // End of normalizeRecord

function normalizeArticles(rawArticles) {
  let parsedArticles = rawArticles;
  const normalizedArticles = [];

  if (typeof rawArticles === "string" && rawArticles.trim()) {
    try {
      parsedArticles = JSON.parse(rawArticles);
    } catch (error) {
      console.warn("Article JSON parse failed:", error);
      parsedArticles = [];
    }
  }

  if (!Array.isArray(parsedArticles)) {
    return normalizedArticles;
  }

  for (let index = 0; index < parsedArticles.length; index += 1) {
    const article = parsedArticles[index] || {};
    const title = String(article.title || "").trim();
    const url = String(article.url || "").trim();

    if (title && url) {
      normalizedArticles.push({
        title: title,
        url: url
      });
    }
  }

  return normalizedArticles;
} // End of normalizeArticles

function getNewestFirstRecords(nextRecords) {
  return [...nextRecords].sort(compareTimelineRecordsNewestFirst);
} // End of getNewestFirstRecords

function compareTimelineRecordsNewestFirst(firstRecord, secondRecord) {
  const firstDateTime = getEventDateTime(firstRecord.event_date);
  const secondDateTime = getEventDateTime(secondRecord.event_date);

  if (firstDateTime !== secondDateTime) {
    return secondDateTime - firstDateTime;
  }

  return String(secondRecord.created_at || "").localeCompare(String(firstRecord.created_at || ""));
} // End of compareTimelineRecordsNewestFirst

function getDateInputValue(eventDateText) {
  const parsedDate = parseEventDate(eventDateText);

  if (!parsedDate) {
    return "";
  }

  return `${String(parsedDate.year).padStart(4, "0")}-${String(parsedDate.month).padStart(2, "0")}-${String(parsedDate.day).padStart(2, "0")}`;
} // End of getDateInputValue

function formatDateForStorage(dateInputValue) {
  const parsedDate = parseEventDate(dateInputValue);

  if (!parsedDate) {
    return "";
  }

  return `${parsedDate.year}년 ${parsedDate.month}월 ${parsedDate.day}일`;
} // End of formatDateForStorage

function getEventDateTime(eventDateText) {
  const parsedDate = parseEventDate(eventDateText);

  if (!parsedDate) {
    return 0;
  }

  return Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day);
} // End of getEventDateTime

function parseEventDate(eventDateText) {
  const normalizedText = String(eventDateText || "").trim();
  const isoMatch = normalizedText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3])
    };
  }

  const koreanMatch = normalizedText.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);

  if (!koreanMatch) {
    return null;
  }

  return {
    year: Number(koreanMatch[1]),
    month: Number(koreanMatch[2]),
    day: Number(koreanMatch[3])
  };
} // End of parseEventDate

function sanitizeBadgeColor(value) {
  const rawValue = String(value || "primary").trim();

  if (VALID_BADGE_COLORS.includes(rawValue)) {
    return rawValue;
  }

  return "primary";
} // End of sanitizeBadgeColor
