import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/+esm";
import { TIMELINE_SUPABASE_CONFIG } from "./config.js";

const VALID_BADGE_COLORS = ["primary", "secondary", "success", "info", "dark", "warning"];
const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
};

const FALLBACK_TIMELINE_DATA = [
  {
    id: "seed-01",
    event_date: "2026년 2월 11일",
    badge_text: "TFT 빌드업",
    badge_color: "secondary",
    title: "1차 TFT 회의",
    description: "시민공론장 준비를 위한 첫 TFT 회의가 열렸습니다. 운영 방향, 의제 발굴 방식, 후속 실무 논의 체계를 점검했습니다.",
    image_url: "",
    articles: []
  },
  {
    id: "seed-02",
    event_date: "2026년 2월 26일",
    badge_text: "TFT 빌드업",
    badge_color: "secondary",
    title: "2차 회의",
    description: "1차 논의 내용을 바탕으로 세부 추진 일정을 조정하고, 제안서 작성과 참여자 협의 범위를 구체화했습니다.",
    image_url: "",
    articles: []
  },
  {
    id: "seed-03",
    event_date: "2026년 3월 3일 ~ 9일",
    badge_text: "의제 수렴",
    badge_color: "info",
    title: "제안서 및 세부 논의",
    description: "공론장 의제와 제안서 초안을 중심으로 의견을 수렴하고, 행사 구성과 정책 제안의 핵심 문장을 다듬었습니다.",
    image_url: "",
    articles: []
  },
  {
    id: "seed-04",
    event_date: "2026년 3월 10일",
    badge_text: "문서 확정",
    badge_color: "dark",
    title: "제안서 최종 확정",
    description: "시민공론장 진행을 위한 제안서가 최종 확정되었습니다. 이후 행사 준비와 대외 공유에 사용할 기준 문서로 정리했습니다.",
    image_url: "",
    articles: []
  },
  {
    id: "seed-05",
    event_date: "2026년 4월 2일 (15:00 ~ 17:30)",
    badge_text: "본 행사",
    badge_color: "primary",
    title: "제1차 공론장 진행",
    description: "용인문화원 국제회의실에서 제1차 시민공론장이 진행되었습니다. 이 항목은 Supabase Dashboard에서 행사 사진 image_url과 관련 기사 articles JSON을 함께 매핑해 관리하는 핵심 기록입니다.",
    image_url: "",
    articles: []
  },
  {
    id: "seed-06",
    event_date: "2026년 4월 6일",
    badge_text: "후속 조치",
    badge_color: "success",
    title: "공론 후 모임",
    description: "공론장 이후 참여자들이 모여 결과를 복기하고, 다음 정책 제안과 추가 협의에 필요한 후속 과제를 정리했습니다.",
    image_url: "",
    articles: []
  },
  {
    id: "seed-07",
    event_date: "2026년 4월 22일",
    badge_text: "정책 제안",
    badge_color: "info",
    title: "용인시장 후보 간담회 (현근택)",
    description: "시민공론장 결과와 제안 내용을 용인시장 후보 간담회에서 공유하고, 정책 반영 가능성을 논의했습니다.",
    image_url: "",
    articles: []
  },
  {
    id: "seed-08",
    event_date: "2026년 4월 29일",
    badge_text: "정책 제안",
    badge_color: "info",
    title: "용인시장 후보 간담회 (이상일)",
    description: "용인시장 후보와 시민공론장 의제 및 제안 사항을 공유하고, 지역 정책으로 이어질 수 있는 접점을 확인했습니다.",
    image_url: "",
    articles: []
  },
  {
    id: "seed-09",
    event_date: "2026년 5월 4일",
    badge_text: "후속 조치",
    badge_color: "success",
    title: "공론 후 모임 2차",
    description: "후속 모임을 통해 정책 제안 이후의 대응 방향과 시민 참여 기반 확대 방안을 이어서 논의했습니다.",
    image_url: "",
    articles: []
  },
  {
    id: "seed-10",
    event_date: "2026년 5월 11일",
    badge_text: "후속 조치",
    badge_color: "success",
    title: "공론 후 모임 3차",
    description: "공론장 성과를 정리하고, 후보 협약식과 향후 활동을 준비하기 위한 세부 역할을 조율했습니다.",
    image_url: "",
    articles: []
  },
  {
    id: "seed-11",
    event_date: "2026년 5월 26일",
    badge_text: "성과 확보",
    badge_color: "primary",
    title: "용인시장 후보 협약식 (현근택)",
    description: "시민공론장 논의와 정책 제안의 결과를 바탕으로 용인시장 후보 협약식이 진행되었습니다.",
    image_url: "",
    articles: []
  },
  {
    id: "seed-12",
    event_date: "2026년 6월 16일",
    badge_text: "미래 비전",
    badge_color: "dark",
    title: "새시작 모임",
    description: "시민공론장의 기록을 다음 활동으로 잇기 위한 새시작 모임이 열렸습니다. 이후의 거버넌스 방향을 함께 점검했습니다.",
    image_url: "",
    articles: []
  }
];

