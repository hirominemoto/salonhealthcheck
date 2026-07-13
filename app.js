const report = (() => {
  try {
    const stored = sessionStorage.getItem("salonReport");
    return stored ? JSON.parse(stored) : window.salonReport;
  } catch { return window.salonReport; }
})();
const deck = document.querySelector("#deck");

const stars = (score) => "★★★★★☆☆☆☆☆".slice(5 - score, 10 - score);
const statusClass = (passed) => (passed ? "ok" : "needs");
const statusMark = (passed) => (passed ? "○" : "×");

function card(inner, modifier = "") {
  return `<section class="slide ${modifier}">${inner}</section>`;
}

function metric(label, value, hint = "") {
  return `
    <div class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
      ${hint ? `<small>${hint}</small>` : ""}
    </div>
  `;
}

function priorityBlock(item, index) {
  return `
    <article class="priority-card">
      <div class="rank">0${index + 1}</div>
      <div>
        <h3>${item.title}</h3>
        ${item.issue ? `<div class="priority-detail"><span class="priority-label">現状の課題</span><p>${item.issue}</p></div>` : ""}
        ${item.reason ? `<div class="priority-detail"><span class="priority-label">優先する理由</span><p>${item.reason}</p></div>` : ""}
        <div class="priority-detail"><span class="priority-label">改善提案</span><p>${item.suggestion}</p></div>
        ${item.expected_outcome ? `<div class="priority-detail"><span class="priority-label">期待できる効果</span><p>${item.expected_outcome}</p></div>` : ""}
        <div class="tags">
          <span>作業量 ${item.workload}</span>
          <span>期待効果 ${item.impact}</span>
          <span>${item.time}</span>
        </div>
      </div>
    </article>
  `;
}

function checkRow(item) {
  const body = item.passed ? item.positive : item.suggestion;
  return `
    <li class="${statusClass(item.passed)}">
      <span class="check-mark">${statusMark(item.passed)}</span>
      <div>
        <strong>${item.label}</strong>
        <p>${body}</p>
      </div>
    </li>
  `;
}

function competitorRow(item) {
  return `
    <li class="competitor-row">
      <span class="competitor-name">${item.name}</span>
      <span class="competitor-stats">
        <strong>★${item.rating ?? "-"}</strong>
        <small>口コミ${item.reviews ?? "-"}件</small>
      </span>
    </li>
  `;
}

// ○を先、×を後に並べ替え
const sortedChecks = [
  ...report.homepageChecks.filter(i => i.passed),
  ...report.homepageChecks.filter(i => !i.passed),
];

const failedCount = report.homepageChecks.filter((item) => !item.passed).length;
const passedCount = report.homepageChecks.length - failedCount;
const superiorStores = report.superiorStores || [];
const nearbyCompetitors = report.nearbyCompetitors || [];
const total = report.homepageChecks.length;

// ドーナツグラフSVG生成
function donutChart(passed, failed) {
  const r = 80;
  const cx = 100;
  const cy = 100;
  const circumference = 2 * Math.PI * r;
  const passedRatio = passed / (passed + failed);
  const passedDash = circumference * passedRatio;
  const failedDash = circumference * (1 - passedRatio);

  return `
    <svg class="donut-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f0f0ee" stroke-width="22"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="#e4685d"
        stroke-width="22"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="0"
        transform="rotate(-90 ${cx} ${cy})"
        stroke-linecap="round"
      />
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="#0f8b8d"
        stroke-width="22"
        stroke-dasharray="${passedDash} ${circumference - passedDash}"
        stroke-dashoffset="0"
        transform="rotate(-90 ${cx} ${cy})"
        stroke-linecap="round"
      />
      <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="36" font-weight="900" fill="#1f2933" font-family="Noto Sans JP, sans-serif">${passed}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="13" font-weight="700" fill="#687482" font-family="Noto Sans JP, sans-serif">/ ${passed + failed}項目</text>
      <text x="${cx}" y="${cy + 34}" text-anchor="middle" font-size="12" font-weight="500" fill="#687482" font-family="Noto Sans JP, sans-serif">達成</text>
    </svg>
  `;
}

