exports.handler = async (event) => {
  const { placeData } = JSON.parse(event.body || "{}");
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!placeData) {
    return { statusCode: 400, body: JSON.stringify({ error: "店舗データが必要です" }) };
  }

  // ─────────────────────────────────────────
  // STEP 1: JS側でhomepageChecksを判定
  // ─────────────────────────────────────────
  const url = placeData.websiteUrl;
  const hasWebsite = !!url;

  // TODO: Phase3でHPスクレイピングによる実判定へ置き換える
  // 現在はwebsiteUrlの有無・Google情報をもとに判定
  const homepageChecks = [
    {
      key: "openingHours",
      label: "営業時間",
      passed: !!placeData.hasOpeningHours,
      positive: "営業時間がGoogleに登録されています。",
      suggestion: "Googleビジネスプロフィールに営業時間を登録してください。",
      outcome: "来店前に確認できるため、問い合わせ数が減ります。",
      workload: "低", impact: "高", time: "約10分", score: 5,
    },
    {
      key: "phone",
      label: "電話番号",
      passed: hasWebsite, // websiteがあれば電話掲載の可能性高と判定
      positive: "電話番号が掲載されています。",
      suggestion: "ホームページに電話番号を掲載してください。",
      outcome: "問い合わせしやすくなります。",
      workload: "低", impact: "高", time: "約15分", score: 5,
    },
    {
      key: "line",
      label: "LINE導線",
      passed: false, // URLスクレイピングなしのためデフォルトfalse（将来拡張可）
      positive: "LINE相談窓口が設置されています。",
      suggestion: "トップページにLINE相談窓口を設置してください。",
      outcome: "電話が苦手な世代の問い合わせハードルが下がります。",
      workload: "低", impact: "高", time: "約20分", score: 5,
    },
    {
      key: "googleMap",
      label: "GoogleMapリンク",
      passed: false,
      positive: "トップページに地図リンクがあります。",
      suggestion: "トップページにGoogleMapへのリンクを設置してください。",
      outcome: "来店時の道案内がスムーズになります。",
      workload: "低", impact: "中", time: "約10分", score: 4,
    },
    {
      key: "instagram",
      label: "Instagramリンク",
      passed: false,
      positive: "InstagramへのリンクがSNS流入経路を確保しています。",
      suggestion: "トップページにInstagramへのリンクを設置してください。",
      outcome: "SNSからの流入経路が確保されます。",
      workload: "低", impact: "中", time: "約10分", score: 4,
    },
    {
      key: "booking",
      label: "予約・お問い合わせボタン",
      passed: hasWebsite ? false : false, // 将来的にスクレイピングで判定
      positive: "予約ボタンが目立つ位置にあります。",
      suggestion: "目立つ位置に予約・お問い合わせボタンを設置してください。",
      outcome: "お客様が次の行動に進みやすくなります。",
      workload: "低", impact: "高", time: "約20分", score: 5,
    },
    {
      key: "faq",
      label: "FAQ",
      passed: false,
      positive: "FAQが設置されています。",
      suggestion: "よくある質問ページを設置してください。",
      outcome: "お客様の疑問解消につながります。",
      workload: "中", impact: "中", time: "約60分", score: 3,
    },
    {
      key: "blog",
      label: "ブログ更新",
      passed: false,
      positive: "ブログやお知らせが定期更新されています。",
      suggestion: "ブログやお知らせを定期的に更新してください。",
      outcome: "サイトが活動的な印象を与えられます。",
      workload: "中", impact: "中", time: "継続的に", score: 3,
    },
    {
      key: "recruit",
      label: "採用ページ",
      passed: false,
      positive: "採用情報が掲載されています。",
      suggestion: "採用ページへの入口を設置してください。",
      outcome: "応募者が情報を見つけやすくなります。",
      workload: "中", impact: "低", time: "約30分", score: 2,
    },
  ];

  // ─────────────────────────────────────────
  // STEP 2: JS側でpriorityを選定（failed項目をscore順に3件）
  // ─────────────────────────────────────────
  const failedItems = homepageChecks
    .filter(item => !item.passed)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const priorities = failedItems.map(item => ({
    key: item.key,
    title: item.label,
    workload: item.workload,
    impact: item.impact,
    time: item.time,
    score: item.score,
    // suggestionとoutcomeはClaudeが文章化（後述）
  }));

  // ─────────────────────────────────────────
  // STEP 3: JS側で競合分析・営業ポイントを整理
  // ─────────────────────────────────────────
  const { rating, reviews, areaRating, areaReviews, nearbyCompetitors = [], superiorStores = [] } = placeData;

  const ratingGap = areaRating ? (rating - areaRating).toFixed(1) : null;
  const reviewsGap = areaReviews ? reviews - areaReviews : null;
  const nextReviewGoal = reviews ? Math.ceil(reviews * 1.2 / 10) * 10 : null;

  const competitorSummary = {
    storeRating: rating,
    storeReviews: reviews,
    areaRating,
    areaReviews,
    ratingStatus: ratingGap >= 0 ? "above" : "below",
    reviewsStatus: reviewsGap >= 0 ? "above" : "below",
    ratingGap,
    reviewsGap,
    nextReviewGoal,
    superiorCount: superiorStores.length,
    topCompetitor: superiorStores[0] || null,
  };

  const salesPoints = [];
  if (competitorSummary.ratingStatus === "above") {
    salesPoints.push("Googleの評価はエリア平均を上回っています。信頼感のアピールポイントとして活用できます。");
  } else {
    salesPoints.push("Googleの評価がエリア平均を下回っています。口コミ獲得の取り組みを提案するきっかけになります。");
  }
  if (competitorSummary.reviewsStatus === "below") {
    salesPoints.push(`口コミ数がエリア平均より${Math.abs(reviewsGap)}件少ない状況です。まず${nextReviewGoal}件を目標に増やすことを提案できます。`);
  }
  if (superiorStores.length > 0) {
    salesPoints.push(`エリアで強い競合が${superiorStores.length}店舗あります。差別化ポイントを整理する提案につながります。`);
  }

  // ─────────────────────────────────────────
  // STEP 4: analysisContextを組み立てる
  // ─────────────────────────────────────────
  const analysisContext = {
    storeName: placeData.storeName,
    strengths: homepageChecks.filter(i => i.passed).map(i => i.positive),
    weaknesses: failedItems.map(i => ({ title: i.label, suggestion: i.suggestion, outcome: i.outcome })),
    priorities,
    salesPoints,
    competitorSummary,
  };

  // ─────────────────────────────────────────
  // STEP 5: Claudeは文章化のみ
  // ─────────────────────────────────────────
  const prompt = `あなたは美容サロンの営業支援AIです。以下の分析データをもとに、営業担当がそのまま使える自然な日本語文章を生成してください。

【分析データ】
${JSON.stringify(analysisContext, null, 2)}

以下のJSON形式のみで回答してください。前後に説明文や\`\`\`は不要です。JSONのみ出力してください。

{
  "summary": "営業担当が最初に話す導入文（2〜3文）。数値の羅列ではなく、強みと伸びしろを自然に伝える文章。",
  "closing": "営業担当へのひとこと（1文）。次のアクションを後押しする言葉。",
  "offer": {
    "title": "初回改善サポート",
    "items": ["提案項目1", "提案項目2", "提案項目3"],
    "cta": "営業担当が使えるひとことCTA（1文）"
  },
  "priorityTexts": [
    {
      "key": "${priorities[0]?.key || ""}",
      "suggestion": "具体的な改善提案（1〜2文）",
      "outcome": "期待できる効果（1文）",
      "issue": "現状の課題（1文）",
      "reason": "優先する理由（1文）"
    },
    {
      "key": "${priorities[1]?.key || ""}",
      "suggestion": "具体的な改善提案（1〜2文）",
      "outcome": "期待できる効果（1文）",
      "issue": "現状の課題（1文）",
      "reason": "優先する理由（1文）"
    },
    {
      "key": "${priorities[2]?.key || ""}",
      "suggestion": "具体的な改善提案（1〜2文）",
      "outcome": "期待できる効果（1文）",
      "issue": "現状の課題（1文）",
      "reason": "優先する理由（1文）"
    }
  ]
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return { statusCode: 500, body: JSON.stringify({ error: "JSONが見つかりませんでした", raw: text.slice(0, 300) }) };
    }

    const jsonStr = text.slice(start, end + 1);
    const aiText = JSON.parse(jsonStr);

    // ─────────────────────────────────────────
    // STEP 6: JS判定結果 + AI文章を合体して返却
    // ─────────────────────────────────────────
    const finalPriorities = priorities.map((p, i) => {
      const pt = aiText.priorityTexts?.[i] || {};
      return {
        ...p,
        suggestion: pt.suggestion || "",
        outcome: pt.outcome || "",
        issue: pt.issue || "",
        reason: pt.reason || "",
        expected_outcome: pt.outcome || "",
      };
    });

    const analysis = {
      summary: aiText.summary || "",
      closing: aiText.closing || "",
      offer: aiText.offer || {},
      homepageChecks,
      priorities: finalPriorities,
      superiorStores: placeData.superiorStores || [],
      nearbyCompetitors: placeData.nearbyCompetitors || [],
      map: {
        rating,
        areaRating,
        reviews,
        areaReviews,
        nextReviewGoal,
      },
    };

    return { statusCode: 200, body: JSON.stringify(analysis) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
