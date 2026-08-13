import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/+esm";
import { TIMELINE_SUPABASE_CONFIG } from "./config.js";

const TABLE_NAME = "agendas";
const ACTIVE_STATUSES = ["proposed", "recruiting", "discussing", "shared"];
const VALID_STATUSES = ["proposed", "recruiting", "discussing", "shared", "completed", "dropped"];
const STATUS_META = {
  proposed: { label: "제안 접수", icon: "lightbulb" },
  recruiting: { label: "참여자 모집", icon: "users" },
  discussing: { label: "논의 중", icon: "messages-square" },
  shared: { label: "운영위 공유", icon: "send" },
  completed: { label: "논의 완료", icon: "circle-check" },
  dropped: { label: "논의 중단", icon: "archive" }
};
const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
};

let supabaseClient = null;
let agendas = [];
let filteredAgendas = [];
let activeAgendaId = "";
let resizeFrameId = 0;
let agendaDataStatus = null;
let totalAgendaCount = null;
let activeAgendaCount = null;
let readyAgendaCount = null;
let agendaSearchInput = null;
let agendaStatusFilter = null;
let agendaFilterReset = null;
let agendaResultText = null;
let agendaGrid = null;

document.addEventListener("DOMContentLoaded", initializeAgendaMarket);

async function initializeAgendaMarket() {
  cacheElements();
  bindEvents();
  renderIcons();
  renderLoadingState();

  const config = getSupabaseConfig();
  if (!isSupabaseConfigured(config)) {
    renderErrorState("Supabase 설정을 확인해 주세요.");
    return;
  }

  supabaseClient = createClient(config.url, config.anonKey);
  await fetchAgendas();
  subscribeToAgendaUpdates();
} // End of initializeAgendaMarket

function cacheElements() {
  agendaDataStatus = document.getElementById("agendaDataStatus");
  totalAgendaCount = document.getElementById("totalAgendaCount");
  activeAgendaCount = document.getElementById("activeAgendaCount");
  readyAgendaCount = document.getElementById("readyAgendaCount");
  agendaSearchInput = document.getElementById("agendaSearchInput");
  agendaStatusFilter = document.getElementById("agendaStatusFilter");
  agendaFilterReset = document.getElementById("agendaFilterReset");
  agendaResultText = document.getElementById("agendaResultText");
  agendaGrid = document.getElementById("agendaGrid");
} // End of cacheElements

function bindEvents() {
  agendaSearchInput.addEventListener("input", handleFilterChange);
  agendaStatusFilter.addEventListener("change", handleFilterChange);
  agendaFilterReset.addEventListener("click", handleFilterReset);
  agendaGrid.addEventListener("click", handleAgendaGridClick);
  document.addEventListener("keydown", handleDocumentKeydown);
  window.addEventListener("resize", handleWindowResize);
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

async function fetchAgendas() {
  try {
    const response = await supabaseClient
      .from(TABLE_NAME)
      .select("*")
      .order("updated_at", { ascending: false });

    if (response.error) {
      throw response.error;
    }

    agendas = sortAgendas(normalizeAgendas(response.data || []));
    renderSummary(agendas);
    applyFilters();
    renderDataStatus(agendas.length);
  } catch (error) {
    console.error("Agenda fetch failed:", error);
    renderErrorState("의제 기록을 불러오지 못했습니다.");
  }
} // End of fetchAgendas

function subscribeToAgendaUpdates() {
  supabaseClient
    .channel("agenda-market-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: TABLE_NAME
      },
      handleRealtimeChange
    )
    .subscribe(handleSubscriptionStatus);
} // End of subscribeToAgendaUpdates

function handleRealtimeChange() {
  fetchAgendas();
} // End of handleRealtimeChange

function handleSubscriptionStatus(status, error) {
  if (error) {
    console.warn("Agenda realtime subscription warning:", error);
  }

  if (status === "SUBSCRIBED") {
    renderDataStatus(agendas.length);
  }
} // End of handleSubscriptionStatus

