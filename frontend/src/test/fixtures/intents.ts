/* Generated from intent backend 18756bf98d85fb3615e5166aa3f24d6f8ab158df. Do not edit. */
import type { CreatedIntent, IntentView } from '../../contracts/intent/responses'
import type { JourneyRecommendations } from '../../contracts'

export const createdIntentFixture: CreatedIntent = {
  "draft": {
    "draft_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "revision": 0,
    "expires_at": 4102444800,
    "status": "needs_clarification",
    "fields": {
      "product_query": "گوشی سامسونگ",
      "brand": null,
      "category": null,
      "max_budget": "۳۰ میلیون تومان",
      "min_budget": null,
      "location": null,
      "radius": null,
      "warranty": null,
      "installments": null,
      "return_window": null,
      "other_preferences": [],
      "coordinates": null
    },
    "provenance": {
      "product_query": {
        "source": "model_interpretation",
        "evidence": "گوشی سامسونگ"
      },
      "max_budget": {
        "source": "model_interpretation",
        "evidence": "۳۰ میلیون تومان"
      }
    },
    "max_budget": {
      "raw_text": "۳۰ میلیون تومان",
      "value": "30000000",
      "currency": "TOMAN",
      "toman": 30000000,
      "requires_clarification": false
    },
    "min_budget": null,
    "criteria": {
      "q": "گوشی سامسونگ",
      "min_price_toman": null,
      "max_price_toman": null,
      "city": null,
      "area": null,
      "max_budget": "30000000",
      "price_unit": "TOMAN",
      "latitude": null,
      "longitude": null,
      "max_distance_km": null,
      "preferred_purchase_conditions": null,
      "shopping_time": null
    },
    "issues": [
      {
        "field": "coordinates",
        "code": "resolution_required",
        "question": "نقطهٔ موردنظر را روی نقشه مشخص کن؛ نام محله به مختصات تبدیل نمی‌شود."
      },
      {
        "field": "radius",
        "code": "missing",
        "question": "شعاع جست‌وجو چند کیلومتر یا متر باشد؟"
      }
    ],
    "next_question": "نقطهٔ موردنظر را روی نقشه مشخص کن؛ نام محله به مختصات تبدیل نمی‌شود.",
    "summary": [
      {
        "label": "عبارت جست‌وجو",
        "value": "گوشی سامسونگ"
      },
      {
        "label": "سقف بودجه",
        "value": "30000000 TOMAN — 30,000,000 تومان"
      }
    ],
    "notices": [
      "تفسیر مدل تا تأیید صریح کاربر قطعی نیست.",
      "برند و دسته فقط در عبارت جست‌وجو هستند؛ فیلتر قطعی برند یا دسته نیستند.",
      "گارانتی و اقساط فقط ترجیح‌اند؛ وجودشان باید از فروشگاه بررسی شود.",
      "نتیجه فقط از کاتالوگ می‌آید؛ قیمت و موجودی زنده تأیید نشده‌اند."
    ],
    "search_performed": false
  },
  "access_token": "fixture-capability-never-a-provider-key"
}

