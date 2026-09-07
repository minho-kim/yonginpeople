import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/+esm";
import { TIMELINE_SUPABASE_CONFIG } from "./config.js";

const TABLE_NAME = "council_monitoring";
const GROUP_MODES = ["period", "session", "member", "all"];
const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
};

let supabaseClient = null;
let monitoringRecords = [];
let filteredRecords = [];
let activeGroupMode = "period";
let monitoringDataStatus = null;
let monitoringRecordCount = null;
let monitoringSessionCount = null;
let monitoringMemberCount = null;
let monitoringSearchInput = null;
let monitoringYearFilter = null;
let monitoringSessionFilter = null;
let monitoringCommitteeFilter = null;
let monitoringMemberFilter = null;
let monitoringFilterReset = null;
let monitoringResultText = null;
let monitoringGroups = null;
let councilGroupControl = null;

document.addEventListener("DOMContentLoaded", initializeCouncilMonitoring);

async function initializeCouncilMonitoring() {
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
  const didLoadRecords = await fetchMonitoringRecords();
  if (didLoadRecords) {
    subscribeToMonitoringUpdates();
  }
} // End of initializeCouncilMonitoring

function cacheElements() {
  monitoringDataStatus = document.getElementById("monitoringDataStatus");
  monitoringRecordCount = document.getElementById("monitoringRecordCount");
  monitoringSessionCount = document.getElementById("monitoringSessionCount");
  monitoringMemberCount = document.getElementById("monitoringMemberCount");
  monitoringSearchInput = document.getElementById("monitoringSearchInput");
  monitoringYearFilter = document.getElementById("monitoringYearFilter");
  monitoringSessionFilter = document.getElementById("monitoringSessionFilter");
  monitoringCommitteeFilter = document.getElementById("monitoringCommitteeFilter");
  monitoringMemberFilter = document.getElementById("monitoringMemberFilter");
  monitoringFilterReset = document.getElementById("monitoringFilterReset");
  monitoringResultText = document.getElementById("monitoringResultText");
  monitoringGroups = document.getElementById("monitoringGroups");
  councilGroupControl = document.querySelector(".council-segments");
} // End of cacheElements

function bindEvents() {
  monitoringSearchInput.addEventListener("input", handleFilterChange);
  monitoringYearFilter.addEventListener("change", handleFilterChange);
  monitoringSessionFilter.addEventListener("change", handleFilterChange);
  monitoringCommitteeFilter.addEventListener("change", handleFilterChange);
  monitoringMemberFilter.addEventListener("change", handleFilterChange);
  monitoringFilterReset.addEventListener("click", handleFilterReset);
  councilGroupControl.addEventListener("click", handleGroupModeClick);
  monitoringGroups.addEventListener("click", handleRecordClick);
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

async function fetchMonitoringRecords() {
  try {
    const response = await supabaseClient
      .from(TABLE_NAME)
      .select("*")
      .eq("is_published", true)
      .order("monitoring_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (response.error) {
      throw response.error;
    }

    monitoringRecords = normalizeRecords(response.data || []);
    populateFilterOptions(monitoringRecords);
    renderSummary(monitoringRecords);
    applyFilters();
    renderDataStatus(monitoringRecords.length);
    return true;
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("Council monitoring fetch failed:", error);
    }
    renderErrorState("모니터링 데이터 연결을 준비 중입니다.");
    return false;
  }
} // End of fetchMonitoringRecords

function isMissingTableError(error) {
  const code = error && error.code ? String(error.code) : "";
  const message = error && error.message ? String(error.message) : "";
  return code === "42P01" || code === "PGRST205" || message.includes("Could not find the table");
} // End of isMissingTableError

function subscribeToMonitoringUpdates() {
  supabaseClient
    .channel("council-monitoring-live")
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
} // End of subscribeToMonitoringUpdates

function handleRealtimeChange() {
  fetchMonitoringRecords();
} // End of handleRealtimeChange