function normalizeAgendas(rawAgendas) {
  const normalizedAgendas = [];

  for (let index = 0; index < rawAgendas.length; index += 1) {
    normalizedAgendas.push(normalizeAgenda(rawAgendas[index], index));
  }

  return normalizedAgendas;
} // End of normalizeAgendas

function normalizeAgenda(rawAgenda, index) {
  const sourceAgenda = rawAgenda || {};
  return {
    id: String(sourceAgenda.id || `agenda-${index + 1}`),
    created_at: String(sourceAgenda.created_at || ""),
    updated_at: String(sourceAgenda.updated_at || sourceAgenda.created_at || ""),
    proposed_date: normalizeDateValue(sourceAgenda.proposed_date),
    title: String(sourceAgenda.title || "제목 없음").trim(),
    category: String(sourceAgenda.category || "").trim(),
    summary: String(sourceAgenda.summary || "").trim(),
    description: String(sourceAgenda.description || "").trim(),
    status: sanitizeStatus(sourceAgenda.status),
    status_note: String(sourceAgenda.status_note || "").trim(),
    participants: normalizeStringArray(sourceAgenda.participants),
    tags: normalizeStringArray(sourceAgenda.tags),
    updates: normalizeUpdates(sourceAgenda.updates),
    next_meeting_at: normalizeDateTimeValue(sourceAgenda.next_meeting_at),
    next_meeting_location: String(sourceAgenda.next_meeting_location || "").trim()
  };
} // End of normalizeAgenda

function normalizeStringArray(value) {
  let sourceValues = value;
  const normalizedValues = [];

  if (typeof sourceValues === "string" && sourceValues.trim()) {
    try {
      sourceValues = JSON.parse(sourceValues);
    } catch (error) {
      sourceValues = sourceValues.split(/\r?\n|,/);
    }
  }

  if (!Array.isArray(sourceValues)) {
    return normalizedValues;
  }

  for (let index = 0; index < sourceValues.length; index += 1) {
    const rawItem = sourceValues[index];
    const itemValue = typeof rawItem === "object" && rawItem
      ? String(rawItem.name || rawItem.label || "").trim()
      : String(rawItem || "").trim();

    if (itemValue && !normalizedValues.includes(itemValue)) {
      normalizedValues.push(itemValue);
    }
  }

  return normalizedValues;
} // End of normalizeStringArray

function normalizeUpdates(value) {
  let sourceUpdates = value;
  const normalizedUpdates = [];

  if (typeof sourceUpdates === "string" && sourceUpdates.trim()) {
    try {
      sourceUpdates = JSON.parse(sourceUpdates);
    } catch (error) {
      console.warn("Agenda updates JSON parse failed:", error);
      sourceUpdates = [];
    }
  }

  if (!Array.isArray(sourceUpdates)) {
    return normalizedUpdates;
  }

  for (let index = 0; index < sourceUpdates.length; index += 1) {
    const sourceUpdate = sourceUpdates[index] || {};
    const updateTitle = String(sourceUpdate.title || "").trim();
    const updateContent = String(sourceUpdate.content || "").trim();
    const updateDate = normalizeDateValue(sourceUpdate.date);

    if (updateTitle || updateContent || updateDate) {
      normalizedUpdates.push({
        date: updateDate,
        title: updateTitle || "논의 기록",
        content: updateContent
      });
    }
  }

  return normalizedUpdates.sort(compareUpdatesNewestFirst);
} // End of normalizeUpdates

function compareUpdatesNewestFirst(firstUpdate, secondUpdate) {
  return String(secondUpdate.date || "").localeCompare(String(firstUpdate.date || ""));
} // End of compareUpdatesNewestFirst

function normalizeDateValue(value) {
  const rawValue = String(value || "").trim();
  const match = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
} // End of normalizeDateValue

