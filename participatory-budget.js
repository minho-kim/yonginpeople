import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/+esm";
import { TIMELINE_SUPABASE_CONFIG } from "./config.js";

const TABLE_NAME = "participatory_budget_projects";
const PUBLIC_COLUMNS = [
  "id",
  "created_at",
  "updated_at",
  "fiscal_year",
  "proposal_date",
  "project_name",
  "district",
  "category",
  "description",
  "public_note",
  "source_url",
  "is_published"
].join(",");
const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
};

let supabaseClient = null;
let budgetProjects = [];
let filteredProjects = [];
let budgetDataStatus = null;
let budgetProjectCount = null;
let budgetYearCount = null;
let budgetDistrictCount = null;
let budgetSearchInput = null;
let budgetYearFilter = null;
let budgetDistrictFilter = null;
let budgetCategoryFilter = null;
let budgetFilterReset = null;
let budgetResultText = null;
let budgetGrid = null;

document.addEventListener("DOMContentLoaded", initializeParticipatoryBudget);

async function initializeParticipatoryBudget() {
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
  const didLoadProjects = await fetchBudgetProjects();
  if (didLoadProjects) {
    subscribeToBudgetUpdates();
  }
} // End of initializeParticipatoryBudget

function cacheElements() {
  budgetDataStatus = document.getElementById("budgetDataStatus");
  budgetProjectCount = document.getElementById("budgetProjectCount");
  budgetYearCount = document.getElementById("budgetYearCount");
  budgetDistrictCount = document.getElementById("budgetDistrictCount");
  budgetSearchInput = document.getElementById("budgetSearchInput");
  budgetYearFilter = document.getElementById("budgetYearFilter");
  budgetDistrictFilter = document.getElementById("budgetDistrictFilter");
  budgetCategoryFilter = document.getElementById("budgetCategoryFilter");
  budgetFilterReset = document.getElementById("budgetFilterReset");
  budgetResultText = document.getElementById("budgetResultText");
  budgetGrid = document.getElementById("budgetGrid");
} // End of cacheElements

function bindEvents() {
  budgetSearchInput.addEventListener("input", applyFilters);
  budgetYearFilter.addEventListener("change", applyFilters);
  budgetDistrictFilter.addEventListener("change", applyFilters);
  budgetCategoryFilter.addEventListener("change", applyFilters);
  budgetFilterReset.addEventListener("click", handleFilterReset);
  budgetGrid.addEventListener("click", handleCardClick);
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

async function fetchBudgetProjects() {
  try {
    const response = await supabaseClient
      .from(TABLE_NAME)
      .select(PUBLIC_COLUMNS)
      .eq("is_published", true)
      .order("fiscal_year", { ascending: false })
      .order("proposal_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (response.error) {
      throw response.error;
    }

    budgetProjects = normalizeProjects(response.data || []);
    populateFilters(budgetProjects);
    renderSummary(budgetProjects);
    applyFilters();
    renderDataStatus(budgetProjects.length);
    return true;
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("Participatory budget fetch failed:", error);
    }
    renderErrorState("주민참여예산 데이터 연결을 준비 중입니다.");
    return false;
  }
} // End of fetchBudgetProjects

function isMissingTableError(error) {
  const code = error && error.code ? String(error.code) : "";
  const message = error && error.message ? String(error.message) : "";
  return code === "42P01" || code === "PGRST205" || message.includes("Could not find the table");
} // End of isMissingTableError

function subscribeToBudgetUpdates() {
  supabaseClient
    .channel("participatory-budget-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE_NAME },
      handleRealtimeChange
    )
    .subscribe(handleSubscriptionStatus);
} // End of subscribeToBudgetUpdates

function handleRealtimeChange() {
  fetchBudgetProjects();
} // End of handleRealtimeChange

