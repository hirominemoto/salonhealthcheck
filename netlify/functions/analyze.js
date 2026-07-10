exports.handler = async (event) => {
  const { placeData, keywords } = JSON.parse(event.body || "{}");
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!placeData) {
    return { statusCode: 400, body: JSON.stringify({ error: "店舗データが必要です" }) };
  }

  // ─────────────────────────────────────────
  // STEP 1: JS側でhomepageChecksを判定
  // ─────────────────────────────────────────
  const url = placeData.websiteUrl;
  const hasWebsite = !!url;

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
      passed: hasWebsite,
      positive: "電話番号が掲載されています。",
      suggestion: "ホームページに電話番号を掲載してください。",
      outcome: "問い合わせしやすくなります。",
      workload: "低", impact: "高", time: "約15分", score: 5,
    },
    {
      key: "line",
      label: "LINE導線",
      passed: false,
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
      passed: false,
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

  const priorities = failedItems.map(item => {
    const reasons = [item.suggestion];
    if (item.outcome) reasons.push(`改善すると：${item.outcome}`);
    return {
      key: item.key,
      title: item.label,
      workload: item.workload,
      impact: item.impact,
      time: item.time,
      score: item.score,
      reasons,
    };
  });

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
    keywords: keywords || "",
    strengths: homepageChecks.filter(i => i.passed).map(i => i.positive),
    weaknesses: failedItems.map(i => ({ title: i.label, suggestion: i.suggestion, outcome: i.outcome })),
    priorities,
    salesPoints,
    competitorSummary,
  };

  // ─────────────────────────────────────────
  // STEP 5: Claudeは文章化のみ
  // ─────────────────────────────────────────
  const keywordsLine = keywords
    ? `重点キーワード: ${keywords}（このキーワードで集客したい意図を踏まえて文章を作成してください）`
    : "重点キーワード: 指定なし";

  const prompt = `あなたは美容サロンの営業支援AIです。
以下の分析データは、JavaScriptが判定した事実です。
あなたの仕事は「新しい分析をすること」ではなく、「渡された事実を営業担当が話しやすい自然な日本語に翻訳すること」だけです。

【分析データ】
${JSON.stringify(analysisContext, null, 2)}

【キーワード情報】
${keywordsLine}

【ルール】
・渡されたデータ以外の情報を追加しないでください
・数値の羅列ではなく、営業担当がそのまま話せる文章にしてください
・「現状・課題」はそのサロン固有の状況が伝わる文章にしてください
・重点キーワードが指定されている場合は、そのキーワードに関連する提案や表現を優先的に使用してください

以下のJSON形式のみで回答してください。前後に説明文や\`\`\`は不要です。JSONのみ出力してください。

{
  "summary": "営業担当が最初に話す導入文（2〜3文）。強みと伸びしろを自然に伝える。",
  "closing": "次のアクションを後押しするひとこと（1文）。",
  "offer": {
    "title": "初回改善サポート",
    "items": ["提案項目1", "提案項目2", "提案項目3"],
    "cta": "営業担当が使えるひとことCTA（1文）"
  },
  "priorityTexts": [
    {
      "key": "${priorities[0]?.key || ""}",
      "issue": "渡されたreasonsをもとにした現状・課題（1〜2文、そのサロン固有の言葉で）",
      "suggestion": "渡されたreasonsをもとにした改善提案（1〜2文）",
      "outcome": "渡されたreasonsをもとにした期待効果（1文）",
      "reason": "このサロンにとって優先すべき理由（1文）"
    },
    {
      "key": "${priorities[1]?.key || ""}",
      "issue": "渡されたreasonsをもとにした現状・課題（1〜2文、そのサロン固有の言葉で）",
      "suggestion": "渡されたreasonsをもとにした改善提案（1〜2文）",
      "outcome": "渡されたreasonsをもとにした期待効果（1文）",
      "reason": "このサロンにとって優先すべき理由（1文）"
    },
    {
      "key": "${priorities[2]?.key || ""}",
      "issue": "渡されたreasonsをもとにした現状・課題（1〜2文、そのサロン固有の言葉で）",
      "suggestion": "渡されたreasonsをもとにした改善提案（1〜2文）",
      "outcome": "渡されたreasonsをもとにした期待効果（1文）",
      "reason": "このサロンにとって優先すべき理由（1文）"
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