function handleSubscriptionStatus(status, error) {
  if (error) {
    console.warn("Council monitoring realtime warning:", error);
  }

  if (status === "SUBSCRIBED") {
    renderDataStatus(monitoringRecords.length);
  }
} // End of handleSubscriptionStatus

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
    id: String(sourceRecord.id || `monitoring-${index + 1}`),
    created_at: String(sourceRecord.created_at || ""),
    updated_at: String(sourceRecord.updated_at || sourceRecord.created_at || ""),
    monitoring_date: normalizeDate(sourceRecord.monitoring_date),
    council_term: String(sourceRecord.council_term || "").trim(),
    session_name: String(sourceRecord.session_name || "").trim(),
    committee: String(sourceRecord.committee || "").trim(),
    meeting_type: String(sourceRecord.meeting_type || "").trim(),
    title: String(sourceRecord.title || "제목 없음").trim(),
    description: String(sourceRecord.description || "").trim(),
    members: normalizeStringArray(sourceRecord.members),
    keywords: normalizeStringArray(sourceRecord.keywords),
    search_text: String(sourceRecord.search_text || "").trim(),
    source_url: normalizeHttpUrl(sourceRecord.source_url),
    attachments: normalizeAttachments(sourceRecord.attachments),
    is_published: sourceRecord.is_published !== false
  };
} // End of normalizeRecord

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
    const item = String(sourceValues[index] || "").trim();
    if (item && !normalizedValues.includes(item)) {
      normalizedValues.push(item);
    }
  }

  return normalizedValues;
} // End of normalizeStringArray

function normalizeAttachments(value) {
  let sourceAttachments = value;
  const normalizedAttachments = [];

  if (typeof sourceAttachments === "string" && sourceAttachments.trim()) {
    try {
      sourceAttachments = JSON.parse(sourceAttachments);
    } catch (error) {
      sourceAttachments = [];
    }
  }

  if (!Array.isArray(sourceAttachments)) {
    return normalizedAttachments;
  }

  for (let index = 0; index < sourceAttachments.length; index += 1) {
    const sourceAttachment = sourceAttachments[index] || {};
    const url = normalizeHttpUrl(sourceAttachment.url);
    if (!url) {
      continue;
    }

    normalizedAttachments.push({
      id: String(sourceAttachment.id || `attachment-${index + 1}`),
      name: String(sourceAttachment.name || sourceAttachment.file_name || "자료 파일").trim(),
      url: url,
      path: String(sourceAttachment.path || "").trim(),
      mime_type: String(sourceAttachment.mime_type || sourceAttachment.type || "").trim(),
      size: Number(sourceAttachment.size || 0)
    });
  }

  return normalizedAttachments;
} // End of normalizeAttachments

function compareRecordsNewestFirst(firstRecord, secondRecord) {
  const dateComparison = String(secondRecord.monitoring_date || "").localeCompare(String(firstRecord.monitoring_date || ""));
  if (dateComparison !== 0) {
    return dateComparison;
  }

  return String(secondRecord.created_at || "").localeCompare(String(firstRecord.created_at || ""));
} // End of compareRecordsNewestFirst

function populateFilterOptions(records) {
  populateSelect(monitoringYearFilter, getUniqueValues(records, getRecordYear), "전체 시기", true);
  populateSelect(monitoringSessionFilter, getUniqueValues(records, getSessionName), "전체 회기", false);
  populateSelect(monitoringCommitteeFilter, getUniqueValues(records, getCommitteeName), "전체 위원회", false);
  populateSelect(monitoringMemberFilter, getUniqueArrayValues(records, "members"), "전체 의원", false);
} // End of populateFilterOptions

