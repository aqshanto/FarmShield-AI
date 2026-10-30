# Bengali wording audit (other pages)

Strings outside the homepage that still used words the homepage no longer uses.
Line numbers are from 30 Oct 2026, before the fix.

**Status: fixed on 30 Oct 2026.** Every string below now uses জমি / স্যাটেলাইট /
ডেটা / ম্যাপ, and the same swap was made in the server's Bengali text
(`backend/app/i18n/bn.py`, `localize.py`, `assistant/offline.py`). Kept on purpose:

- তথ্যসূত্র (map attribution button): it means "sources", not data.
- তথ্য in the offline assistant's "I don't have flood/soil water/crop information
  right now": it means information, not data.
- "খামার বন্ধ করুন" (close the farm panel) became "জমির বিবরণ বন্ধ করুন", and
  "খামার হালনাগাদ রাখা হচ্ছে" became "জমির খবর হালনাগাদ রাখা হচ্ছে", because a
  word-for-word swap read oddly.

One judgment call per line: তথ্য is only wrong where it means *data*
(তথ্যসূত্র = attribution, for example, can stay).

## খামার (use জমি / ক্ষেত): 32 strings

### `frontend/src/app/router.tsx`
- line 14: প্রতিটি খামারের জন্য স্যাটেলাইটের চোখ
- line 15: খামারের ড্যাশবোর্ড

### `frontend/src/features/assistant/strings.ts`
- line 39: আপনার খামারের সাহায্যকারী। সেচ, বন্যা, ফসলের স্বাস্থ্য বা আবহাওয়া নিয়ে প্রশ্ন করুন।
- line 42: খামার
- line 61: আপনার খামারের নাসা তথ্য থেকে Claude উত্তর লিখছে।
- line 62: আপনার খামারের নাসা তথ্য থেকে দ্রুত উত্তর।

### `frontend/src/features/dashboard/DashboardSkeleton.tsx`
- line 6: আপনার খামার লোড হচ্ছে

### `frontend/src/features/dashboard/FarmHeader.tsx`
- line 47: আপনার খামার
- line 48: খামার বেছে নিন

### `frontend/src/features/dashboard/OverallCard.tsx`
- line 20: খামারের সার্বিক ঝুঁকি

### `frontend/src/features/dashboard/RecommendationList.tsx`
- line 43: আপনার খামার এখন আরও প্রস্তুত। কিছু বদলালে আমরা জানাব।

### `frontend/src/features/data/MissionCard.tsx`
- line 35: আপনার খামারের জন্য তথ্য

### `frontend/src/features/data/PipelineFlow.tsx`
- line 31: আপনার খামার
- line 31: খামার হালনাগাদ রাখা হচ্ছে
- line 35: নাসার তথ্য যেভাবে আপনার খামারে পৌঁছায়

### `frontend/src/features/design-system/ButtonSection.tsx`
- line 45: আমার খামার দেখুন

### `frontend/src/features/map/ExplorePanel.tsx`
- line 17: আপনার খামার

### `frontend/src/features/map/SpotPanels.tsx`
- line 28: খামার বন্ধ করুন
- line 29: খামারের ড্যাশবোর্ড খুলুন

### `frontend/src/pages/DashboardPage.tsx`
- line 37: খামারটি খুঁজে পাওয়া যায়নি
- line 38: আপনার খামার লোড করা যায়নি
- line 39: লিংকটি পুরোনো বা ভুল হতে পারে। আপনার একটি খামার বেছে নিন।
- line 42: আমার প্রথম খামার দেখান
- line 44: ওই খামারটি লোড হয়নি। এর বদলে ${name} দেখানো হচ্ছে।

### `frontend/src/pages/DataPage.tsx`
- line 55: ${String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])}টি উৎস থেকে নতুন তথ্য এখন আপনার খামারে।
- line 57: আপনার খামারে নাসার সর্বশেষ তথ্য আগে থেকেই আছে।
- line 66: নাসার চারটি মিশনের আসল মাপ, মেঘ আর ভুল বাদ দিয়ে যাচাই করা, সংরক্ষিত, আর আপনার খামারের ঝুঁকি-সতর্কতার জন্য তৈরি।
- line 71: আপনার খামারে নাসা যা দেখেছে
- line 72: খামারের সঠিক জায়গায় মাপা। প্রতিদিনের তথ্য দেখতে চার্টে মাউস রাখুন বা তীর-চাবি ব্যবহার করুন।
- line 73: খামার বেছে নিন
- line 74: এই খামারের তথ্য লোড করা যায়নি।