function handleSubscriptionStatus(status, error) {
  if (error) {
    console.warn("Participatory budget realtime warning:", error);
  }

  if (status === "SUBSCRIBED") {
    renderDataStatus(budgetProjects.length);
  }
} // End of handleSubscriptionStatus

function normalizeProjects(rawProjects) {
  const normalizedProjects = [];

  for (let index = 0; index < rawProjects.length; index += 1) {
    normalizedProjects.push(normalizeProject(rawProjects[index], index));
  }

  return normalizedProjects.sort(compareProjectsNewestFirst);
} // End of normalizeProjects

function normalizeProject(rawProject, index) {
  const sourceProject = rawProject || {};
  return {
    id: String(sourceProject.id || `budget-${index + 1}`),
    created_at: String(sourceProject.created_at || ""),
    updated_at: String(sourceProject.updated_at || sourceProject.created_at || ""),
    fiscal_year: normalizeFiscalYear(sourceProject.fiscal_year),
    proposal_date: normalizeDate(sourceProject.proposal_date),
    project_name: String(sourceProject.project_name || "제목 없음").trim(),
    district: String(sourceProject.district || "").trim(),
    category: String(sourceProject.category || "").trim(),
    description: String(sourceProject.description || "").trim(),
    public_note: String(sourceProject.public_note || "").trim(),
    source_url: normalizeHttpUrl(sourceProject.source_url),
    is_published: sourceProject.is_published !== false
  };
} // End of normalizeProject

function compareProjectsNewestFirst(firstProject, secondProject) {
  if (secondProject.fiscal_year !== firstProject.fiscal_year) {
    return secondProject.fiscal_year - firstProject.fiscal_year;
  }

  const dateComparison = String(secondProject.proposal_date || "").localeCompare(String(firstProject.proposal_date || ""));
  if (dateComparison !== 0) {
    return dateComparison;
  }

  return String(secondProject.created_at || "").localeCompare(String(firstProject.created_at || ""));
} // End of compareProjectsNewestFirst

function populateFilters(projects) {
  populateSelect(budgetYearFilter, getUniqueValues(projects, getFiscalYearLabel), "전체 연도", true);
  populateSelect(budgetDistrictFilter, getUniqueValues(projects, getDistrict), "전체 지역", false);
  populateSelect(budgetCategoryFilter, getUniqueValues(projects, getCategory), "전체 분야", false);
} // End of populateFilters

function populateSelect(selectElement, values, defaultLabel, descending, labelFormatter) {
  const previousValue = selectElement.value;
  const sortedValues = [...values].sort(function sortValues(firstValue, secondValue) {
    return descending
      ? String(secondValue).localeCompare(String(firstValue), "ko-KR")
      : String(firstValue).localeCompare(String(secondValue), "ko-KR");
  });

  selectElement.innerHTML = "";
  selectElement.appendChild(createOption("", defaultLabel));

  for (let index = 0; index < sortedValues.length; index += 1) {
    const label = typeof labelFormatter === "function" ? labelFormatter(sortedValues[index]) : sortedValues[index];
    selectElement.appendChild(createOption(sortedValues[index], label));
  }

  selectElement.value = sortedValues.includes(previousValue) ? previousValue : "";
} // End of populateSelect

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
} // End of createOption

function getUniqueValues(projects, valueGetter) {
  const values = [];

  for (let index = 0; index < projects.length; index += 1) {
    const value = valueGetter(projects[index]);
    if (value && !values.includes(value)) {
      values.push(value);
    }
  }

  return values;
} // End of getUniqueValues

function getFiscalYearLabel(project) {
  return project.fiscal_year ? String(project.fiscal_year) : "";
} // End of getFiscalYearLabel

function getDistrict(project) {
  return project.district;
} // End of getDistrict

function getCategory(project) {
  return project.category;
} // End of getCategory

function handleFilterReset() {
  budgetSearchInput.value = "";
  budgetYearFilter.value = "";
  budgetDistrictFilter.value = "";
  budgetCategoryFilter.value = "";
  applyFilters();
  budgetSearchInput.focus();
} // End of handleFilterReset