function normalizeDateTimeValue(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  const parsedDate = new Date(rawValue);
  return Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString();
} // End of normalizeDateTimeValue

function sanitizeStatus(value) {
  const rawValue = String(value || "proposed").trim();
  return VALID_STATUSES.includes(rawValue) ? rawValue : "proposed";
} // End of sanitizeStatus

function sortAgendas(nextAgendas) {
  return [...nextAgendas].sort(compareAgendas);
} // End of sortAgendas

function compareAgendas(firstAgenda, secondAgenda) {
  const firstArchiveRank = getArchiveRank(firstAgenda.status);
  const secondArchiveRank = getArchiveRank(secondAgenda.status);

  if (firstArchiveRank !== secondArchiveRank) {
    return firstArchiveRank - secondArchiveRank;
  }

  const updatedComparison = String(secondAgenda.updated_at || "").localeCompare(String(firstAgenda.updated_at || ""));
  if (updatedComparison !== 0) {
    return updatedComparison;
  }

  return String(secondAgenda.proposed_date || "").localeCompare(String(firstAgenda.proposed_date || ""));
} // End of compareAgendas

function getArchiveRank(status) {
  if (ACTIVE_STATUSES.includes(status)) {
    return 0;
  }

  return status === "completed" ? 1 : 2;
} // End of getArchiveRank

function handleFilterChange() {
  applyFilters();
} // End of handleFilterChange

function handleFilterReset() {
  agendaSearchInput.value = "";
  agendaStatusFilter.value = "all";
  applyFilters();
  agendaSearchInput.focus();
} // End of handleFilterReset

function applyFilters() {
  const query = normalizeSearchText(agendaSearchInput.value);
  const statusFilter = agendaStatusFilter.value;
  const nextFilteredAgendas = [];

  for (let index = 0; index < agendas.length; index += 1) {
    const agenda = agendas[index];

    if (!matchesStatusFilter(agenda, statusFilter)) {
      continue;
    }

    if (query && !getAgendaSearchText(agenda).includes(query)) {
      continue;
    }

    nextFilteredAgendas.push(agenda);
  }

  filteredAgendas = nextFilteredAgendas;
  activeAgendaId = "";
  renderAgendaGrid(filteredAgendas);
  renderResultText(filteredAgendas.length, agendas.length);
} // End of applyFilters

function matchesStatusFilter(agenda, statusFilter) {
  if (!statusFilter || statusFilter === "all") {
    return true;
  }

  if (statusFilter === "active") {
    return ACTIVE_STATUSES.includes(agenda.status);
  }

  return agenda.status === statusFilter;
} // End of matchesStatusFilter

function normalizeSearchText(value) {
  return String(value || "").trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
} // End of normalizeSearchText

function getAgendaSearchText(agenda) {
  const updateText = agenda.updates.map(function mapUpdate(update) {
    return `${update.date} ${update.title} ${update.content}`;
  }).join(" ");
  const searchText = [
    agenda.title,
    agenda.category,
    agenda.summary,
    agenda.description,
    agenda.status_note,
    agenda.participants.join(" "),
    agenda.tags.join(" "),
    agenda.next_meeting_location,
    updateText,
    getStatusMeta(agenda.status).label
  ].join(" ");
  return normalizeSearchText(searchText);
} // End of getAgendaSearchText

function renderLoadingState() {
  agendaGrid.innerHTML = `
    <div class="agenda-loading">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">로딩 중</span>
      </div>
    </div>
  `;
  agendaDataStatus.innerHTML = "<strong>로딩 중</strong><br>의제 기록을 불러오고 있습니다.";
} // End of renderLoadingState

function renderErrorState(message) {
  agendaGrid.innerHTML = `
    <div class="agenda-error">
      <div class="agenda-error-copy">
        <h2>의제 장터를 열 수 없습니다.</h2>
        <p>${escapeHtml(message)}</p>
      </div>
    </div>
  `;
  agendaDataStatus.innerHTML = "<strong>연결을 확인해 주세요.</strong>";
  agendaResultText.textContent = "";
} // End of renderErrorState