### `frontend/src/pages/MapPage.tsx`
- line 63: তবুও পাশের অংশে আপনার খামার আর ঝুঁকি দেখতে পারবেন।

## উপগ্রহ (use স্যাটেলাইট): 26 strings

### `frontend/src/components/ui/OrbitLoader.tsx`
- line 26: উপগ্রহের তথ্য পড়ছি…

### `frontend/src/features/add-farm/strings.ts`
- line 55: আপনার জমি কোথায় (পৃথিবীর যেকোনো জায়গায়) আর কী চাষ করছেন তা জানান। নাসার উপগ্রহ আপনার জমির খেয়াল রাখবে।
- line 74: উপগ্রহ

### `frontend/src/features/assistant/strings.ts`
- line 66: আপনার জমির নাসা উপগ্রহ তথ্যের ভিত্তিতে। ওষুধ ও মাত্রার জন্য উপজেলা কৃষি অফিস বা ১৬১২৩ নম্বরে ফোন করুন।

### `frontend/src/features/dashboard/CropIndicatorsPanel.tsx`
- line 36: এখনও পরিষ্কার উপগ্রহ ছবি নেই।
- line 37: শেষ পরিষ্কার উপগ্রহ ছবি

### `frontend/src/features/dashboard/FarmHeader.tsx`
- line 54: উপগ্রহ গেছে ${ago}

### `frontend/src/features/dashboard/RiskDetailPanel.tsx`
- line 39: উপগ্রহ যা দেখেছে

### `frontend/src/features/dashboard/module-visuals.tsx`
- line 54: উপগ্রহভিত্তিক আবহাওয়ার রেকর্ড আর মাসিক স্বাভাবিক মান

### `frontend/src/features/data/PipelineFlow.tsx`
- line 27: উপগ্রহ

### `frontend/src/features/data/missions.ts`
- line 24: মাটির আর্দ্রতা মাপার উপগ্রহ
- line 44: টেরা ও অ্যাকোয়া উপগ্রহ

### `frontend/src/features/design-system/ButtonSection.tsx`
- line 59: উপগ্রহের নতুন তথ্য

### `frontend/src/features/design-system/ColorSection.tsx`
- line 53: পানি, বৃষ্টি, উপগ্রহ

### `frontend/src/features/design-system/LoadingSection.tsx`
- line 26: কাঠামো-ছবি পাতাকে স্থির রাখে, কক্ষপথের লোডার দেখায় উপগ্রহ কাজ করছে, আর তথ্য ঠিক সেই জায়গাতেই ফুটে ওঠে।

### `frontend/src/features/design-system/StatsSection.tsx`
- line 46: নতুন উপগ্রহ-পর্যবেক্ষণ দেখুন

### `frontend/src/features/field/fieldState.ts`
- line 186: কয়েক সপ্তাহ ধরে মেঘের কারণে উপগ্রহ এই জমি দেখতে পায়নি। নিজে জমি ঘুরে দেখুন।

### `frontend/src/features/map/WorldSpotPanel.tsx`
- line 52: এই জায়গার জন্য নাসার উপগ্রহের তথ্য (SMAP, GPM, MODIS) এখন নামানো হচ্ছে। আরও নিখুঁত হিসাবের জন্য কয়েক মিনিট পর আবার চাপ দিন।

### `frontend/src/features/map/nasaLayers.ts`
- line 32: SMAP উপগ্রহ থেকে, উপরের মাটি কতটা ভেজা।
- line 45: GPM উপগ্রহ (IMERG) থেকে, কোথায় বৃষ্টি হয়েছে।
- line 58: Terra উপগ্রহের MODIS থেকে, গাছপালা কতটা সবুজ (গত ৮ দিন)।