function applyFilters() {
  const searchTokens = getSearchTokens(budgetSearchInput.value);
  const selectedYear = budgetYearFilter.value;
  const selectedDistrict = budgetDistrictFilter.value;
  const selectedCategory = budgetCategoryFilter.value;
  const nextProjects = [];

  for (let index = 0; index < budgetProjects.length; index += 1) {
    const project = budgetProjects[index];

    if (selectedYear && String(project.fiscal_year) !== selectedYear) {
      continue;
    }

    if (selectedDistrict && project.district !== selectedDistrict) {
      continue;
    }

    if (selectedCategory && project.category !== selectedCategory) {
      continue;
    }

    if (searchTokens.length && !matchesSearch(project, searchTokens)) {
      continue;
    }

    nextProjects.push(project);
  }

  filteredProjects = nextProjects;
  renderProjects(filteredProjects);
  renderResultText(filteredProjects.length, budgetProjects.length);
} // End of applyFilters

function getSearchTokens(value) {
  return normalizeSearchText(value).split(" ").filter(Boolean);
} // End of getSearchTokens

function matchesSearch(project, searchTokens) {
  const haystack = getProjectSearchText(project);
  const compactHaystack = haystack.replace(/\s+/g, "");

  for (let index = 0; index < searchTokens.length; index += 1) {
    const token = searchTokens[index];
    if (!haystack.includes(token) && !compactHaystack.includes(token.replace(/\s+/g, ""))) {
      return false;
    }
  }

  return true;
} // End of matchesSearch

function getProjectSearchText(project) {
  return normalizeSearchText([
    project.fiscal_year,
    project.proposal_date,
    project.project_name,
    project.district,
    project.category,
    project.description,
    project.public_note
  ].join(" "));
} // End of getProjectSearchText

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
} // End of normalizeSearchText

function renderSummary(projects) {
  const years = getUniqueValues(projects, getFiscalYearLabel);
  const districts = getUniqueValues(projects, getDistrict);
  budgetProjectCount.textContent = String(projects.length);
  budgetYearCount.textContent = String(years.length);
  budgetDistrictCount.textContent = String(districts.length);
} // End of renderSummary

function renderProjects(projects) {
  budgetGrid.innerHTML = "";

  if (!projects.length) {
    renderEmptyState();
    return;
  }

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < projects.length; index += 1) {
    fragment.appendChild(createProjectCard(projects[index], index));
  }

  budgetGrid.appendChild(fragment);
  renderIcons();
} // End of renderProjects

function createProjectCard(project, index) {
  const article = document.createElement("article");
  const detailId = `budget-detail-${escapeCssValue(project.id)}-${index}`;
  article.className = "budget-card";
  article.dataset.projectId = project.id;
  article.innerHTML = `
    <div class="budget-card-main">
      <div class="budget-card-topline">
        <span class="budget-year">${escapeHtml(String(project.fiscal_year))}년 제안</span>
        ${project.proposal_date ? `<time class="budget-year" datetime="${escapeHtml(project.proposal_date)}">${escapeHtml(formatDate(project.proposal_date))}</time>` : ""}
      </div>
      <h2>${escapeHtml(project.project_name)}</h2>
      <p class="budget-card-description">${escapeHtml(project.description || "사업 내용을 준비 중입니다.")}</p>
      <div class="budget-card-meta">
        ${project.district ? `<span>${escapeHtml(project.district)}</span>` : ""}
        ${project.category ? `<span>${escapeHtml(project.category)}</span>` : ""}
      </div>
    </div>
    <div class="budget-card-actions">
      <button class="budget-detail-toggle" type="button" aria-expanded="false" aria-controls="${detailId}">
        <span>상세 보기</span>
        <i data-lucide="chevron-down" aria-hidden="true"></i>
      </button>
    </div>
    <div id="${detailId}" class="budget-card-detail">
      ${buildDetailHtml(project)}
    </div>
  `;
  return article;
} // End of createProjectCard