function renderAgendaGrid(nextAgendas) {
  agendaGrid.innerHTML = "";

  if (!nextAgendas.length) {
    const isStoreEmpty = agendas.length === 0;
    const emptyTitle = isStoreEmpty ? "아직 등록된 의제가 없습니다." : "조건에 맞는 의제가 없습니다.";
    const emptyDescription = isStoreEmpty
      ? "운영위가 의제를 접수해 기록하면 이곳에서 논의 과정을 확인할 수 있습니다."
      : "검색어나 진행 상태를 바꿔 다시 확인해 주세요.";
    agendaGrid.innerHTML = `
      <div class="agenda-empty">
        <div class="agenda-empty-copy">
          <h2>${escapeHtml(emptyTitle)}</h2>
          <p>${escapeHtml(emptyDescription)}</p>
        </div>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let index = 0; index < nextAgendas.length; index += 1) {
    fragment.appendChild(createAgendaCard(nextAgendas[index]));
  }

  agendaGrid.appendChild(fragment);
  renderIcons();
} // End of renderAgendaGrid

function createAgendaCard(agenda) {
  const card = document.createElement("article");
  const statusMeta = getStatusMeta(agenda.status);
  const participantCount = agenda.participants.length;
  const progressPercent = Math.min(100, Math.round((participantCount / 3) * 100));
  const progressLabel = participantCount >= 3
    ? `장터 개설 기준 충족 · ${participantCount}명`
    : `${participantCount}/3명 모임 기준`;
  card.className = `agenda-card is-${agenda.status}`;
  card.dataset.agendaId = agenda.id;
  card.innerHTML = `
    <div class="agenda-card-header">
      <span class="agenda-status-badge">
        <i data-lucide="${statusMeta.icon}" aria-hidden="true"></i>
        ${escapeHtml(statusMeta.label)}
      </span>
      <time class="agenda-card-date" datetime="${escapeHtml(agenda.proposed_date)}">${escapeHtml(formatDate(agenda.proposed_date))}</time>
    </div>
    <div class="agenda-card-category">${escapeHtml(agenda.category || "시민 제안")}</div>
    <h2 class="agenda-card-title">${escapeHtml(agenda.title)}</h2>
    <p class="agenda-card-summary">${escapeHtml(agenda.summary || agenda.description || "상세 내용을 준비 중입니다.")}</p>
    <div class="agenda-card-footer">
      <div class="agenda-participant-progress" aria-label="${escapeHtml(progressLabel)}">
        <div class="agenda-progress-copy">
          <span>함께 논의하는 사람</span>
          <strong>${escapeHtml(progressLabel)}</strong>
        </div>
        <div class="agenda-progress-track" aria-hidden="true">
          <span class="agenda-progress-fill" style="width: ${progressPercent}%"></span>
        </div>
      </div>
      <button class="agenda-card-button" type="button" data-agenda-id="${escapeHtml(agenda.id)}" aria-expanded="false">
        <span>상세 보기</span>
        <i data-lucide="arrow-down" aria-hidden="true"></i>
      </button>
    </div>
  `;
  return card;
} // End of createAgendaCard

function handleAgendaGridClick(event) {
  const closeButton = event.target.closest(".agenda-detail-close");
  if (closeButton) {
    closeAgendaDetail();
    return;
  }

  const detailButton = event.target.closest(".agenda-card-button");
  if (!detailButton) {
    return;
  }

  toggleAgendaDetail(detailButton.dataset.agendaId || "");
} // End of handleAgendaGridClick

function toggleAgendaDetail(agendaId) {
  if (activeAgendaId === agendaId) {
    closeAgendaDetail();
    return;
  }

  const agenda = findAgendaById(agendaId);
  if (!agenda) {
    return;
  }

  closeAgendaDetail();
  activeAgendaId = agenda.id;
  const card = agendaGrid.querySelector(`.agenda-card[data-agenda-id="${escapeCssValue(agenda.id)}"]`);

  if (!card) {
    activeAgendaId = "";
    return;
  }

  card.classList.add("is-active");
  const button = card.querySelector(".agenda-card-button");
  if (button) {
    button.setAttribute("aria-expanded", "true");
    button.innerHTML = '<span>상세 닫기</span><i data-lucide="arrow-up" aria-hidden="true"></i>';
  }

  insertAgendaDetail(agenda, card);
  renderIcons();
} // End of toggleAgendaDetail

function insertAgendaDetail(agenda, selectedCard) {
  const detail = createAgendaDetail(agenda);
  const cards = Array.from(agendaGrid.querySelectorAll(".agenda-card"));
  const selectedIndex = cards.indexOf(selectedCard);
  const columnCount = getAgendaGridColumnCount();
  const rowEndIndex = Math.min(cards.length - 1, (Math.floor(selectedIndex / columnCount) + 1) * columnCount - 1);
  const rowEndCard = cards[rowEndIndex] || selectedCard;
  rowEndCard.insertAdjacentElement("afterend", detail);
  detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
} // End of insertAgendaDetail

function getAgendaGridColumnCount() {
  const templateColumns = window.getComputedStyle(agendaGrid).gridTemplateColumns;
  const columnParts = templateColumns.split(" ").filter(Boolean);
  return Math.max(1, columnParts.length);
} // End of getAgendaGridColumnCount

function createAgendaDetail(agenda) {
  const detail = document.createElement("section");
  const statusMeta = getStatusMeta(agenda.status);
  detail.className = "agenda-detail";
  detail.dataset.detailFor = agenda.id;
  detail.setAttribute("aria-label", `${agenda.title} 상세 내용`);
  detail.innerHTML = `
    <div class="agenda-detail-header">
      <div>
        <span class="agenda-status-badge">
          <i data-lucide="${statusMeta.icon}" aria-hidden="true"></i>
          ${escapeHtml(statusMeta.label)}
        </span>
        <h2 class="agenda-detail-title">${escapeHtml(agenda.title)}</h2>
        <p class="agenda-detail-meta">${escapeHtml(agenda.category || "시민 제안")} · ${escapeHtml(formatDate(agenda.proposed_date))} 제안</p>
      </div>
      <button class="agenda-detail-close" type="button" aria-label="상세 내용 닫기">
        <i data-lucide="x" aria-hidden="true"></i>
      </button>
    </div>
    <div class="agenda-detail-body">
      ${buildAgendaDescriptionHtml(agenda)}
      <div class="agenda-detail-grid">
        ${buildParticipantsHtml(agenda.participants)}
        ${buildNextMeetingHtml(agenda)}
      </div>
      ${buildUpdatesHtml(agenda.updates)}
      ${buildTagsHtml(agenda.tags)}
    </div>
  `;
  return detail;
} // End of createAgendaDetail

function buildAgendaDescriptionHtml(agenda) {
  const summaryHtml = agenda.summary
    ? `<p class="agenda-detail-lead">${escapeHtml(agenda.summary)}</p>`
    : "";
  const descriptionHtml = agenda.description
    ? `<p class="agenda-detail-description">${escapeHtml(agenda.description)}</p>`
    : "";
  const statusNoteHtml = agenda.status_note
    ? `
      <div class="agenda-status-note">
        <strong>${agenda.status === "dropped" ? "중단 기록" : "현재 상태"}</strong><br>
        ${escapeHtml(agenda.status_note)}
      </div>
    `
    : "";

  if (!summaryHtml && !descriptionHtml && !statusNoteHtml) {
    return '<p class="agenda-muted-copy">상세 내용을 준비 중입니다.</p>';
  }

  return `<section class="agenda-detail-section">${summaryHtml}${descriptionHtml}${statusNoteHtml}</section>`;
} // End of buildAgendaDescriptionHtml

function buildParticipantsHtml(participants) {
  if (!participants.length) {
    return `
      <section class="agenda-detail-section">
        <h3>함께 논의하는 사람</h3>
        <p class="agenda-muted-copy">공개된 참여자가 아직 없습니다.</p>
      </section>
    `;
  }

  let participantItems = "";
  for (let index = 0; index < participants.length; index += 1) {
    const participantName = participants[index];
    participantItems += `
      <li class="agenda-participant">
        <span class="agenda-participant-initial" aria-hidden="true">${escapeHtml(getInitial(participantName))}</span>
        ${escapeHtml(participantName)}
      </li>
    `;
  }

  return `
    <section class="agenda-detail-section">
      <h3>함께 논의하는 사람 · ${participants.length}명</h3>
      <ul class="agenda-participant-list">${participantItems}</ul>
    </section>
  `;
} // End of buildParticipantsHtml

function buildNextMeetingHtml(agenda) {
  if (!agenda.next_meeting_at && !agenda.next_meeting_location) {
    return `
      <section class="agenda-detail-section">
        <h3>다음 모임</h3>
        <p class="agenda-muted-copy">예정된 모임이 없습니다.</p>
      </section>
    `;
  }

  const dateLine = agenda.next_meeting_at
    ? `<div class="agenda-meeting-line"><i data-lucide="calendar-clock" aria-hidden="true"></i><span>${escapeHtml(formatDateTime(agenda.next_meeting_at))}</span></div>`
    : "";
  const locationLine = agenda.next_meeting_location
    ? `<div class="agenda-meeting-line"><i data-lucide="map-pin" aria-hidden="true"></i><span>${escapeHtml(agenda.next_meeting_location)}</span></div>`
    : "";
  return `
    <section class="agenda-detail-section">
      <h3>다음 모임</h3>
      <div class="agenda-meeting-block">${dateLine}${locationLine}</div>
    </section>
  `;
} // End of buildNextMeetingHtml

function buildUpdatesHtml(updates) {
  if (!updates.length) {
    return `
      <section class="agenda-detail-section">
        <h3>빌드업 기록</h3>
        <p class="agenda-muted-copy">등록된 논의 기록이 없습니다.</p>
      </section>
    `;
  }

  let updateItems = "";
  for (let index = 0; index < updates.length; index += 1) {
    const update = updates[index];
    updateItems += `
      <li class="agenda-history-item">
        <time class="agenda-history-date" datetime="${escapeHtml(update.date)}">${escapeHtml(formatDate(update.date))}</time>
        <h4 class="agenda-history-title">${escapeHtml(update.title)}</h4>
        ${update.content ? `<p class="agenda-history-content">${escapeHtml(update.content)}</p>` : ""}
      </li>
    `;
  }

  return `
    <section class="agenda-detail-section">
      <h3>빌드업 기록</h3>
      <ol class="agenda-history">${updateItems}</ol>
    </section>
  `;
} // End of buildUpdatesHtml

function buildTagsHtml(tags) {
  if (!tags.length) {
    return "";
  }

  let tagItems = "";
  for (let index = 0; index < tags.length; index += 1) {
    tagItems += `<li class="agenda-tag">#${escapeHtml(tags[index])}</li>`;
  }

  return `
    <section class="agenda-detail-section">
      <h3>관련 키워드</h3>
      <ul class="agenda-tag-list">${tagItems}</ul>
    </section>
  `;
} // End of buildTagsHtml