### `frontend/src/pages/DashboardPage.tsx`
- line 43: উপগ্রহের তথ্য পড়ছি…

### `frontend/src/pages/DataPage.tsx`
- line 75: উপগ্রহের তথ্য পড়ছি…

### `frontend/src/pages/MapPage.tsx`
- line 59: সর্বশেষ উপগ্রহ ছবি নামানো হচ্ছে…

### `frontend/src/pages/NotFoundPage.tsx`
- line 8: আমাদের উপগ্রহ পাতাটি খুঁজে পায়নি।

### `frontend/src/pages/RouteErrorPage.tsx`
- line 25: আমাদের উপগ্রহ পাতাটি খুঁজে পায়নি।

## তথ্য (use ডেটা when it means data): 61 strings

### `frontend/src/app/router.tsx`
- line 20: নাসার তথ্য

### `frontend/src/components/layout/AppLayout.tsx`
- line 22: তথ্য
- line 27: নাসার পৃথিবী পর্যবেক্ষণ তথ্যের সাহায্যে

### `frontend/src/components/ui/OrbitLoader.tsx`
- line 26: উপগ্রহের তথ্য পড়ছি…

### `frontend/src/components/ui/TimeSeriesChart.tsx`
- line 273: এখনও কোনো তথ্য নেই
- line 302: তথ্য নেই

### `frontend/src/features/add-farm/strings.ts`
- line 80: বাংলাদেশের বাইরে ফার্মশিল্ড নাসার তথ্য দিয়ে আপনার জমির ঢাল আর মাটির ধরন অনুযায়ী হিসাব মিলিয়ে নেয়।
- line 94: আপনার জমির নাসা তথ্য পড়ছি। প্রথমবার কয়েক সেকেন্ড লাগে।
- line 95: আপনার জমির তথ্য শুধু এই ডিভাইসে রাখা হয়।

### `frontend/src/features/assistant/strings.ts`
- line 61: আপনার খামারের নাসা তথ্য থেকে Claude উত্তর লিখছে।
- line 62: আপনার খামারের নাসা তথ্য থেকে দ্রুত উত্তর।
- line 66: আপনার জমির নাসা উপগ্রহ তথ্যের ভিত্তিতে। ওষুধ ও মাত্রার জন্য উপজেলা কৃষি অফিস বা ১৬১২৩ নম্বরে ফোন করুন।

### `frontend/src/features/dashboard/FactorBreakdown.tsx`
- line 20: প্রতিটি কারণের জন্য মিশনের তথ্য আছে (SMAP মাটির আর্দ্রতাসহ)।
- line 21: কিছু কারণে বিকল্প তথ্য ব্যবহার হয়েছে (যেমন SMAP-এর বদলে NASA POWER)।
- line 22: কিছু তথ্য নেই, তাই স্কোর কম কারণের উপর নির্ভর করছে।

### `frontend/src/features/dashboard/FarmHeader.tsx`
- line 53: নাসার তথ্য ${ago}
- line 58: ডেমো তথ্য
- line 59: ডেমো পরিস্থিতি। নাসার তথ্যের জন্য DATA_MODE=live দিন।
- line 60: নাসার লাইভ তথ্য
- line 61: “লাইভ” চিহ্নিত ঝুঁকি নাসার তথ্য থেকে হিসাব করা; বাকিগুলো এখনও ডেমো।

### `frontend/src/features/dashboard/RiskCard.tsx`
- line 41: আজ নাসার তথ্য থেকে হিসাব করা

### `frontend/src/features/data/ApprovalCallout.tsx`
- line 20: আপনার Earthdata টোকেন কাজ করছে (SMAP-এর তথ্য আসছে)। ${m}-এর জন্য নাসার আর্কাইভ একবার তাদের তথ্য-শর্ত মেনে নিতে বলে। ততক্ষণ NASA POWER বিকল্প হিসেবে কাজ করবে।