function populateSelect(selectElement, values, defaultLabel, descending) {
  const previousValue = selectElement.value;
  const sortedValues = [...values].sort(function sortValues(firstValue, secondValue) {
    return descending
      ? String(secondValue).localeCompare(String(firstValue), "ko-KR")
      : String(firstValue).localeCompare(String(secondValue), "ko-KR");
  });

  selectElement.innerHTML = "";
  selectElement.appendChild(createOption("", defaultLabel));

  for (let index = 0; index < sortedValues.length; index += 1) {
    selectElement.appendChild(createOption(sortedValues[index], sortedValues[index]));
  }

  selectElement.value = sortedValues.includes(previousValue) ? previousValue : "";
} // End of populateSelect

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
} // End of createOption

function getUniqueValues(records, valueGetter) {
  const values = [];

  for (let index = 0; index < records.length; index += 1) {
    const value = valueGetter(records[index]);
    if (value && !values.includes(value)) {
      values.push(value);
    }
  }

  return values;
} // End of getUniqueValues

function getUniqueArrayValues(records, propertyName) {
  const values = [];

  for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
    const sourceValues = Array.isArray(records[recordIndex][propertyName]) ? records[recordIndex][propertyName] : [];
    for (let valueIndex = 0; valueIndex < sourceValues.length; valueIndex += 1) {
      if (sourceValues[valueIndex] && !values.includes(sourceValues[valueIndex])) {
        values.push(sourceValues[valueIndex]);
      }
    }
  }

  return values;
} // End of getUniqueArrayValues

function getRecordYear(record) {
  return record.monitoring_date ? record.monitoring_date.slice(0, 4) : "";
} // End of getRecordYear

function getSessionName(record) {
  return record.session_name;
} // End of getSessionName

function getCommitteeName(record) {
  return record.committee;
} // End of getCommitteeName

function handleFilterChange() {
  applyFilters();
} // End of handleFilterChange

function handleFilterReset() {
  monitoringSearchInput.value = "";
  monitoringYearFilter.value = "";
  monitoringSessionFilter.value = "";
  monitoringCommitteeFilter.value = "";
  monitoringMemberFilter.value = "";
  applyFilters();
  monitoringSearchInput.focus();
} // End of handleFilterReset

function handleGroupModeClick(event) {
  const button = event.target.closest("button[data-group-mode]");
  if (!button) {
    return;
  }

  const nextMode = String(button.dataset.groupMode || "");
  if (!GROUP_MODES.includes(nextMode)) {
    return;
  }

  activeGroupMode = nextMode;
  const buttons = councilGroupControl.querySelectorAll("button[data-group-mode]");
  for (let index = 0; index < buttons.length; index += 1) {
    const isActive = buttons[index].dataset.groupMode === activeGroupMode;
    buttons[index].classList.toggle("is-active", isActive);
    buttons[index].setAttribute("aria-pressed", String(isActive));
  }

  renderGroups(filteredRecords);
} // End of handleGroupModeClick

function applyFilters() {
  const searchTokens = getSearchTokens(monitoringSearchInput.value);
  const selectedYear = monitoringYearFilter.value;
  const selectedSession = monitoringSessionFilter.value;
  const selectedCommittee = monitoringCommitteeFilter.value;
  const selectedMember = monitoringMemberFilter.value;
  const nextRecords = [];

  for (let index = 0; index < monitoringRecords.length; index += 1) {
    const record = monitoringRecords[index];

    if (selectedYear && getRecordYear(record) !== selectedYear) {
      continue;
    }

    if (selectedSession && record.session_name !== selectedSession) {
      continue;
    }

    if (selectedCommittee && record.committee !== selectedCommittee) {
      continue;
    }

    if (selectedMember && !record.members.includes(selectedMember)) {
      continue;
    }

    if (searchTokens.length && !matchesSearch(record, searchTokens)) {
      continue;
    }

    nextRecords.push(record);
  }

  filteredRecords = nextRecords;
  renderGroups(filteredRecords);
  renderResultText(filteredRecords.length, monitoringRecords.length);
} // End of applyFilters