export const readyIntentFixture: IntentView = {
  "draft_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "revision": 1,
  "expires_at": 4102444800,
  "status": "awaiting_confirmation",
  "fields": {
    "product_query": "گوشی سامسونگ",
    "brand": null,
    "category": null,
    "max_budget": "۳۰ میلیون تومان",
    "min_budget": null,
    "location": null,
    "radius": "۵ کیلومتر",
    "warranty": null,
    "installments": null,
    "return_window": null,
    "other_preferences": [],
    "coordinates": {
      "latitude": 35.7,
      "longitude": 51.4,
      "for_location": null
    }
  },
  "provenance": {
    "product_query": {
      "source": "model_interpretation",
      "evidence": "گوشی سامسونگ"
    },
    "max_budget": {
      "source": "model_interpretation",
      "evidence": "۳۰ میلیون تومان"
    },
    "radius": {
      "source": "user_supplied",
      "evidence": "۵ کیلومتر"
    },
    "coordinates": {
      "source": "user_supplied",
      "evidence": "user_map_selection"
    }
  },
  "max_budget": {
    "raw_text": "۳۰ میلیون تومان",
    "value": "30000000",
    "currency": "TOMAN",
    "toman": 30000000,
    "requires_clarification": false
  },
  "min_budget": null,
  "criteria": {
    "q": "گوشی سامسونگ",
    "min_price_toman": null,
    "max_price_toman": null,
    "city": null,
    "area": null,
    "max_budget": "30000000",
    "price_unit": "TOMAN",
    "latitude": 35.7,
    "longitude": 51.4,
    "max_distance_km": 5,
    "preferred_purchase_conditions": null,
    "shopping_time": null
  },
  "issues": [],
  "next_question": null,
  "summary": [
    {
      "label": "عبارت جست‌وجو",
      "value": "گوشی سامسونگ"
    },
    {
      "label": "سقف بودجه",
      "value": "30000000 TOMAN — 30,000,000 تومان"
    },
    {
      "label": "نقطهٔ انتخابی کاربر",
      "value": "35.7, 51.4"
    },
    {
      "label": "شعاع جست‌وجو",
      "value": "5 کیلومتر"
    }
  ],
  "notices": [
    "تفسیر مدل تا تأیید صریح کاربر قطعی نیست.",
    "برند و دسته فقط در عبارت جست‌وجو هستند؛ فیلتر قطعی برند یا دسته نیستند.",
    "گارانتی و اقساط فقط ترجیح‌اند؛ وجودشان باید از فروشگاه بررسی شود.",
    "نتیجه فقط از کاتالوگ می‌آید؛ قیمت و موجودی زنده تأیید نشده‌اند."
  ],
  "search_performed": false
}

export const confirmedIntentFixture: IntentView = {
  "draft_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "revision": 1,
  "expires_at": 4102444800,
  "status": "confirmed",
  "fields": {
    "product_query": "گوشی سامسونگ",
    "brand": null,
    "category": null,
    "max_budget": "۳۰ میلیون تومان",
    "min_budget": null,
    "location": null,
    "radius": "۵ کیلومتر",
    "warranty": null,
    "installments": null,
    "return_window": null,
    "other_preferences": [],
    "coordinates": {
      "latitude": 35.7,
      "longitude": 51.4,
      "for_location": null
    }
  },
  "provenance": {
    "product_query": {
      "source": "model_interpretation",
      "evidence": "گوشی سامسونگ"
    },
    "max_budget": {
      "source": "model_interpretation",
      "evidence": "۳۰ میلیون تومان"
    },
    "radius": {
      "source": "user_supplied",
      "evidence": "۵ کیلومتر"
    },
    "coordinates": {
      "source": "user_supplied",
      "evidence": "user_map_selection"
    }
  },
  "max_budget": {
    "raw_text": "۳۰ میلیون تومان",
    "value": "30000000",
    "currency": "TOMAN",
    "toman": 30000000,
    "requires_clarification": false
  },
  "min_budget": null,
  "criteria": {
    "q": "گوشی سامسونگ",
    "min_price_toman": null,
    "max_price_toman": null,
    "city": null,
    "area": null,
    "max_budget": "30000000",
    "price_unit": "TOMAN",
    "latitude": 35.7,
    "longitude": 51.4,
    "max_distance_km": 5,
    "preferred_purchase_conditions": null,
    "shopping_time": null
  },
  "issues": [],
  "next_question": null,
  "summary": [
    {
      "label": "عبارت جست‌وجو",
      "value": "گوشی سامسونگ"
    },
    {
      "label": "سقف بودجه",
      "value": "30000000 TOMAN — 30,000,000 تومان"
    },
    {
      "label": "نقطهٔ انتخابی کاربر",
      "value": "35.7, 51.4"
    },
    {
      "label": "شعاع جست‌وجو",
      "value": "5 کیلومتر"
    }
  ],
  "notices": [
    "تفسیر مدل تا تأیید صریح کاربر قطعی نیست.",
    "برند و دسته فقط در عبارت جست‌وجو هستند؛ فیلتر قطعی برند یا دسته نیستند.",
    "گارانتی و اقساط فقط ترجیح‌اند؛ وجودشان باید از فروشگاه بررسی شود.",
    "نتیجه فقط از کاتالوگ می‌آید؛ قیمت و موجودی زنده تأیید نشده‌اند."
  ],
  "search_performed": false
}