let supabaseClient = null;
let timelineRecords = [];
let timelineRoot = null;
let dataStatus = null;
let globalModalElement = null;
let globalModalInstance = null;
let modalBadge = null;
let modalTitle = null;
let modalDate = null;
let modalBody = null;
let fallbackBackdropElement = null;

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  timelineRoot = document.getElementById("timelineRoot");
  dataStatus = document.getElementById("dataStatus");
  globalModalElement = document.getElementById("globalEventModal");
  modalBadge = document.getElementById("modalBadge");
  modalTitle = document.getElementById("globalEventModalLabel");
  modalDate = document.getElementById("modalDate");
  modalBody = document.getElementById("modalBody");

  timelineRoot.addEventListener("click", handleTimelineRootClick);
  timelineRoot.addEventListener("keydown", handleTimelineRootKeydown);
  globalModalElement.addEventListener("click", handleGlobalModalClick);
  document.addEventListener("keydown", handleDocumentKeydown);

  renderLoadingState();

  const config = getSupabaseConfig();
  if (!isSupabaseConfigured(config)) {
    renderFallbackTimeline("참조 데이터");
    return;
  }

  supabaseClient = createClient(config.url, config.anonKey);
  await fetchTimelineData(true);
  subscribeToTimelineUpdates();
} // End of initializeApp

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

async function fetchTimelineData(shouldShowLoading) {
  if (shouldShowLoading) {
    renderLoadingState();
  }

  try {
    const response = await supabaseClient
      .from("timeline_history")
      .select("*")
      .order("created_at", { ascending: false });

    if (response.error) {
      throw response.error;
    }

    timelineRecords = getNewestFirstRecords(normalizeTimelineRecords(response.data || []));
    renderTimeline(timelineRecords);
    renderDataStatus("Supabase", timelineRecords.length);
  } catch (error) {
    console.error("Timeline fetch failed:", error);
    renderFallbackTimeline("Supabase 연결 오류로 참조 데이터");
  }
} // End of fetchTimelineData

function subscribeToTimelineUpdates() {
  supabaseClient
    .channel("timeline-history-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "timeline_history"
      },
      handleRealtimeChange
    )
    .subscribe(handleSubscriptionStatus);
} // End of subscribeToTimelineUpdates

function handleRealtimeChange(payload) {
  console.info("Timeline realtime change:", payload);
  fetchTimelineData(false);
} // End of handleRealtimeChange

function handleSubscriptionStatus(status, error) {
  if (error) {
    console.warn("Supabase realtime subscription warning:", error);
  }

  if (status === "SUBSCRIBED") {
    renderDataStatus("Supabase realtime", timelineRecords.length);
  }
} // End of handleSubscriptionStatus

function renderFallbackTimeline(sourceLabel) {
  timelineRecords = getNewestFirstRecords(normalizeTimelineRecords(FALLBACK_TIMELINE_DATA));
  renderTimeline(timelineRecords);
  renderDataStatus(sourceLabel, timelineRecords.length);
} // End of renderFallbackTimeline

function getNewestFirstRecords(records) {
  return [...records].sort(compareTimelineRecordsNewestFirst);
} // End of getNewestFirstRecords

function compareTimelineRecordsNewestFirst(firstRecord, secondRecord) {
  const firstDateTime = getEventDateTime(firstRecord.event_date);
  const secondDateTime = getEventDateTime(secondRecord.event_date);

  if (firstDateTime !== secondDateTime) {
    return secondDateTime - firstDateTime;
  }

  return String(secondRecord.created_at || "").localeCompare(String(firstRecord.created_at || ""));
} // End of compareTimelineRecordsNewestFirst