function getSearchTokens(value) {
  return normalizeSearchText(value).split(" ").filter(Boolean);
} // End of getSearchTokens

function matchesSearch(record, searchTokens) {
  const haystack = getRecordSearchText(record);
  const compactHaystack = haystack.replace(/\s+/g, "");

  for (let index = 0; index < searchTokens.length; index += 1) {
    const token = searchTokens[index];
    if (!haystack.includes(token) && !compactHaystack.includes(token.replace(/\s+/g, ""))) {
      return false;
    }
  }

  return true;
} // End of matchesSearch

function getRecordSearchText(record) {
  const attachmentNames = record.attachments.map(function mapAttachment(attachment) {
    return attachment.name;
  }).join(" ");
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
    attachmentNames
  ].join(" "));
} // End of getRecordSearchText

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
} // End of normalizeSearchText

function renderSummary(records) {
  const sessionNames = getUniqueValues(records, getSessionName);
  const memberNames = getUniqueArrayValues(records, "members");
  monitoringRecordCount.textContent = String(records.length);
  monitoringSessionCount.textContent = String(sessionNames.length);
  monitoringMemberCount.textContent = String(memberNames.length);
} // End of renderSummary

function renderGroups(records) {
  monitoringGroups.innerHTML = "";

  if (!records.length) {
    renderEmptyState();
    return;
  }

  const groups = buildGroups(records, activeGroupMode);
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < groups.length; index += 1) {
    fragment.appendChild(createGroupSection(groups[index]));
  }

  monitoringGroups.appendChild(fragment);
  renderIcons();
} // End of renderGroups

function buildGroups(records, mode) {
  if (mode === "all") {
    return [{ key: "all", label: "전체 기록", records: [...records] }];
  }

  const groupMap = new Map();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const labels = getGroupLabels(record, mode);

    for (let labelIndex = 0; labelIndex < labels.length; labelIndex += 1) {
      const label = labels[labelIndex];
      if (!groupMap.has(label)) {
        groupMap.set(label, []);
      }
      groupMap.get(label).push(record);
    }
  }

  const groups = [];
  groupMap.forEach(function appendGroup(groupRecords, label) {
    groups.push({
      key: normalizeSearchText(label).replace(/\s+/g, "-"),
      label: label,
      records: groupRecords.sort(compareRecordsNewestFirst)
    });
  });

  return groups.sort(function compareGroups(firstGroup, secondGroup) {
    if (mode === "member") {
      return firstGroup.label.localeCompare(secondGroup.label, "ko-KR");
    }

    const firstDate = firstGroup.records[0] ? firstGroup.records[0].monitoring_date : "";
    const secondDate = secondGroup.records[0] ? secondGroup.records[0].monitoring_date : "";
    return String(secondDate).localeCompare(String(firstDate));
  });
} // End of buildGroups

function getGroupLabels(record, mode) {
  if (mode === "period") {
    return [formatPeriod(record.monitoring_date)];
  }

  if (mode === "session") {
    return [record.session_name || "회기 미분류"];
  }

  if (mode === "member") {
    return record.members.length ? record.members : ["의원 미분류"];
  }

  return ["전체 기록"];
} // End of getGroupLabels

function createGroupSection(group) {
  const section = document.createElement("section");
  section.className = "council-group";
  section.dataset.groupKey = group.key;

  const heading = document.createElement("div");
  heading.className = "council-group-heading";
  heading.innerHTML = `<h2>${escapeHtml(group.label)}</h2><span>${escapeHtml(String(group.records.length))}건</span>`;

  const grid = document.createElement("div");
  grid.className = "council-record-grid";
  for (let index = 0; index < group.records.length; index += 1) {
    grid.appendChild(createRecordCard(group.records[index], `${group.key}-${index}`));
  }

  section.appendChild(heading);
  section.appendChild(grid);
  return section;
} // End of createGroupSection