function closeAgendaDetail() {
  const detail = agendaGrid.querySelector(".agenda-detail");
  if (detail) {
    detail.remove();
  }

  const activeCard = agendaGrid.querySelector(".agenda-card.is-active");
  if (activeCard) {
    activeCard.classList.remove("is-active");
    const button = activeCard.querySelector(".agenda-card-button");
    if (button) {
      button.setAttribute("aria-expanded", "false");
      button.innerHTML = '<span>상세 보기</span><i data-lucide="arrow-down" aria-hidden="true"></i>';
    }
  }

  activeAgendaId = "";
  renderIcons();
} // End of closeAgendaDetail

function handleDocumentKeydown(event) {
  if (event.key === "Escape" && activeAgendaId) {
    closeAgendaDetail();
  }
} // End of handleDocumentKeydown

function handleWindowResize() {
  if (!activeAgendaId) {
    return;
  }

  window.cancelAnimationFrame(resizeFrameId);
  resizeFrameId = window.requestAnimationFrame(repositionActiveDetail);
} // End of handleWindowResize

function repositionActiveDetail() {
  const agendaId = activeAgendaId;
  const agenda = findAgendaById(agendaId);
  const card = agendaGrid.querySelector(`.agenda-card[data-agenda-id="${escapeCssValue(agendaId)}"]`);
  const detail = agendaGrid.querySelector(".agenda-detail");

  if (!agenda || !card || !detail) {
    return;
  }

  detail.remove();
  const cards = Array.from(agendaGrid.querySelectorAll(".agenda-card"));
  const selectedIndex = cards.indexOf(card);
  const columnCount = getAgendaGridColumnCount();
  const rowEndIndex = Math.min(cards.length - 1, (Math.floor(selectedIndex / columnCount) + 1) * columnCount - 1);
  const rowEndCard = cards[rowEndIndex] || card;
  rowEndCard.insertAdjacentElement("afterend", detail);
} // End of repositionActiveDetail

