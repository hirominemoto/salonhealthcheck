exports.handler = async (event) => {
  const { storeName, genre } = JSON.parse(event.body || "{}");
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!storeName) {
    return { statusCode: 400, body: JSON.stringify({ error: "店舗名が必要です" }) };
  }

  try {
    // ① テキスト検索で店舗を特定
    const searchQuery = genre ? `${storeName} ${genre}` : storeName;
    const searchRes = await fetch(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.regularOpeningHours,places.location,places.types",
        },
        body: JSON.stringify({
          textQuery: searchQuery,
          languageCode: "ja",
          maxResultCount: 1,
        }),
      }
    );
    const searchData = await searchRes.json();
    const place = searchData.places?.[0];

    if (!place) {
      return { statusCode: 404, body: JSON.stringify({ error: "店舗が見つかりませんでした" }) };
    }

    // ② 近隣競合を取得
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    const placeType = place.types?.[0] || "beauty_salon";

    let nearbyCompetitors = [];
    if (lat && lng) {
      const nearbyRes = await fetch(
        `https://places.googleapis.com/v1/places:searchNearby`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.displayName,places.rating,places.userRatingCount",
          },
          body: JSON.stringify({
            includedTypes: [placeType],
            maxResultCount: 10,
            locationRestriction: {
              circle: {
                center: { latitude: lat, longitude: lng },
                radius: 1000,
              },
            },
            languageCode: "ja",
          }),
        }
      );
      const nearbyData = await nearbyRes.json();
      nearbyCompetitors = (nearbyData.places || [])
        .filter(p => p.displayName?.text !== place.displayName?.text)
        .map(p => ({
          name: p.displayName?.text || "",
          rating: p.rating || null,
          reviews: p.userRatingCount || null,
        }));
    }

    // ③ エリア平均を算出
    const allRatings = nearbyCompetitors.filter(c => c.rating).map(c => c.rating);
    const allReviews = nearbyCompetitors.filter(c => c.reviews).map(c => c.reviews);
    const areaRating = allRatings.length
      ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
      : null;
    const areaReviews = allReviews.length
      ? Math.round(allReviews.reduce((a, b) => a + b, 0) / allReviews.length)
      : null;

    // ④ 優位店舗（評価4.5以上 かつ 口コミ100件以上）
    const superiorStores = nearbyCompetitors
      .filter(c => c.rating >= 4.5 && c.reviews >= 100)
      .sort((a, b) => b.reviews - a.reviews)
      .slice(0, 3);

    return {
      statusCode: 200,
      body: JSON.stringify({
        placeId: place.id,
        storeName: place.displayName?.text || storeName,
        address: place.formattedAddress || "",
        websiteUrl: place.websiteUri || null,
        hasOpeningHours: !!place.regularOpeningHours,
        rating: place.rating || null,
        reviews: place.userRatingCount || null,
        areaRating,
        areaReviews,
        nearbyCompetitors,
        superiorStores,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