function getEventDateTime(eventDateText) {
  const eventDate = parseEventDate(eventDateText);

  if (!eventDate) {
    return 0;
  }

  return Date.UTC(eventDate.year, eventDate.month - 1, eventDate.day);
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

  const match = normalizedText.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
} // End of parseEventDate

function normalizeTimelineRecords(records) {
  const normalizedRecords = [];

  for (let index = 0; index < records.length; index += 1) {
    const sourceRecord = records[index] || {};
    const imageUrls = normalizeImageUrls(sourceRecord.image_url);
    normalizedRecords.push({
      id: String(sourceRecord.id || `record-${index + 1}`),
      created_at: String(sourceRecord.created_at || ""),
      event_date: String(sourceRecord.event_date || ""),
      badge_text: String(sourceRecord.badge_text || "기록"),
      badge_color: sanitizeBadgeColor(sourceRecord.badge_color),
      title: String(sourceRecord.title || "제목 없음"),
      description: String(sourceRecord.description || ""),
      image_url: serializeImageUrls(imageUrls),
      image_urls: imageUrls,
      articles: normalizeArticles(sourceRecord.articles)
    });
  }

  return normalizedRecords;
} // End of normalizeTimelineRecords

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
    const url = sanitizeHttpUrl(article.url);
    const title = String(article.title || "").trim();

    if (title && url) {
      normalizedArticles.push({
        title: title,
        url: url
      });
    }
  }

  return normalizedArticles;
} // End of normalizeArticles

function normalizeImageUrls(value) {
  const rawValue = String(value || "").trim();
  const imageUrls = [];

  if (!rawValue) {
    return imageUrls;
  }

  const parsedUrls = parseImageUrlValue(rawValue);

  for (let index = 0; index < parsedUrls.length; index += 1) {
    const url = sanitizeHttpUrl(parsedUrls[index]);

    if (url && !imageUrls.includes(url)) {
      imageUrls.push(url);
    }
  }

  return imageUrls;
} // End of normalizeImageUrls

function parseImageUrlValue(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return [];
  }

  if (rawValue.startsWith("[")) {
    try {
      const parsedValue = JSON.parse(rawValue);

      if (Array.isArray(parsedValue)) {
        return parsedValue;
      }
    } catch (error) {
      console.warn("Image URL JSON parse failed:", error);
    }
  }

  return rawValue.split(/\r?\n/);
} // End of parseImageUrlValue

function serializeImageUrls(imageUrls) {
  const normalizedUrls = [];

  for (let index = 0; index < imageUrls.length; index += 1) {
    const url = sanitizeHttpUrl(imageUrls[index]);

    if (url && !normalizedUrls.includes(url)) {
      normalizedUrls.push(url);
    }
  }

  return normalizedUrls.join("\n");
} // End of serializeImageUrls

function renderLoadingState() {
  timelineRoot.innerHTML = `
    <div class="loading-wrap">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">로딩 중</span>
      </div>
    </div>
  `;
  dataStatus.innerHTML = "<strong>로딩 중</strong><br>타임라인 데이터를 불러오고 있습니다.";
} // End of renderLoadingState

function renderTimeline(records) {
  timelineRoot.innerHTML = "";

  if (!records.length) {
    renderEmptyState();
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let index = 0; index < records.length; index += 1) {
    fragment.appendChild(createTimelineRow(records[index], index));
  }

  timelineRoot.appendChild(fragment);
} // End of renderTimeline

function renderEmptyState() {
  timelineRoot.innerHTML = `
    <div class="empty-state">
      <h2>등록된 기록이 없습니다.</h2>
      <p>Supabase Dashboard에서 timeline_history 테이블에 데이터를 추가하면 이 영역에 표시됩니다.</p>
    </div>
  `;
} // End of renderEmptyState

function renderDataStatus(sourceLabel, count) {
  const safeCount = escapeHtml(String(count));
  dataStatus.innerHTML = `<strong>현재 ${safeCount}개의 기록이 있습니다.</strong>`;
} // End of renderDataStatus