function findAgendaById(agendaId) {
  for (let index = 0; index < filteredAgendas.length; index += 1) {
    if (filteredAgendas[index].id === agendaId) {
      return filteredAgendas[index];
    }
  }

  return null;
} // End of findAgendaById

function renderSummary(nextAgendas) {
  let activeCount = 0;
  let readyCount = 0;

  for (let index = 0; index < nextAgendas.length; index += 1) {
    if (ACTIVE_STATUSES.includes(nextAgendas[index].status)) {
      activeCount += 1;
    }

    if (nextAgendas[index].participants.length >= 3 && ACTIVE_STATUSES.includes(nextAgendas[index].status)) {
      readyCount += 1;
    }
  }

  totalAgendaCount.textContent = String(nextAgendas.length);
  activeAgendaCount.textContent = String(activeCount);
  readyAgendaCount.textContent = String(readyCount);
} // End of renderSummary

function renderDataStatus(count) {
  agendaDataStatus.innerHTML = `<strong>현재 ${escapeHtml(String(count))}개의 의제 기록이 있습니다.</strong>`;
} // End of renderDataStatus

function renderResultText(resultCount, totalCount) {
  if (!totalCount) {
    agendaResultText.textContent = "등록된 의제가 없습니다.";
    return;
  }

  agendaResultText.textContent = `전체 ${totalCount}개 중 ${resultCount}개를 표시합니다.`;
} // End of renderResultText

function getStatusMeta(status) {
  return STATUS_META[sanitizeStatus(status)];
} // End of getStatusMeta

function getInitial(name) {
  const normalizedName = String(name || "").trim();
  return normalizedName ? Array.from(normalizedName)[0] : "·";
} // End of getInitial

function formatDate(dateValue) {
  const normalizedDate = normalizeDateValue(dateValue);

  if (!normalizedDate) {
    return "날짜 미정";
  }

  const parts = normalizedDate.split("-");
  return `${Number(parts[0])}년 ${Number(parts[1])}월 ${Number(parts[2])}일`;
} // End of formatDate

function formatDateTime(dateTimeValue) {
  const parsedDate = new Date(dateTimeValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "일정 미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(parsedDate);
} // End of formatDateTime

function escapeCssValue(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(String(value || ""));
  }

  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "\\$&");
} // End of escapeCssValue

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, function replaceCharacter(character) {
    return HTML_ESCAPE_MAP[character];
  });
} // End of escapeHtml