function createRecordCard(record, instanceId) {
  const article = document.createElement("article");
  const detailId = `monitoring-detail-${escapeCssValue(record.id)}-${escapeCssValue(instanceId)}`;
  article.className = "council-record";
  article.dataset.recordId = record.id;
  article.innerHTML = `
    <div class="council-record-main">
      <div class="council-record-topline">
        <time class="council-record-date" datetime="${escapeHtml(record.monitoring_date)}">${escapeHtml(formatDate(record.monitoring_date))}</time>
        <span class="council-record-type">${escapeHtml(record.meeting_type || "의정활동")}</span>
      </div>
      <h3>${escapeHtml(record.title)}</h3>
      <p class="council-record-description">${escapeHtml(record.description || "상세 기록을 준비 중입니다.")}</p>
      <div class="council-record-meta">
        ${record.council_term ? `<span>${escapeHtml(record.council_term)}</span>` : ""}
        ${record.session_name ? `<span>${escapeHtml(record.session_name)}</span>` : ""}
        ${record.committee ? `<span>${escapeHtml(record.committee)}</span>` : ""}
      </div>
    </div>
    <div class="council-record-actions">
      <span>의원 ${escapeHtml(String(record.members.length))}명 · 자료 ${escapeHtml(String(record.attachments.length))}개</span>
      <button class="council-detail-toggle" type="button" aria-expanded="false" aria-controls="${detailId}">
        <span>상세 보기</span>
        <i data-lucide="chevron-down" aria-hidden="true"></i>
      </button>
    </div>
    <div id="${detailId}" class="council-record-detail">
      ${buildDescriptionHtml(record)}
      ${buildMembersHtml(record.members)}
      ${buildDocumentsHtml(record.attachments)}
      ${buildKeywordsHtml(record.keywords)}
      ${buildSourceHtml(record.source_url)}
    </div>
  `;
  return article;
} // End of createRecordCard

function buildDescriptionHtml(record) {
  if (!record.description) {
    return "";
  }

  return `
    <section class="council-detail-section">
      <h4>모니터링 기록</h4>
      <p>${escapeHtml(record.description)}</p>
    </section>
  `;
} // End of buildDescriptionHtml

function buildMembersHtml(members) {
  if (!members.length) {
    return "";
  }

  let items = "";
  for (let index = 0; index < members.length; index += 1) {
    items += `<li class="council-member-chip">${escapeHtml(members[index])}</li>`;
  }

  return `
    <section class="council-detail-section">
      <h4>관련 의원</h4>
      <ul class="council-chip-list">${items}</ul>
    </section>
  `;
} // End of buildMembersHtml

function buildDocumentsHtml(attachments) {
  if (!attachments.length) {
    return "";
  }

  let items = "";
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    items += `
      <li>
        <a class="council-document-link" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener noreferrer">
          <i data-lucide="${escapeHtml(getAttachmentIcon(attachment))}" aria-hidden="true"></i>
          <span class="council-document-name">${escapeHtml(attachment.name)}</span>
        </a>
      </li>
    `;
  }

  return `
    <section class="council-detail-section">
      <h4>공개 자료</h4>
      <ul class="council-document-list">${items}</ul>
    </section>
  `;
} // End of buildDocumentsHtml

function buildKeywordsHtml(keywords) {
  if (!keywords.length) {
    return "";
  }

  let items = "";
  for (let index = 0; index < keywords.length; index += 1) {
    items += `<li class="council-keyword">#${escapeHtml(keywords[index])}</li>`;
  }

  return `
    <section class="council-detail-section">
      <h4>키워드</h4>
      <ul class="council-chip-list">${items}</ul>
    </section>
  `;
} // End of buildKeywordsHtml

function buildSourceHtml(sourceUrl) {
  if (!sourceUrl) {
    return "";
  }

  return `
    <section class="council-detail-section">
      <h4>원문 출처</h4>
      <a class="council-source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">
        <i data-lucide="external-link" aria-hidden="true"></i>
        <span>출처 페이지 열기</span>
      </a>
    </section>
  `;
} // End of buildSourceHtml