function createTimelineRow(record, index) {
  const isLeft = index % 2 === 0;
  const row = document.createElement("div");
  const itemClass = isLeft ? "timeline-item-left" : "timeline-item-right";
  row.className = `row timeline-row ${itemClass}`;

  if (isLeft) {
    row.appendChild(createTimelineColumn(record, "col-12 col-lg-5"));
    row.appendChild(createAxisColumn());
    row.appendChild(createEmptyColumn());
  } else {
    row.appendChild(createEmptyColumn());
    row.appendChild(createAxisColumn());
    row.appendChild(createTimelineColumn(record, "col-12 col-lg-5"));
  }

  return row;
} // End of createTimelineRow

function createTimelineColumn(record, columnClasses) {
  const column = document.createElement("div");
  column.className = columnClasses;
  column.appendChild(createTimelineCard(record));
  return column;
} // End of createTimelineColumn

function createAxisColumn() {
  const column = document.createElement("div");
  column.className = "d-none d-lg-flex col-lg-2 timeline-axis";
  column.innerHTML = '<span class="timeline-dot" aria-hidden="true"></span>';
  return column;
} // End of createAxisColumn

function createEmptyColumn() {
  const column = document.createElement("div");
  column.className = "d-none d-lg-block col-lg-5";
  return column;
} // End of createEmptyColumn

function createTimelineCard(record) {
  const card = document.createElement("button");
  const safeBadgeColor = sanitizeBadgeColor(record.badge_color);
  card.type = "button";
  card.className = "timeline-card";
  card.dataset.eventId = record.id;
  card.timelineRecord = record;
  card.innerHTML = `
    <span class="badge text-bg-${safeBadgeColor}">${escapeHtml(record.badge_text)}</span>
    <div class="timeline-date mt-3">${escapeHtml(record.event_date)}</div>
    <h2 class="timeline-title">${escapeHtml(record.title)}</h2>
    <p class="timeline-description">${escapeHtml(getPreviewDescription(record))}</p>
  `;
  return card;
} // End of createTimelineCard

function handleTimelineRootClick(event) {
  const card = event.target.closest(".timeline-card");

  if (!card) {
    return;
  }

  openTimelineModal(card.timelineRecord);
} // End of handleTimelineRootClick

function handleTimelineRootKeydown(event) {
  const card = event.target.closest(".timeline-card");

  if (!card || (event.key !== "Enter" && event.key !== " ")) {
    return;
  }

  event.preventDefault();
  openTimelineModal(card.timelineRecord);
} // End of handleTimelineRootKeydown

function openTimelineModal(record) {
  if (!record) {
    return;
  }

  const safeBadgeColor = sanitizeBadgeColor(record.badge_color);
  modalBadge.className = `badge text-bg-${safeBadgeColor} mb-2`;
  modalBadge.textContent = record.badge_text;
  modalTitle.textContent = record.title;
  modalDate.textContent = record.event_date;
  modalBody.innerHTML = buildModalBodyHtml(record);

  showGlobalModal();
} // End of openTimelineModal

function showGlobalModal() {
  if (isBootstrapModalAvailable()) {
    if (!globalModalInstance) {
      globalModalInstance = new window.bootstrap.Modal(globalModalElement);
    }

    globalModalInstance.show();
    return;
  }

  showFallbackModal();
} // End of showGlobalModal

function handleGlobalModalClick(event) {
  if (isBootstrapModalAvailable()) {
    return;
  }

  if (event.target === globalModalElement || event.target.closest("[data-bs-dismiss='modal']")) {
    hideFallbackModal();
  }
} // End of handleGlobalModalClick

function handleDocumentKeydown(event) {
  if (event.key !== "Escape" || isBootstrapModalAvailable()) {
    return;
  }

  if (globalModalElement.classList.contains("show")) {
    hideFallbackModal();
  }
} // End of handleDocumentKeydown

function showFallbackModal() {
  ensureFallbackBackdrop();
  globalModalElement.classList.add("show");
  globalModalElement.style.display = "block";
  globalModalElement.removeAttribute("aria-hidden");
  globalModalElement.setAttribute("aria-modal", "true");
  globalModalElement.setAttribute("role", "dialog");
  document.body.classList.add("modal-open");
  document.body.style.overflow = "hidden";
} // End of showFallbackModal