deck.innerHTML = [
  card(
    `
      <div class="hero-copy">
        <p class="eyebrow">${report.brand}</p>
        <h2>${report.storeShortName}</h2>
        <p class="lead">集客導線・信頼材料・問い合わせ導線を、短時間で改善できる順に整理しました。</p>
        <div class="hero-meta">
          <span>${report.area}</span>
          <span>${report.diagnosisDate}</span>
        </div>
      </div>
      <div class="hero-panel">
        ${metric("Google評価", report.map.rating, `平均 ${report.map.areaRating}`)}
        ${metric("口コミ数", `${report.map.reviews}件`, `平均 ${report.map.areaReviews}件`)}
        ${metric("優先改善", `${report.priorities.length}件`, "まずここから")}
      </div>
    `,
    "cover"
  ),
  card(`
    <div class="slide-head">
      <p class="eyebrow">Priority</p>
      <h2>まずここから改善</h2>
      <p>${report.summary}</p>
    </div>
    <div class="priority-grid">
      ${report.priorities.map(priorityBlock).join("")}
    </div>
  `),
  card(`
    <div class="split">
      <div>
        <p class="eyebrow">Google Map</p>
        <h2>口コミの安心感をもう一段上げる</h2>
        <p class="lead">口コミ数はエリア平均より少ない状況です。まずは${report.map.nextReviewGoal}件を目標に増やすことで、新規のお客様の安心感につながります。</p>
      </div>
      <div class="scoreboard">
        ${metric("店舗評価", report.map.rating, `エリア平均 ${report.map.areaRating}`)}
        ${metric("口コミ数", `${report.map.reviews}件`, `エリア平均 ${report.map.areaReviews}件`)}
        ${metric("次の目標", `${report.map.nextReviewGoal}件`, "到達しやすい第一目標")}
      </div>
    </div>
  `),
  card(`
    <div class="slide-head">
      <p class="eyebrow">Competitive Landscape</p>
      <h2>エリアの競合状況</h2>
      <p>評価×口コミ数で見た周辺の強豪店と、半径1km圏内の同業種をまとめました。</p>
    </div>
    <div class="competitor-layout">
      <div class="superior-block">
        <p class="block-label">このエリアで優れている店舗</p>
        ${
          superiorStores.length
            ? `<ul class="check-list">${superiorStores.map((s) => `
                <li class="needs">
                  <span class="check-mark">★</span>
                  <div>
                    <strong>${s.name}</strong>
                    <p>評価${s.rating ?? "-"} / 口コミ${s.reviews ?? "-"}件</p>
                  </div>
                </li>
              `).join("")}</ul>
               <p class="hook-text">→ ここを超えていきましょう！</p>`
            : `<p class="hook-text">このエリアでは既に優位な状態です。</p>`
        }
      </div>
      <div class="nearby-block">
        <p class="block-label">近隣競合リスト（半径1km・同業種）</p>
        <ul class="competitor-list">
          ${nearbyCompetitors.map(competitorRow).join("")}
        </ul>
      </div>
    </div>
  `),
  card(`
    <div class="slide-head compact">
      <p class="eyebrow">Homepage</p>
      <h2>ホームページ診断</h2>
      <p>できている項目は活かし、足りない導線を追加して予約前の迷いを減らします。</p>
    </div>
    <div class="homepage-diag">
      <div class="donut-wrap">
        ${donutChart(passedCount, failedCount)}
        <div class="donut-legend">
          <div class="donut-legend-item">
            <span class="donut-legend-dot ok"></span>
            <span>できている</span>
            <span class="donut-legend-count" style="color:#0f8b8d">${passedCount}項目</span>
          </div>
          <div class="donut-legend-item">
            <span class="donut-legend-dot needs"></span>
            <span>改善余地</span>
            <span class="donut-legend-count" style="color:#e4685d">${failedCount}項目</span>
          </div>
        </div>
      </div>
      <ul class="check-list">
        ${sortedChecks.map(checkRow).join("")}
      </ul>
    </div>
  `),
  card(`
    <div class="slide-head">
      <p class="eyebrow">Today Action</p>
      <h2>今日のおすすめ</h2>
      <p>作業時間が短く、予約率への影響が出やすい順に並べています。</p>
    </div>
    <div class="action-list">
      ${report.priorities
        .map(
          (item, index) => `
            <article>
              <span class="rank small">0${index + 1}</span>
              <div>
                <h3>${item.title}</h3>
                <p>${item.time} / 期待効果：${item.impact}</p>
              </div>
              <strong>${stars(item.score)}</strong>
            </article>
          `
        )
        .join("")}
    </div>
  `),
  card(
    `
      <div class="closing">
        <p class="eyebrow">Next Step</p>
        <h2>${report.offer.title}</h2>
        <p class="lead">${report.closing}</p>
        <ul>
          ${report.offer.items.map((item) => `<li>${item}</li>`).join("")}
        </ul>
        <div class="cta">${report.offer.cta}</div>
      </div>
    `,
    "final"
  ),
].join("");

document.querySelector("#printButton").addEventListener("click", async () => {
  const btn = document.querySelector("#printButton");
  btn.innerHTML = "<span>⏳</span> 生成中...";
  btn.disabled = true;

  // スクロール制限を一時的に解除
  const scrollEls = document.querySelectorAll(".check-list, .competitor-list");
  const originalStyles = Array.from(scrollEls).map(el => ({
    maxHeight: el.style.maxHeight,
    overflow: el.style.overflow,
  }));
  scrollEls.forEach(el => {
    el.style.maxHeight = "none";
    el.style.overflow = "visible";
  });

  try {
    const { jsPDF } = window.jspdf;
    const slides = document.querySelectorAll(".slide");
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1280, 720] });

    for (let i = 0; i < slides.length; i++) {
      const canvas = await html2canvas(slides[i], {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#fbfbf8",
        width: slides[i].offsetWidth,
        height: slides[i].offsetHeight,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage([1280, 720], "landscape");
      pdf.addImage(imgData, "JPEG", 0, 0, 1280, 720);
    }

    pdf.save(`${report.storeShortName}_診断レポート.pdf`);
  } catch (e) {
    alert("PDF生成に失敗しました。もう一度お試しください。");
    console.error(e);
  } finally {
    // スクロール制限を元に戻す
    scrollEls.forEach((el, i) => {
      el.style.maxHeight = originalStyles[i].maxHeight;
      el.style.overflow = originalStyles[i].overflow;
    });
    btn.innerHTML = "<span aria-hidden='true'>↓</span> PDF保存";
    btn.disabled = false;
  }
});