function getAttachmentIcon(attachment) {
  const type = String(attachment.mime_type || "").toLowerCase();
  const name = String(attachment.name || "").toLowerCase();

  if (type.includes("pdf") || name.endsWith(".pdf")) {
    return "file-text";
  }

  if (type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/.test(name)) {
    return "image";
  }

  if (/\.(xls|xlsx|csv)$/.test(name)) {
    return "sheet";
  }

  return "paperclip";
} // End of getAttachmentIcon

function handleRecordClick(event) {
  const button = event.target.closest(".council-detail-toggle");
  if (!button) {
    return;
  }

  const record = button.closest(".council-record");
  if (!record) {
    return;
  }

  const isExpanded = record.classList.toggle("is-expanded");
  button.setAttribute("aria-expanded", String(isExpanded));
  button.innerHTML = isExpanded
    ? '<span>상세 닫기</span><i data-lucide="chevron-up" aria-hidden="true"></i>'
    : '<span>상세 보기</span><i data-lucide="chevron-down" aria-hidden="true"></i>';
  renderIcons();
} // End of handleRecordClick

function renderLoadingState() {
  monitoringDataStatus.innerHTML = "<strong>로딩 중</strong><br>모니터링 기록을 불러오고 있습니다.";
} // End of renderLoadingState

function renderErrorState(message) {
  monitoringDataStatus.innerHTML = `<strong>준비 중</strong><br>${escapeHtml(message)}`;
  monitoringGroups.innerHTML = `<div class="council-error"><p>${escapeHtml(message)}</p></div>`;
  monitoringResultText.textContent = "";
} // End of renderErrorState

function renderEmptyState() {
  const hasFilter = Boolean(
    monitoringSearchInput.value.trim()
    || monitoringYearFilter.value
    || monitoringSessionFilter.value
    || monitoringCommitteeFilter.value
    || monitoringMemberFilter.value
  );
  const message = hasFilter ? "검색 조건에 맞는 기록이 없습니다." : "아직 등록된 모니터링 기록이 없습니다.";
  monitoringGroups.innerHTML = `<div class="council-empty"><p>${escapeHtml(message)}</p></div>`;
} // End of renderEmptyState

function renderDataStatus(count) {
  monitoringDataStatus.innerHTML = `<strong>현재 ${escapeHtml(String(count))}개의 기록이 있습니다.</strong>`;
} // End of renderDataStatus

function renderResultText(resultCount, totalCount) {
  if (!totalCount) {
    monitoringResultText.textContent = "등록된 기록이 없습니다.";
    return;
  }

  monitoringResultText.textContent = `전체 ${totalCount}개 중 ${resultCount}개를 표시합니다.`;
} // End of renderResultText

function formatDate(value) {
  const normalizedDate = normalizeDate(value);
  if (!normalizedDate) {
    return "날짜 미정";
  }

  const parts = normalizedDate.split("-");
  return `${Number(parts[0])}년 ${Number(parts[1])}월 ${Number(parts[2])}일`;
} // End of formatDate

function formatPeriod(value) {
  const normalizedDate = normalizeDate(value);
  if (!normalizedDate) {
    return "시기 미분류";
  }

  const parts = normalizedDate.split("-");
  return `${Number(parts[0])}년 ${Number(parts[1])}월`;
} // End of formatPeriod

function normalizeDate(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
} // End of normalizeDate

function normalizeHttpUrl(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  try {
    const url = new URL(rawValue);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch (error) {
    return "";
  }
} // End of normalizeHttpUrl

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, function replaceCharacter(character) {
    return HTML_ESCAPE_MAP[character];
  });
} // End of escapeHtml

function escapeCssValue(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(String(value || ""));
  }

  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "-");
} // End of escapeCssValue