### `frontend/src/features/data/FarmDataCharts.tsx`
- line 63: এখনও কোনো তথ্য নেই
- line 73: গত ৩০ দিনে ${month} মিমি। সবচেয়ে বেশি বৃষ্টি: ${date} (${wettest} মিমি)। বৃষ্টির প্রায় ৩ দিন পর তথ্য আসে।
- line 74: এখনও বৃষ্টির তথ্য নেই।
- line 77: তথ্য নেই।
- line 81: এখনও মাটির তথ্য নেই।

### `frontend/src/features/data/MissionCard.tsx`
- line 32: বিকল্প তথ্য
- line 33: মহাকাশ থেকে সর্বশেষ তথ্য
- line 35: আপনার খামারের জন্য তথ্য
- line 38: এই মিশনের নিজের তথ্য পেতে বিনামূল্যের Earthdata টোকেন যোগ করুন।

### `frontend/src/features/data/PipelineFlow.tsx`
- line 30: পরিষ্কার তথ্য সংরক্ষিত
- line 35: নাসার তথ্য যেভাবে আপনার খামারে পৌঁছায়

### `frontend/src/features/data/TokenCallout.tsx`
- line 18: GPM আর SMAP-এর তথ্য চালু করুন
- line 19: এখন বৃষ্টি আর মাটির আর্দ্রতার তথ্য আসছে NASA POWER থেকে। বিনামূল্যের NASA Earthdata টোকেন দিলে ফার্মশিল্ড সরাসরি GPM আর SMAP মিশন থেকে তথ্য পড়বে।

### `frontend/src/features/design-system/ButtonSection.tsx`
- line 54: তথ্য
- line 59: উপগ্রহের নতুন তথ্য

### `frontend/src/features/design-system/IllustrationSection.tsx`
- line 54: তথ্যের সাথে বদলায় এমন ছবি
- line 55: নাসার প্রতিটি মাপের জন্য একটি সহজ ছবি, যা তথ্যের সাথে বদলায়, তাই কৃষক এক নজরেই অবস্থা বুঝতে পারেন।

### `frontend/src/features/design-system/LoadingSection.tsx`
- line 26: কাঠামো-ছবি পাতাকে স্থির রাখে, কক্ষপথের লোডার দেখায় উপগ্রহ কাজ করছে, আর তথ্য ঠিক সেই জায়গাতেই ফুটে ওঠে।

### `frontend/src/features/field/fieldState.ts`
- line 175: নাসার তথ্য থেকে আজকের ঝুঁকির চিত্র, আসল ছবি নয়।

### `frontend/src/features/map/MapLegend.tsx`
- line 21: আজকের নাসা তথ্য থেকে প্রতিটি এলাকার হিসাব
- line 22: ডেমো তথ্য
- line 24: লাইভ তথ্য আনা হচ্ছে…

### `frontend/src/features/map/SpotPanels.tsx`
- line 26: এই জায়গার জন্য এখনও কোনো তথ্য নেই। একটু ভেতরের দিকে কোনো জায়গা চেষ্টা করুন।

### `frontend/src/features/map/WorldSpotPanel.tsx`
- line 48: NASA POWER থেকে বৃষ্টি আর মাটির তথ্য পড়ছি…
- line 52: এই জায়গার জন্য নাসার উপগ্রহের তথ্য (SMAP, GPM, MODIS) এখন নামানো হচ্ছে। আরও নিখুঁত হিসাবের জন্য কয়েক মিনিট পর আবার চাপ দিন।
- line 53: এই জায়গার জন্য নাসার তথ্য থেকে এখনই হিসাব করা।
- line 54: বাংলাদেশের বাইরের জায়গা দেখতে নাসার লাইভ তথ্য লাগে, আর এই সার্ভার এখন ডেমো চালাচ্ছে।

### `frontend/src/features/map/maplibre-setup.ts`
- line 14: তথ্যসূত্র দেখান

### `frontend/src/pages/DashboardPage.tsx`
- line 43: উপগ্রহের তথ্য পড়ছি…