function buildDetailHtml(project) {
  let html = "";

  if (project.proposal_date) {
    html += `<section class="budget-detail-section"><h3>제안일</h3><p>${escapeHtml(formatDate(project.proposal_date))}</p></section>`;
  }

  if (project.description) {
    html += `<section class="budget-detail-section"><h3>사업 내용</h3><p>${escapeHtml(project.description)}</p></section>`;
  }

  if (project.public_note) {
    html += `<section class="budget-detail-section"><h3>진행 기록</h3><p>${escapeHtml(project.public_note)}</p></section>`;
  }

  if (project.source_url) {
    html += `
      <section class="budget-detail-section">
        <h3>관련 자료</h3>
        <a class="budget-source-link" href="${escapeHtml(project.source_url)}" target="_blank" rel="noopener noreferrer">
          <i data-lucide="external-link" aria-hidden="true"></i>
          <span>출처 페이지 열기</span>
        </a>
      </section>
    `;
  }

  return html || '<p class="mb-0">추가 상세 내용을 준비 중입니다.</p>';
} // End of buildDetailHtml

function handleCardClick(event) {
  const button = event.target.closest(".budget-detail-toggle");

  if (!button) {
    return;
  }

  const card = button.closest(".budget-card");
  if (!card) {
    return;
  }

  const isExpanded = card.classList.toggle("is-expanded");
  button.setAttribute("aria-expanded", String(isExpanded));
  button.innerHTML = isExpanded
    ? '<span>상세 닫기</span><i data-lucide="chevron-up" aria-hidden="true"></i>'
    : '<span>상세 보기</span><i data-lucide="chevron-down" aria-hidden="true"></i>';
  renderIcons();
} // End of handleCardClick

function normalizeFiscalYear(value) {
  const numericValue = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(numericValue) && numericValue >= 2000 && numericValue <= 2200
    ? numericValue
    : new Date().getFullYear();
} // End of normalizeFiscalYear

function formatDate(value) {
  const normalizedDate = normalizeDate(value);

  if (!normalizedDate) {
    return "날짜 미정";
  }

  const parts = normalizedDate.split("-");
  return `${Number(parts[0])}년 ${Number(parts[1])}월 ${Number(parts[2])}일`;
} // End of formatDate

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

function renderLoadingState() {
  budgetDataStatus.innerHTML = "<strong>로딩 중</strong><br>주민참여예산 기록을 불러오고 있습니다.";
} // End of renderLoadingState

function renderDataStatus(count) {
  budgetDataStatus.innerHTML = `<strong>현재 ${escapeHtml(String(count))}개의 제안이 있습니다.</strong>`;
} // End of renderDataStatus

function renderResultText(resultCount, totalCount) {
  if (!totalCount) {
    budgetResultText.textContent = "등록된 제안이 없습니다.";
    return;
  }

  budgetResultText.textContent = `전체 ${totalCount}개 중 ${resultCount}개를 표시합니다.`;
} // End of renderResultText

function renderEmptyState() {
  const hasFilter = Boolean(
    budgetSearchInput.value.trim()
    || budgetYearFilter.value
    || budgetDistrictFilter.value
    || budgetCategoryFilter.value
  );
  const message = hasFilter ? "검색 조건에 맞는 제안이 없습니다." : "아직 등록된 주민참여예산 제안이 없습니다.";
  budgetGrid.innerHTML = `<div class="budget-empty"><p>${escapeHtml(message)}</p></div>`;
} // End of renderEmptyState

function renderErrorState(message) {
  budgetDataStatus.innerHTML = `<strong>준비 중</strong><br>${escapeHtml(message)}`;
  budgetGrid.innerHTML = `<div class="budget-error"><p>${escapeHtml(message)}</p></div>`;
  budgetResultText.textContent = "";
} // End of renderErrorState

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