export const intentJourneyFixture: JourneyRecommendations = {
  "state": {
    "request_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "revision": 1,
    "criteria": {
      "q": "گوشی سامسونگ",
      "min_price_toman": null,
      "max_price_toman": null,
      "city": null,
      "area": null,
      "max_budget": "30000000",
      "price_unit": "TOMAN",
      "latitude": 35.7,
      "longitude": 51.4,
      "max_distance_km": 5,
      "preferred_purchase_conditions": null,
      "shopping_time": null
    },
    "comparison": null,
    "status": "recommendations_ready",
    "search_performed": true
  },
  "result": {
    "schema_version": "alternatives-v1",
    "original_constraints": {
      "query": "گوشی سامسونگ",
      "max_budget": "30000000",
      "price_unit": "TOMAN",
      "latitude": 35.7,
      "longitude": 51.4,
      "max_distance_km": 5,
      "preferred_purchase_conditions": null,
      "shopping_time": null
    },
    "policy": {
      "retrieval": {
        "max_pages": 2,
        "page_size": 50
      },
      "max_budget_increase_fraction": 0.25,
      "max_radius_multiplier": 2,
      "max_total_seconds": 5,
      "max_suggestions": 3,
      "alternative_queries": []
    },
    "original": {
      "schema_version": "2.0",
      "strategy": {
        "version": "lexical-v1",
        "relevance_weight": 0.6,
        "price_weight": 0.2,
        "distance_weight": 0.15,
        "opening_hours_weight": 0.025,
        "purchase_conditions_weight": 0.025,
        "distance_scale_km": 10,
        "max_results": 10,
        "ordering": "product_match_desc,overall_score_desc,offer_id_asc"
      },
      "context": {
        "contract_version": "1.0.0-draft.1",
        "dataset": {
          "dataset_id": "torob-5a1a259eea5ba2cf",
          "source_kind": "sample",
          "imported_at": "2026-10-01T00:00:00Z",
          "source_sha256": "5a1a259eea5ba2cf1a015b49b746cf5ecfcec7132986dc8fee77809edf4ca3e0",
          "counts": {
            "shops": 4,
            "products": 4,
            "offers": 5
          },
          "coverage": "Tehran dataset; coverage is incomplete"
        },
        "currency": "toman",
        "notices": [
          "offer_does_not_confirm_stock",
          "price_timestamp_is_last_change_not_last_verification",
          "shop_names_synthetic_or_unverified",
          "contact_numbers_synthetic",
          "tehran_coverage_incomplete"
        ]
      },
      "coverage": {
        "query": {
          "lat": 35.7,
          "lon": 51.4,
          "radius_km": 5,
          "page": 1,
          "page_size": 50,
          "q": "گوشی سامسونگ",
          "category": null,
          "shop_id": null,
          "product_id": null,
          "min_price_toman": null,
          "max_price_toman": 30000000,
          "sort": "price_asc"
        },
        "pages_fetched": 1,
        "retrieved_count": 2,
        "catalog_total": 2,
        "complete_for_query": true,
        "stop_reason": "exhausted",
        "ranking_scope": "retrieved_candidates",
        "full_dataset_ranking": false
      },
      "considered_count": 2,
      "eligible_count": 2,
      "excluded_counts": {
        "irrelevant": 0,
        "unknown_price": 0,
        "over_budget": 0,
        "unknown_distance": 0,
        "outside_radius": 0
      },
      "recommendations": [
        {
          "offer_id": "sample_offer_1",
          "product_id": "sample_product_phone",
          "shop_id": "sample_shop_center",
          "candidate": {
            "offer_id": "sample_offer_1",
            "evidence": "offer_record",
            "product": {
              "product_id": "sample_product_phone",
              "persian_title": "گوشی سامسونگ Galaxy A55 ۲۵۶",
              "category_name": "گوشی موبایل",
              "brand_name": "سامسونگ",
              "model": null,
              "image_urls": []
            },
            "shop": {
              "shop_id": "sample_shop_center",
              "name": "فروشگاه نمونه مرکز",
              "address": "نشانی ساختگی برای تست",
              "location_label": "محدوده نمونه تهران",
              "lat": 35.7,
              "lon": 51.4,
              "category_names": [
                "گوشی موبایل",
                "لپ تاپ"
              ],
              "contacts": [],
              "instagram": null,
              "website_url": null,
              "payment_options": [
                "پرداخت در محل"
              ],
              "supports_fast_delivery": null,
              "weekly_hours": {
                "sat": {
                  "status": "declared",
                  "shifts": [
                    {
                      "start_time": "09:00:00",
                      "end_time": "18:00:00"
                    }
                  ]
                }
              },
              "identity_status": "synthetic_or_unverified",
              "contacts_status": "synthetic"
            },
            "price_toman": 20000000,
            "last_price_changed_at": "2026-09-14T06:30:00Z",
            "seller_title": "عنوان نمونه فروشنده",
            "description": null,
            "warranty": null,
            "distance_km": 0,
            "availability": "unconfirmed",
            "requires_verification_before_visit": true
          },
          "overall_score": 0.8166666666666667,
          "score_breakdown": {
            "product_match": 1,
            "budget_fit": 0.33333333333333337,
            "distance_fit": 1,
            "opening_hours_fit": null,
            "purchase_conditions_fit": null,
            "price_freshness": null
          },
          "explanation_reasons": [
            {
              "code": "product_match",
              "message": "در عنوان، برند، مدل یا دستهٔ ثبت‌شدهٔ محصول، 2 از 2 واژهٔ جست‌وجو پیدا شد؛ یکسان بودن دقیق مدل تضمین نمی‌شود."
            },
            {
              "code": "within_budget",
              "message": "قیمت ثبت‌شدهٔ 20,000,000 تومان از سقف 30,000,000 تومان بیشتر نیست؛ قیمت فعلی باید بررسی شود."
            },
            {
              "code": "distance",
              "message": "فاصلهٔ مستقیم محاسبه‌شده 0.000 کیلومتر است؛ این مقدار مسافت خیابانی یا زمان سفر نیست."
            }
          ],
          "data_limitations": [
            {
              "code": "inventory_not_verified",
              "message": "آفر ثبت‌شده اثبات موجودی نیست؛ پیش از مراجعه موجودی را بررسی کنید."
            },
            {
              "code": "recorded_price_not_live",
              "message": "قیمت ثبت‌شده ممکن است با قیمت فعلی فروشگاه تفاوت داشته باشد."
            },
            {
              "code": "price_freshness_unknown",
              "message": "زمان تغییر قیمت، زمان تأیید قیمت فعلی یا موجودی نیست."
            },
            {
              "code": "shopping_time_unknown",
              "message": "ساعت کاری در زمان درخواستی روشن نیست؛ امتیاز آن نامشخص است."
            }
          ],
          "before_visit_verification": {
            "status": "unverified",
            "availability": "unconfirmed",
            "requires_verification_before_visit": true
          }
        },
        {
          "offer_id": "sample_offer_3",
          "product_id": "sample_product_same_title",
          "shop_id": "sample_shop_center",
          "candidate": {
            "offer_id": "sample_offer_3",
            "evidence": "offer_record",
            "product": {
              "product_id": "sample_product_same_title",
              "persian_title": "گوشی سامسونگ Galaxy A55 ۲۵۶",
              "category_name": "گوشی موبایل",
              "brand_name": "سامسونگ",
              "model": null,
              "image_urls": []
            },
            "shop": {
              "shop_id": "sample_shop_center",
              "name": "فروشگاه نمونه مرکز",
              "address": "نشانی ساختگی برای تست",
              "location_label": "محدوده نمونه تهران",
              "lat": 35.7,
              "lon": 51.4,
              "category_names": [
                "گوشی موبایل",
                "لپ تاپ"
              ],
              "contacts": [],
              "instagram": null,
              "website_url": null,
              "payment_options": [
                "پرداخت در محل"
              ],
              "supports_fast_delivery": null,
              "weekly_hours": {
                "sat": {
                  "status": "declared",
                  "shifts": [
                    {
                      "start_time": "09:00:00",
                      "end_time": "18:00:00"
                    }
                  ]
                }
              },
              "identity_status": "synthetic_or_unverified",
              "contacts_status": "synthetic"
            },
            "price_toman": 20000000,
            "last_price_changed_at": "2026-09-16T10:00:00Z",
            "seller_title": "عنوان نمونه فروشنده",
            "description": null,
            "warranty": null,
            "distance_km": 0,
            "availability": "unconfirmed",
            "requires_verification_before_visit": true
          },
          "overall_score": 0.8166666666666667,
          "score_breakdown": {
            "product_match": 1,
            "budget_fit": 0.33333333333333337,
            "distance_fit": 1,
            "opening_hours_fit": null,
            "purchase_conditions_fit": null,
            "price_freshness": null
          },
          "explanation_reasons": [
            {
              "code": "product_match",
              "message": "در عنوان، برند، مدل یا دستهٔ ثبت‌شدهٔ محصول، 2 از 2 واژهٔ جست‌وجو پیدا شد؛ یکسان بودن دقیق مدل تضمین نمی‌شود."
            },
            {
              "code": "within_budget",
              "message": "قیمت ثبت‌شدهٔ 20,000,000 تومان از سقف 30,000,000 تومان بیشتر نیست؛ قیمت فعلی باید بررسی شود."
            },
            {
              "code": "distance",
              "message": "فاصلهٔ مستقیم محاسبه‌شده 0.000 کیلومتر است؛ این مقدار مسافت خیابانی یا زمان سفر نیست."
            }
          ],
          "data_limitations": [
            {
              "code": "inventory_not_verified",
              "message": "آفر ثبت‌شده اثبات موجودی نیست؛ پیش از مراجعه موجودی را بررسی کنید."
            },
            {
              "code": "recorded_price_not_live",
              "message": "قیمت ثبت‌شده ممکن است با قیمت فعلی فروشگاه تفاوت داشته باشد."
            },
            {
              "code": "price_freshness_unknown",
              "message": "زمان تغییر قیمت، زمان تأیید قیمت فعلی یا موجودی نیست."
            },
            {
              "code": "shopping_time_unknown",
              "message": "ساعت کاری در زمان درخواستی روشن نیست؛ امتیاز آن نامشخص است."
            }
          ],
          "before_visit_verification": {
            "status": "unverified",
            "availability": "unconfirmed",
            "requires_verification_before_visit": true
          }
        }
      ],
      "notices": [
        "ranking_is_limited_to_retrieved_candidates",
        "catalog_query_is_lexical_AND_not_semantic_search",
        "catalog_dataset_coverage_is_incomplete",
        "lexical_matching_does_not_confirm_exact_product_identity"
      ]
    },
    "original_verification": [
      {
        "offer_id": "sample_offer_1",
        "product_id": "sample_product_phone",
        "shop_id": "sample_shop_center",
        "state": "awaiting_user_verification",
        "availability": "unconfirmed",
        "requires_verification_before_visit": true,
        "contact_attempted": false,
        "contact_policy": "synthetic_contacts_not_for_contact",
        "recorded_price_toman": 20000000,
        "last_price_changed_at": "2026-09-14T06:30:00Z",
        "price_verification_status": "unknown",
        "shopping_time": null,
        "requested_purchase_conditions": null,
        "opening_hours_status": "recorded_unverified",
        "recorded_weekly_hours": {
          "sat": {
            "status": "declared",
            "shifts": [
              {
                "start_time": "09:00:00",
                "end_time": "18:00:00"
              }
            ]
          }
        },
        "payment_status": "recorded_unverified",
        "recorded_payment_options": [
          "پرداخت در محل"
        ],
        "warranty_status": "unknown",
        "recorded_warranty": null,
        "checklist": [
          {
            "topic": "inventory",
            "question": "آیا همین کالای ثبت‌شده با عنوان «گوشی سامسونگ Galaxy A55 ۲۵۶» و مدل دقیق مورد نظر موجود است؟",
            "evidence_paths": [
              "candidate.offer_id",
              "candidate.product"
            ],
            "state": "pending"
          },
          {
            "topic": "price",
            "question": "آیا قیمت ثبت‌شدهٔ 20,000,000 تومان برای همین کالا هنوز معتبر است؟",
            "evidence_paths": [
              "candidate.price_toman",
              "candidate.last_price_changed_at"
            ],
            "state": "pending"
          },
          {
            "topic": "opening_hours",
            "question": "آیا فروشگاه در زمان مراجعهٔ مورد نظر باز است؟ ساعات کاری باید تأیید شود.",
            "evidence_paths": [
              "criteria.shopping_time",
              "candidate.shop.weekly_hours"
            ],
            "state": "pending"
          },
          {
            "topic": "payment",
            "question": "چه روش‌های پرداختی برای همین کالا پذیرفته می‌شود و شرایط هر روش چیست؟",
            "evidence_paths": [
              "criteria.preferred_purchase_conditions",
              "candidate.shop.payment_options"
            ],
            "state": "pending"
          },
          {
            "topic": "warranty",
            "question": "آیا همین کالا گارانتی معتبر دارد؟ شرکت، مدت و شرایط گارانتی چیست؟",
            "evidence_paths": [
              "candidate.warranty",
              "criteria.preferred_purchase_conditions"
            ],
            "state": "pending"
          }
        ],
        "warnings": [
          "offer_does_not_confirm_stock",
          "price_timestamp_is_last_change_not_last_verification",
          "shop_names_synthetic_or_unverified",
          "contact_numbers_synthetic",
          "tehran_coverage_incomplete",
          "inventory_not_verified",
          "recorded_price_is_not_live",
          "price_timestamp_is_last_change_not_verification",
          "opening_hours_and_purchase_conditions_require_verification",
          "synthetic_contacts_not_for_contact",
          "no_seller_contact_or_verification_has_occurred"
        ]
      },
      {
        "offer_id": "sample_offer_3",
        "product_id": "sample_product_same_title",
        "shop_id": "sample_shop_center",
        "state": "awaiting_user_verification",
        "availability": "unconfirmed",
        "requires_verification_before_visit": true,
        "contact_attempted": false,
        "contact_policy": "synthetic_contacts_not_for_contact",
        "recorded_price_toman": 20000000,
        "last_price_changed_at": "2026-09-16T10:00:00Z",
        "price_verification_status": "unknown",
        "shopping_time": null,
        "requested_purchase_conditions": null,
        "opening_hours_status": "recorded_unverified",
        "recorded_weekly_hours": {
          "sat": {
            "status": "declared",
            "shifts": [
              {
                "start_time": "09:00:00",
                "end_time": "18:00:00"
              }
            ]
          }
        },
        "payment_status": "recorded_unverified",
        "recorded_payment_options": [
          "پرداخت در محل"
        ],
        "warranty_status": "unknown",
        "recorded_warranty": null,
        "checklist": [
          {
            "topic": "inventory",
            "question": "آیا همین کالای ثبت‌شده با عنوان «گوشی سامسونگ Galaxy A55 ۲۵۶» و مدل دقیق مورد نظر موجود است؟",
            "evidence_paths": [
              "candidate.offer_id",
              "candidate.product"
            ],
            "state": "pending"
          },
          {
            "topic": "price",
            "question": "آیا قیمت ثبت‌شدهٔ 20,000,000 تومان برای همین کالا هنوز معتبر است؟",
            "evidence_paths": [
              "candidate.price_toman",
              "candidate.last_price_changed_at"
            ],
            "state": "pending"
          },
          {
            "topic": "opening_hours",
            "question": "آیا فروشگاه در زمان مراجعهٔ مورد نظر باز است؟ ساعات کاری باید تأیید شود.",
            "evidence_paths": [
              "criteria.shopping_time",
              "candidate.shop.weekly_hours"
            ],
            "state": "pending"
          },
          {
            "topic": "payment",
            "question": "چه روش‌های پرداختی برای همین کالا پذیرفته می‌شود و شرایط هر روش چیست؟",
            "evidence_paths": [
              "criteria.preferred_purchase_conditions",
              "candidate.shop.payment_options"
            ],
            "state": "pending"
          },
          {
            "topic": "warranty",
            "question": "آیا همین کالا گارانتی معتبر دارد؟ شرکت، مدت و شرایط گارانتی چیست؟",
            "evidence_paths": [
              "candidate.warranty",
              "criteria.preferred_purchase_conditions"
            ],
            "state": "pending"
          }
        ],
        "warnings": [
          "offer_does_not_confirm_stock",
          "price_timestamp_is_last_change_not_last_verification",
          "shop_names_synthetic_or_unverified",
          "contact_numbers_synthetic",
          "tehran_coverage_incomplete",
          "inventory_not_verified",
          "recorded_price_is_not_live",
          "price_timestamp_is_last_change_not_verification",
          "opening_hours_and_purchase_conditions_require_verification",
          "synthetic_contacts_not_for_contact",
          "no_seller_contact_or_verification_has_occurred"
        ]
      }
    ],
    "diagnoses": [],
    "suggestions": [],
    "coverage": [
      {
        "query": {
          "lat": 35.7,
          "lon": 51.4,
          "radius_km": 5,
          "page": 1,
          "page_size": 50,
          "q": "گوشی سامسونگ",
          "category": null,
          "shop_id": null,
          "product_id": null,
          "min_price_toman": null,
          "max_price_toman": 30000000,
          "sort": "price_asc"
        },
        "pages_fetched": 1,
        "retrieved_count": 2,
        "catalog_total": 2,
        "complete_for_query": true,
        "stop_reason": "exhausted",
        "ranking_scope": "retrieved_candidates",
        "full_dataset_ranking": false
      }
    ],
    "catalog_requests": 1,
    "warnings": [
      "offer_does_not_confirm_stock",
      "price_timestamp_is_last_change_not_last_verification",
      "shop_names_synthetic_or_unverified",
      "contact_numbers_synthetic",
      "tehran_coverage_incomplete",
      "diagnosis_and_alternatives_are_limited_to_retrieved_records",
      "numeric_relaxations_are_capped_by_policy",
      "relaxed_alternatives_require_user_acceptance",
      "inventory_and_current_price_remain_unverified",
      "synthetic_contacts_not_for_contact"
    ]
  }
}