function hideFallbackModal() {
  globalModalElement.classList.remove("show");
  globalModalElement.style.display = "none";
  globalModalElement.setAttribute("aria-hidden", "true");
  globalModalElement.removeAttribute("aria-modal");
  globalModalElement.removeAttribute("role");
  document.body.classList.remove("modal-open");
  document.body.style.overflow = "";
  removeFallbackBackdrop();
} // End of hideFallbackModal

function ensureFallbackBackdrop() {
  if (fallbackBackdropElement) {
    return;
  }

  fallbackBackdropElement = document.createElement("div");
  fallbackBackdropElement.className = "modal-backdrop fade show";
  document.body.appendChild(fallbackBackdropElement);
} // End of ensureFallbackBackdrop

function removeFallbackBackdrop() {
  if (!fallbackBackdropElement) {
    return;
  }

  fallbackBackdropElement.remove();
  fallbackBackdropElement = null;
} // End of removeFallbackBackdrop

function isBootstrapModalAvailable() {
  return Boolean(window.bootstrap && window.bootstrap.Modal);
} // End of isBootstrapModalAvailable

function buildModalBodyHtml(record) {
  const imageHtml = buildImageHtml(record);
  const descriptionHtml = buildDescriptionHtml(record);
  const articlesHtml = buildArticlesHtml(record);
  return `${imageHtml}${descriptionHtml}${articlesHtml}`;
} // End of buildModalBodyHtml

function buildImageHtml(record) {
  const imageUrls = Array.isArray(record.image_urls) ? record.image_urls : normalizeImageUrls(record.image_url);

  if (!imageUrls.length) {
    return "";
  }

  if (imageUrls.length === 1) {
    return `
      <figure class="mb-4">
        <img class="modal-image" src="${escapeHtml(imageUrls[0])}" alt="${escapeHtml(record.title)} 행사 사진">
      </figure>
    `;
  }

  let slideHtml = "";

  for (let index = 0; index < imageUrls.length; index += 1) {
    slideHtml += `
      <figure class="modal-image-slide">
        <img class="modal-image" src="${escapeHtml(imageUrls[index])}" alt="${escapeHtml(record.title)} 행사 사진 ${index + 1}">
        <figcaption>${index + 1} / ${imageUrls.length}</figcaption>
      </figure>
    `;
  }

  return `
    <section class="modal-image-gallery mb-4" aria-label="행사 사진">
      <div class="modal-image-slider">${slideHtml}</div>
    </section>
  `;
} // End of buildImageHtml

function buildDescriptionHtml(record) {
  const description = record.description || "상세 설명이 준비 중입니다.";
  return `
    <div class="modal-description mb-4">${escapeHtml(description)}</div>
  `;
} // End of buildDescriptionHtml

function buildArticlesHtml(record) {
  if (!record.articles.length) {
    return "";
  }

  let articleItemsHtml = "";

  for (let index = 0; index < record.articles.length; index += 1) {
    const article = record.articles[index];
    articleItemsHtml += `
      <li>
        <a class="article-link" href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">
          <span>${escapeHtml(article.title)}</span>
          <span aria-hidden="true">열기</span>
        </a>
      </li>
    `;
  }

  return `
    <h3 class="fs-5 fw-bold mb-3">관련 기사</h3>
    <ul class="article-list">${articleItemsHtml}</ul>
  `;
} // End of buildArticlesHtml

function getPreviewDescription(record) {
  if (record.description) {
    return record.description;
  }

  return "상세 기록을 확인하려면 카드를 선택하세요.";
} // End of getPreviewDescription

function sanitizeBadgeColor(value) {
  const rawValue = String(value || "primary").trim();

  if (VALID_BADGE_COLORS.includes(rawValue)) {
    return rawValue;
  }

  return "primary";
} // End of sanitizeBadgeColor

function sanitizeHttpUrl(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  try {
    const parsedUrl = new URL(rawValue, window.location.href);

    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
      return parsedUrl.href;
    }
  } catch (error) {
    console.warn("Invalid URL skipped:", error);
  }

  return "";
} // End of sanitizeHttpUrl

function escapeHtml(value) {
  const stringValue = String(value || "");
  return stringValue.replace(/[&<>"']/g, replaceHtmlEntity);
} // End of escapeHtml

function replaceHtmlEntity(character) {
  return HTML_ESCAPE_MAP[character] || character;
} // End of replaceHtmlEntity