### `frontend/src/pages/DataPage.tsx`
- line 53: আগের ভালো তথ্য রাখা হয়েছে। কয়েক মিনিট পর আবার চেষ্টা করুন।
- line 54: নাসার নতুন তথ্য নামানো হয়েছে
- line 55: ${String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])}টি উৎস থেকে নতুন তথ্য এখন আপনার খামারে।
- line 57: আপনার খামারে নাসার সর্বশেষ তথ্য আগে থেকেই আছে।
- line 61: তথ্য সংগ্রহের ব্যবস্থায় পৌঁছানো যায়নি
- line 64: নাসার তথ্যপ্রবাহ
- line 72: খামারের সঠিক জায়গায় মাপা। প্রতিদিনের তথ্য দেখতে চার্টে মাউস রাখুন বা তীর-চাবি ব্যবহার করুন।
- line 74: এই খামারের তথ্য লোড করা যায়নি।
- line 75: উপগ্রহের তথ্য পড়ছি…

### `frontend/src/pages/MapPage.tsx`
- line 53: মানচিত্রের তথ্য লোড করা যায়নি

## মানচিত্র (use ম্যাপ): 23 strings

### `frontend/src/app/router.tsx`
- line 16: ঝুঁকির মানচিত্র

### `frontend/src/components/layout/AppLayout.tsx`
- line 22: মানচিত্র

### `frontend/src/features/add-farm/LocationPickerMap.tsx`
- line 144: মানচিত্রের ধরন

### `frontend/src/features/add-farm/strings.ts`
- line 58: ফোনের লোকেশন ব্যবহার করুন, আপনার গ্রাম বা শহর খুঁজুন, অথবা মানচিত্রে আপনার জমিতে চাপ দিন।
- line 63: কোনো জায়গা পাওয়া যায়নি। অন্য বানানে চেষ্টা করুন, বা মানচিত্রে জমিতে চাপ দিন।
- line 64: এখন খোঁজা যাচ্ছে না। মানচিত্রে আপনার জমিতে চাপ দিন।
- line 67: লোকেশনের অনুমতি দেওয়া হয়নি। জায়গা খুঁজুন বা মানচিত্রে চাপ দিন।
- line 68: আপনার ডিভাইস লোকেশন খুঁজে পায়নি। জায়গা খুঁজুন বা মানচিত্রে চাপ দিন।
- line 70: এখন মানচিত্রে আপনার জমির সঠিক জায়গায় চাপ দিন, অথবা জেলা শহরই রাখুন।
- line 71: বিশ্বের মানচিত্র। পিন বসাতে আপনার জমিতে চাপ দিন, অথবা পিন টেনে সরান।
- line 72: মানচিত্রে আপনার জমিতে চাপ দিন
- line 73: মানচিত্র

### `frontend/src/features/dashboard/FarmHeader.tsx`
- line 55: মানচিত্রে দেখুন

### `frontend/src/features/map/ExplorePanel.tsx`
- line 17: মানচিত্রের যেকোনো জায়গায় চাপ দিন,

### `frontend/src/features/map/MapCanvas.tsx`
- line 336: বাংলাদেশের ঝুঁকির মানচিত্র ও নাসার বিশ্ব-মানচিত্র। সরাতে তীর-চাবি, কাছে বা দূরে নিতে প্লাস বা মাইনাস চাপুন।

### `frontend/src/features/map/MapLegend.tsx`
- line 25: সার্ভার এইমাত্র চালু হয়েছে। আজকের নাসা মানচিত্র তৈরি না হওয়া পর্যন্ত মডেল মানচিত্র দেখানো হচ্ছে (এক মিনিটের কম)।

### `frontend/src/features/map/WorldSpotPanel.tsx`
- line 48: মানচিত্রে জায়গাটি খুঁজছি…

### `frontend/src/pages/MapPage.tsx`
- line 53: মানচিত্রের তথ্য লোড করা যায়নি
- line 56: ঝুঁকির মানচিত্র
- line 58: মানচিত্রের স্তর
- line 62: এই ডিভাইসে মানচিত্র দেখানো যাচ্ছে না

### `frontend/src/pages/NotFoundPage.tsx`
- line 8: এই জমি মানচিত্রে নেই

### `frontend/src/pages/RouteErrorPage.tsx`
- line 23: এই জমি মানচিত্রে নেই