export const rejectedIntentFixture: IntentView = {
  "draft_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "revision": 2,
  "expires_at": 4102444800,
  "status": "rejected",
  "fields": {
    "product_query": "گوشی سامسونگ",
    "brand": null,
    "category": null,
    "max_budget": "۳۰ میلیون تومان",
    "min_budget": null,
    "location": null,
    "radius": "۵ کیلومتر",
    "warranty": null,
    "installments": null,
    "return_window": null,
    "other_preferences": [],
    "coordinates": {
      "latitude": 35.7,
      "longitude": 51.4,
      "for_location": null
    }
  },
  "provenance": {
    "product_query": {
      "source": "model_interpretation",
      "evidence": "گوشی سامسونگ"
    },
    "max_budget": {
      "source": "model_interpretation",
      "evidence": "۳۰ میلیون تومان"
    },
    "radius": {
      "source": "user_supplied",
      "evidence": "۵ کیلومتر"
    },
    "coordinates": {
      "source": "user_supplied",
      "evidence": "user_map_selection"
    }
  },
  "max_budget": {
    "raw_text": "۳۰ میلیون تومان",
    "value": "30000000",
    "currency": "TOMAN",
    "toman": 30000000,
    "requires_clarification": false
  },
  "min_budget": null,
  "criteria": {
    "q": "گوشی سامسونگ",
    "min_price_toman": null,
    "max_price_toman": null,
    "city": null,
    "area": null,
    "max_budget": "30000000",
    "price_unit": "TOMAN",
    "latitude": 35.7,
    "longitude": 51.4,
    "max_distance_km": 5,
    "preferred_purchase_conditions": null,
    "shopping_time": null
  },
  "issues": [],
  "next_question": null,
  "summary": [
    {
      "label": "عبارت جست‌وجو",
      "value": "گوشی سامسونگ"
    },
    {
      "label": "سقف بودجه",
      "value": "30000000 TOMAN — 30,000,000 تومان"
    },
    {
      "label": "نقطهٔ انتخابی کاربر",
      "value": "35.7, 51.4"
    },
    {
      "label": "شعاع جست‌وجو",
      "value": "5 کیلومتر"
    }
  ],
  "notices": [
    "تفسیر مدل تا تأیید صریح کاربر قطعی نیست.",
    "برند و دسته فقط در عبارت جست‌وجو هستند؛ فیلتر قطعی برند یا دسته نیستند.",
    "گارانتی و اقساط فقط ترجیح‌اند؛ وجودشان باید از فروشگاه بررسی شود.",
    "نتیجه فقط از کاتالوگ می‌آید؛ قیمت و موجودی زنده تأیید نشده‌اند."
  ],
  "search_performed": false
}
