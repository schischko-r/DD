// Generated read-only by scripts/generate-elk-history.py; only ELK, Книга1(4).xlsx, Лист1.
// SHA-256: 620edde1c9950406262b3de92e5faed96d35e4bacbc6c1343e38e8b9f626b561
// Raw D/E/F/G cells remain unchanged. Source labels and explicit UI aliases are stored separately.
export const previousElk = {
  "4a1bd6b8-c295-50fd-b4c6-14d4873c6bb0¦Единый личный кабинет (ЕЛК)": {
    "source": {
      "file": "Книга1(4).xlsx",
      "sheet": "Лист1",
      "answerColumn": "D",
      "commentColumn": "E",
      "markColumn": "F",
      "processedColumn": "G",
      "selectionRule": "Only numeric 1 in column F confirms an option. Comments E and processed metadata G never imply selection."
    },
    "funnelElements": {
      "usageIncludes": [
        "CR и CTR"
      ],
      "churnIncludes": [
        "Механики удержания",
        "% оттока"
      ]
    },
    "reportLinks": {
      "usageReport": [
        "https://navigator.sigma.sbrf.ru/gdash/1000002960"
      ],
      "churnReport": [
        "https://navigator.sigma.sbrf.ru/gdash/1000002960"
      ]
    },
    "acceptedBacklogLinks": [
      "https://jira.sberbank.ru/browse/SID-76026?jql=component%20%3D%20%22SberID_Data%26Analytic%22%20AND%20labels%20%3D%20sberid_elk"
    ],
    "mechanics": [
      "Стимулирование клиента (геймификация, пуши, Nudging-механики)"
    ],
    "uiAliases": {
      "Стимулирование клиента (геймификация, пуши,Nudging механики)": "Стимулирование клиента (геймификация, пуши, Nudging-механики)"
    },
    "knownSubanswers": {
      "qualityTools": {
        "question": "Какие инструменты вы используете для проверки качества данных для построения аналитики по вашему продукту?",
        "selectedOptions": [
          "Встроенные дашборды и алерты по качеству данных (ККД) в Навигаторе",
          "Ручная проверка аналитиками (сверка с первичными источниками, выгрузки)",
          "Проверка на стороне источника данных (DWH, витрины) силами data-инженеров"
        ],
        "comments": [
          {
            "cell": "E40",
            "value": "https://navigator.sigma.sbrf.ru/gdash/1000004198"
          }
        ],
        "links": [
          "https://navigator.sigma.sbrf.ru/gdash/1000004198"
        ],
        "sourceCells": [
          {
            "row": 40,
            "answer": {
              "cell": "D40",
              "value": "Встроенные дашборды и алерты по качеству данных (ККД) в Навигаторе"
            },
            "comment": {
              "cell": "E40",
              "value": "https://navigator.sigma.sbrf.ru/gdash/1000004198",
              "hyperlink": "https://navigator.sigma.sbrf.ru/gdash/1000004198"
            },
            "mark": {
              "cell": "F40",
              "value": 1
            },
            "processed": {
              "cell": "G40",
              "value": 0.5
            }
          },
          {
            "row": 41,
            "answer": {
              "cell": "D41",
              "value": "Собственная система мониторинга качества данных"
            },
            "comment": {
              "cell": "E41",
              "value": null
            },
            "mark": {
              "cell": "F41",
              "value": null
            },
            "processed": {
              "cell": "G41",
              "value": null
            }
          },
          {
            "row": 42,
            "answer": {
              "cell": "D42",
              "value": "Ручная проверка аналитиками (сверка с первичными источниками, выгрузки)"
            },
            "comment": {
              "cell": "E42",
              "value": null
            },
            "mark": {
              "cell": "F42",
              "value": 1
            },
            "processed": {
              "cell": "G42",
              "value": null
            }
          },
          {
            "row": 43,
            "answer": {
              "cell": "D43",
              "value": "Проверка на стороне источника данных (DWH, витрины) силами data-инженеров"
            },
            "comment": {
              "cell": "E43",
              "value": null
            },
            "mark": {
              "cell": "F43",
              "value": 1
            },
            "processed": {
              "cell": "G43",
              "value": null
            }
          },
          {
            "row": 44,
            "answer": {
              "cell": "D44",
              "value": "Не используем специальные инструменты — доверяем источнику"
            },
            "comment": {
              "cell": "E44",
              "value": null
            },
            "mark": {
              "cell": "F44",
              "value": null
            },
            "processed": {
              "cell": "G44",
              "value": null
            }
          },
          {
            "row": 45,
            "answer": {
              "cell": "D45",
              "value": "Свой вариант ответа"
            },
            "comment": {
              "cell": "E45",
              "value": null
            },
            "mark": {
              "cell": "F45",
              "value": null
            },
            "processed": {
              "cell": "G45",
              "value": null
            }
          },
          {
            "row": 46,
            "answer": {
              "cell": "D46",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E46",
              "value": null
            },
            "mark": {
              "cell": "F46",
              "value": "ДЕШ по ККД пустой"
            },
            "processed": {
              "cell": "G46",
              "value": null
            }
          }
        ]
      },
      "industrialData": {
        "question": "Используете ли вы промышленные данные для аналитики по вашему продукту?",
        "selectedOptions": [
          "Да, большая часть метрик — на промышленных данных, но часть ещё требует ручной обработки"
        ],
        "comments": [
          {
            "cell": "E48",
            "value": "Данные по микросервисам, которыми владеет ЕЛК или другие смежные команда банка (Прайм, Лояльность, Сбер ID) - получаем из промышленного контура. Данные по микросервисам, которыми владеют ДЗО - через отдельный запрос в ДЗО."
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 47,
            "answer": {
              "cell": "D47",
              "value": "Да, все ключевые метрики строятся на основе промышленных данных (витрины, DWH, автоматизированные пайплайны)"
            },
            "comment": {
              "cell": "E47",
              "value": null
            },
            "mark": {
              "cell": "F47",
              "value": null
            },
            "processed": {
              "cell": "G47",
              "value": 0.5
            }
          },
          {
            "row": 48,
            "answer": {
              "cell": "D48",
              "value": "Да, большая часть метрик — на промышленных данных, но часть ещё требует ручной обработки"
            },
            "comment": {
              "cell": "E48",
              "value": "Данные по микросервисам, которыми владеет ЕЛК или другие смежные команда банка (Прайм, Лояльность, Сбер ID) - получаем из промышленного контура. Данные по микросервисам, которыми владеют ДЗО - через отдельный запрос в ДЗО."
            },
            "mark": {
              "cell": "F48",
              "value": 1
            },
            "processed": {
              "cell": "G48",
              "value": null
            }
          },
          {
            "row": 49,
            "answer": {
              "cell": "D49",
              "value": "Частично: промышленные данные есть, но мы чаще используем ad-hoc-выгрузки и ручную обработку"
            },
            "comment": {
              "cell": "E49",
              "value": null
            },
            "mark": {
              "cell": "F49",
              "value": null
            },
            "processed": {
              "cell": "G49",
              "value": null
            }
          },
          {
            "row": 50,
            "answer": {
              "cell": "D50",
              "value": "Нет, аналитика строится преимущественно на ad-hoc-выгрузках и ручной обработке"
            },
            "comment": {
              "cell": "E50",
              "value": null
            },
            "mark": {
              "cell": "F50",
              "value": null
            },
            "processed": {
              "cell": "G50",
              "value": null
            }
          },
          {
            "row": 51,
            "answer": {
              "cell": "D51",
              "value": "Нет, промышленные данные недоступны для нашего продукта"
            },
            "comment": {
              "cell": "E51",
              "value": null
            },
            "mark": {
              "cell": "F51",
              "value": null
            },
            "processed": {
              "cell": "G51",
              "value": null
            }
          },
          {
            "row": 52,
            "answer": {
              "cell": "D52",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E52",
              "value": null
            },
            "mark": {
              "cell": "F52",
              "value": null
            },
            "processed": {
              "cell": "G52",
              "value": null
            }
          },
          {
            "row": 53,
            "answer": {
              "cell": "D53",
              "value": "Свой вариант ответа"
            },
            "comment": {
              "cell": "E53",
              "value": null
            },
            "mark": {
              "cell": "F53",
              "value": null
            },
            "processed": {
              "cell": "G53",
              "value": null
            }
          }
        ]
      },
      "otherMechanicuderzhanie_klientov": {
        "question": "Как работает механика удержания клиентов?",
        "selectedOptions": [
          "Создание ценности"
        ],
        "comments": [
          {
            "cell": "E176",
            "value": "Позволяем пользователю решать задачи связанные с аккаунтом Сбер ID, подпиской Прайм и бонусами Спасибо в сервисах экосистемы "
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 176,
            "answer": {
              "cell": "D176",
              "value": "Информационная комуникация"
            },
            "comment": {
              "cell": "E176",
              "value": "Позволяем пользователю решать задачи связанные с аккаунтом Сбер ID, подпиской Прайм и бонусами Спасибо в сервисах экосистемы "
            },
            "mark": {
              "cell": "F176",
              "value": null
            },
            "processed": {
              "cell": "G176",
              "value": null
            }
          },
          {
            "row": 177,
            "answer": {
              "cell": "D177",
              "value": "Создание ценности"
            },
            "comment": {
              "cell": "E177",
              "value": null
            },
            "mark": {
              "cell": "F177",
              "value": 1
            },
            "processed": {
              "cell": "G177",
              "value": 0.5
            }
          },
          {
            "row": 178,
            "answer": {
              "cell": "D178",
              "value": "Что-то еще? Напишите"
            },
            "comment": {
              "cell": "E178",
              "value": null
            },
            "mark": {
              "cell": "F178",
              "value": null
            },
            "processed": {
              "cell": "G178",
              "value": null
            }
          },
          {
            "row": 179,
            "answer": {
              "cell": "D179",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E179",
              "value": null
            },
            "mark": {
              "cell": "F179",
              "value": null
            },
            "processed": {
              "cell": "G179",
              "value": null
            }
          }
        ]
      },
      "otherMechanicvozvrat_klientov": {
        "question": "Как работает механика возврата клиентов?",
        "selectedOptions": [
          "Не релевантно для вашего продукта"
        ],
        "comments": [],
        "links": [],
        "sourceCells": [
          {
            "row": 180,
            "answer": {
              "cell": "D180",
              "value": "Информационная комуникация"
            },
            "comment": {
              "cell": "E180",
              "value": null
            },
            "mark": {
              "cell": "F180",
              "value": null
            },
            "processed": {
              "cell": "G180",
              "value": null
            }
          },
          {
            "row": 181,
            "answer": {
              "cell": "D181",
              "value": "Создание ценности"
            },
            "comment": {
              "cell": "E181",
              "value": null
            },
            "mark": {
              "cell": "F181",
              "value": null
            },
            "processed": {
              "cell": "G181",
              "value": null
            }
          },
          {
            "row": 182,
            "answer": {
              "cell": "D182",
              "value": "Не релевантно для вашего продукта"
            },
            "comment": {
              "cell": "E182",
              "value": null
            },
            "mark": {
              "cell": "F182",
              "value": 1
            },
            "processed": {
              "cell": "G182",
              "value": "Не релевантно для вашего продукта"
            }
          },
          {
            "row": 183,
            "answer": {
              "cell": "D183",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E183",
              "value": null
            },
            "mark": {
              "cell": "F183",
              "value": null
            },
            "processed": {
              "cell": "G183",
              "value": null
            }
          }
        ]
      },
      "channelFlexibleOptions": {
        "question": "Возможно ли изменить набор опций канала без IT-разработки?  ",
        "selectedOptions": [
          "Да, могу изменить набор опций канала"
        ],
        "comments": [
          {
            "cell": "E187",
            "value": "Можно менять состав и содержимое виджетов ЕЛК под каждый сервис экосистемы"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 187,
            "answer": {
              "cell": "D187",
              "value": "Нет, для всех изменений нужна IT разработка"
            },
            "comment": {
              "cell": "E187",
              "value": "Можно менять состав и содержимое виджетов ЕЛК под каждый сервис экосистемы"
            },
            "mark": {
              "cell": "F187",
              "value": null
            },
            "processed": {
              "cell": "G187",
              "value": null
            }
          },
          {
            "row": 188,
            "answer": {
              "cell": "D188",
              "value": "Да, могу изменить набор опций канала"
            },
            "comment": {
              "cell": "E188",
              "value": null
            },
            "mark": {
              "cell": "F188",
              "value": 1
            },
            "processed": {
              "cell": "G188",
              "value": null
            }
          },
          {
            "row": 189,
            "answer": {
              "cell": "D189",
              "value": "Да, могу изменить набор опций с учетом персонализация до клиенстких подсегментов"
            },
            "comment": {
              "cell": "E189",
              "value": null
            },
            "mark": {
              "cell": "F189",
              "value": null
            },
            "processed": {
              "cell": "G189",
              "value": 1
            }
          },
          {
            "row": 190,
            "answer": {
              "cell": "D190",
              "value": "Что-то еще? Напишите"
            },
            "comment": {
              "cell": "E190",
              "value": null
            },
            "mark": {
              "cell": "F190",
              "value": null
            },
            "processed": {
              "cell": "G190",
              "value": null
            }
          },
          {
            "row": 191,
            "answer": {
              "cell": "D191",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E191",
              "value": null
            },
            "mark": {
              "cell": "F191",
              "value": null
            },
            "processed": {
              "cell": "G191",
              "value": null
            }
          }
        ]
      },
      "mechanicsMonitoring": {
        "question": "Опишите метрики, которые вы используете для мониторинга и оценки эффективности работы механики",
        "selectedOptions": [],
        "comments": [
          {
            "cell": "E186",
            "value": "MAU, DAU, CSI"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 186,
            "answer": {
              "cell": "D186",
              "value": "MAU, DAU, CSI"
            },
            "comment": {
              "cell": "E186",
              "value": "MAU, DAU, CSI"
            },
            "mark": {
              "cell": "F186",
              "value": 1
            },
            "processed": {
              "cell": "G186",
              "value": 0.25
            }
          }
        ],
        "text": "MAU, DAU, CSI",
        "textEntries": [
          {
            "cell": "D186",
            "value": "MAU, DAU, CSI"
          }
        ]
      },
      "customNudgingMechanics": {
        "question": "Какие механики настроены по вашему каналу?",
        "selectedOptions": [
          "Стимулирование клиента (геймификация, пуши,Nudging механики)",
          "Nudging механики для виджетов ЕЛК и бейджа (изменение визуала, добавление анимаций)"
        ],
        "comments": [
          {
            "cell": "E165",
            "value": "На данном этапе планируем тестировать механику динамичнеского бейджа"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 160,
            "answer": {
              "cell": "D160",
              "value": "Удержание клиентов"
            },
            "comment": {
              "cell": "E160",
              "value": null
            },
            "mark": {
              "cell": "F160",
              "value": null
            },
            "processed": {
              "cell": "G160",
              "value": null
            }
          },
          {
            "row": 161,
            "answer": {
              "cell": "D161",
              "value": "Возврат клиентов"
            },
            "comment": {
              "cell": "E161",
              "value": null
            },
            "mark": {
              "cell": "F161",
              "value": null
            },
            "processed": {
              "cell": "G161",
              "value": null
            }
          },
          {
            "row": 162,
            "answer": {
              "cell": "D162",
              "value": "Персонализация интерфейса, контента и рекомендаций"
            },
            "comment": {
              "cell": "E162",
              "value": null
            },
            "mark": {
              "cell": "F162",
              "value": null
            },
            "processed": {
              "cell": "G162",
              "value": 0.5
            }
          },
          {
            "row": 163,
            "answer": {
              "cell": "D163",
              "value": "Стимулирование клиента (геймификация, пуши,Nudging механики)"
            },
            "comment": {
              "cell": "E163",
              "value": null
            },
            "mark": {
              "cell": "F163",
              "value": 1
            },
            "processed": {
              "cell": "G163",
              "value": 0.5
            }
          },
          {
            "row": 164,
            "answer": {
              "cell": "D164",
              "value": "Обучающие механики (подсказки, пошаговое знакомство и тд)"
            },
            "comment": {
              "cell": "E164",
              "value": null
            },
            "mark": {
              "cell": "F164",
              "value": null
            },
            "processed": {
              "cell": "G164",
              "value": 0.5
            }
          },
          {
            "row": 165,
            "answer": {
              "cell": "D165",
              "value": "Nudging механики для виджетов ЕЛК и бейджа (изменение визуала, добавление анимаций)"
            },
            "comment": {
              "cell": "E165",
              "value": "На данном этапе планируем тестировать механику динамичнеского бейджа"
            },
            "mark": {
              "cell": "F165",
              "value": 1
            },
            "processed": {
              "cell": "G165",
              "value": null
            }
          },
          {
            "row": 166,
            "answer": {
              "cell": "D166",
              "value": "Механика динамического бейджа для Единого личного кабинета СберID — это персонализированный визуальный элемент (иконка, цифра, текст), который отображается на аватаре или в профиле клиента и меняется в зависимости от его действий, статуса или достижений в экосистеме."
            },
            "comment": {
              "cell": "E166",
              "value": null
            },
            "mark": {
              "cell": "F166",
              "value": null
            },
            "processed": {
              "cell": "G166",
              "value": null
            }
          }
        ]
      }
    },
    "rawAnswers": {
      "20": {
        "question": "Укажите общий объем целевого рынка вашего продукта в России",
        "selectedOptions": [],
        "comments": [
          {
            "cell": "E20",
            "value": "Население России"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 20,
            "answer": {
              "cell": "D20",
              "value": "146 млн"
            },
            "comment": {
              "cell": "E20",
              "value": "Население России"
            },
            "mark": {
              "cell": "F20",
              "value": 1
            },
            "processed": {
              "cell": "G20",
              "value": 0.2
            }
          },
          {
            "row": 21,
            "answer": {
              "cell": "D21",
              "value": "Не релевантно для вашего продукта"
            },
            "comment": {
              "cell": "E21",
              "value": null
            },
            "mark": {
              "cell": "F21",
              "value": null
            },
            "processed": {
              "cell": "G21",
              "value": null
            }
          }
        ],
        "text": "146 млн",
        "textEntries": [
          {
            "cell": "D20",
            "value": "146 млн"
          }
        ]
      },
      "22": {
        "question": "Напишите доступный объем рынка в Сбере, который продукт реально может охватить с учетом текущей бизнес-модели",
        "selectedOptions": [],
        "comments": [
          {
            "cell": "E22",
            "value": "MAU Сбер ID"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 22,
            "answer": {
              "cell": "D22",
              "value": "39,8 млн"
            },
            "comment": {
              "cell": "E22",
              "value": "MAU Сбер ID"
            },
            "mark": {
              "cell": "F22",
              "value": 1
            },
            "processed": {
              "cell": "G22",
              "value": 0.2
            }
          },
          {
            "row": 23,
            "answer": {
              "cell": "D23",
              "value": "Не релевантно для вашего продукта"
            },
            "comment": {
              "cell": "E23",
              "value": null
            },
            "mark": {
              "cell": "F23",
              "value": null
            },
            "processed": {
              "cell": "G23",
              "value": null
            }
          }
        ],
        "text": "39,8 млн",
        "textEntries": [
          {
            "cell": "D22",
            "value": "39,8 млн"
          }
        ]
      },
      "24": {
        "question": "Сколько клиентов банка уже имеет этот продукт?",
        "selectedOptions": [
          "Не релевантно для вашего продукта"
        ],
        "comments": [
          {
            "cell": "E24",
            "value": "Не релевантно, т.к. продукт встроен нативно в сервисы экосистемы и не позиционируется как отдельная сущность"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 24,
            "answer": {
              "cell": "D24",
              "value": null
            },
            "comment": {
              "cell": "E24",
              "value": "Не релевантно, т.к. продукт встроен нативно в сервисы экосистемы и не позиционируется как отдельная сущность"
            },
            "mark": {
              "cell": "F24",
              "value": null
            },
            "processed": {
              "cell": "G24",
              "value": null
            }
          },
          {
            "row": 25,
            "answer": {
              "cell": "D25",
              "value": "Не релевантно для вашего продукта"
            },
            "comment": {
              "cell": "E25",
              "value": null
            },
            "mark": {
              "cell": "F25",
              "value": 1
            },
            "processed": {
              "cell": "G25",
              "value": null
            }
          }
        ]
      },
      "26": {
        "question": "Какое MAU у вашего канала?",
        "selectedOptions": [],
        "comments": [
          {
            "cell": "E26",
            "value": "Факт за Q2"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 26,
            "answer": {
              "cell": "D26",
              "value": "8,4 млн"
            },
            "comment": {
              "cell": "E26",
              "value": "Факт за Q2"
            },
            "mark": {
              "cell": "F26",
              "value": 1
            },
            "processed": {
              "cell": "G26",
              "value": 0.2
            }
          },
          {
            "row": 27,
            "answer": {
              "cell": "D27",
              "value": "Не релевантно для вашего продукта"
            },
            "comment": {
              "cell": "E27",
              "value": null
            },
            "mark": {
              "cell": "F27",
              "value": null
            },
            "processed": {
              "cell": "G27",
              "value": null
            }
          }
        ],
        "text": "8,4 млн",
        "textEntries": [
          {
            "cell": "D26",
            "value": "8,4 млн"
          }
        ]
      },
      "28": {
        "question": "Какое DAU у вашего канала?",
        "selectedOptions": [],
        "comments": [
          {
            "cell": "E28",
            "value": "Факт за Q2"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 28,
            "answer": {
              "cell": "D28",
              "value": "1 млн"
            },
            "comment": {
              "cell": "E28",
              "value": "Факт за Q2"
            },
            "mark": {
              "cell": "F28",
              "value": 1
            },
            "processed": {
              "cell": "G28",
              "value": 0.2
            }
          },
          {
            "row": 29,
            "answer": {
              "cell": "D29",
              "value": "Не релевантно для вашего продукта"
            },
            "comment": {
              "cell": "E29",
              "value": null
            },
            "mark": {
              "cell": "F29",
              "value": null
            },
            "processed": {
              "cell": "G29",
              "value": null
            }
          }
        ],
        "text": "1 млн",
        "textEntries": [
          {
            "cell": "D28",
            "value": "1 млн"
          }
        ]
      },
      "30": {
        "question": "Какое YAU у вашего продукта?",
        "selectedOptions": [
          "Не релевантно для вашего продукта"
        ],
        "comments": [
          {
            "cell": "E30",
            "value": "Не отслеживаем показатель"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 30,
            "answer": {
              "cell": "D30",
              "value": null
            },
            "comment": {
              "cell": "E30",
              "value": "Не отслеживаем показатель"
            },
            "mark": {
              "cell": "F30",
              "value": null
            },
            "processed": {
              "cell": "G30",
              "value": null
            }
          },
          {
            "row": 31,
            "answer": {
              "cell": "D31",
              "value": "Не релевантно для вашего продукта"
            },
            "comment": {
              "cell": "E31",
              "value": null
            },
            "mark": {
              "cell": "F31",
              "value": 1
            },
            "processed": {
              "cell": "G31",
              "value": null
            }
          }
        ]
      },
      "32": {
        "question": "Какое DAU/MAU (липкость) у вашего продукта?",
        "selectedOptions": [],
        "comments": [
          {
            "cell": "E32",
            "value": "Замена YAU на MAU"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 32,
            "answer": {
              "cell": "D32",
              "value": 0.12
            },
            "comment": {
              "cell": "E32",
              "value": "Замена YAU на MAU"
            },
            "mark": {
              "cell": "F32",
              "value": 1
            },
            "processed": {
              "cell": "G32",
              "value": 0.2
            }
          }
        ],
        "text": 0.12,
        "textEntries": [
          {
            "cell": "D32",
            "value": 0.12
          }
        ]
      },
      "34": {
        "question": "Какими инструментами вы пользуетесь для мониторинга метрик из вопросов выше:",
        "selectedOptions": [
          "Дашборд в Навигаторе (доступна часть метрик)"
        ],
        "comments": [
          {
            "cell": "E34",
            "value": "https://navigator.sigma.sbrf.ru/gdash/1000002960"
          }
        ],
        "links": [
          "https://navigator.sigma.sbrf.ru/gdash/1000002960"
        ],
        "sourceCells": [
          {
            "row": 34,
            "answer": {
              "cell": "D34",
              "value": "Дашборд в Навигаторе (доступны все метрики)"
            },
            "comment": {
              "cell": "E34",
              "value": "https://navigator.sigma.sbrf.ru/gdash/1000002960",
              "hyperlink": "https://navigator.sigma.sbrf.ru/gdash/1000002960"
            },
            "mark": {
              "cell": "F34",
              "value": null
            },
            "processed": {
              "cell": "G34",
              "value": 0.5
            }
          },
          {
            "row": 35,
            "answer": {
              "cell": "D35",
              "value": "Дашборд в Навигаторе (доступна часть метрик)"
            },
            "comment": {
              "cell": "E35",
              "value": null
            },
            "mark": {
              "cell": "F35",
              "value": 1
            },
            "processed": {
              "cell": "G35",
              "value": null
            }
          },
          {
            "row": 36,
            "answer": {
              "cell": "D36",
              "value": "Запрашиваете необходимую информацию у аналитиков"
            },
            "comment": {
              "cell": "E36",
              "value": null
            },
            "mark": {
              "cell": "F36",
              "value": null
            },
            "processed": {
              "cell": "G36",
              "value": null
            }
          },
          {
            "row": 37,
            "answer": {
              "cell": "D37",
              "value": "Собственная отчетность продукта (не Навигатор)"
            },
            "comment": {
              "cell": "E37",
              "value": null
            },
            "mark": {
              "cell": "F37",
              "value": null
            },
            "processed": {
              "cell": "G37",
              "value": null
            }
          },
          {
            "row": 38,
            "answer": {
              "cell": "D38",
              "value": "Свой вариант ответа"
            },
            "comment": {
              "cell": "E38",
              "value": null
            },
            "mark": {
              "cell": "F38",
              "value": null
            },
            "processed": {
              "cell": "G38",
              "value": null
            }
          },
          {
            "row": 39,
            "answer": {
              "cell": "D39",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E39",
              "value": null
            },
            "mark": {
              "cell": "F39",
              "value": null
            },
            "processed": {
              "cell": "G39",
              "value": null
            }
          }
        ]
      },
      "40": {
        "question": "Какие инструменты вы используете для проверки качества данных для построения аналитики по вашему продукту?",
        "selectedOptions": [
          "Встроенные дашборды и алерты по качеству данных (ККД) в Навигаторе",
          "Ручная проверка аналитиками (сверка с первичными источниками, выгрузки)",
          "Проверка на стороне источника данных (DWH, витрины) силами data-инженеров"
        ],
        "comments": [
          {
            "cell": "E40",
            "value": "https://navigator.sigma.sbrf.ru/gdash/1000004198"
          }
        ],
        "links": [
          "https://navigator.sigma.sbrf.ru/gdash/1000004198"
        ],
        "sourceCells": [
          {
            "row": 40,
            "answer": {
              "cell": "D40",
              "value": "Встроенные дашборды и алерты по качеству данных (ККД) в Навигаторе"
            },
            "comment": {
              "cell": "E40",
              "value": "https://navigator.sigma.sbrf.ru/gdash/1000004198",
              "hyperlink": "https://navigator.sigma.sbrf.ru/gdash/1000004198"
            },
            "mark": {
              "cell": "F40",
              "value": 1
            },
            "processed": {
              "cell": "G40",
              "value": 0.5
            }
          },
          {
            "row": 41,
            "answer": {
              "cell": "D41",
              "value": "Собственная система мониторинга качества данных"
            },
            "comment": {
              "cell": "E41",
              "value": null
            },
            "mark": {
              "cell": "F41",
              "value": null
            },
            "processed": {
              "cell": "G41",
              "value": null
            }
          },
          {
            "row": 42,
            "answer": {
              "cell": "D42",
              "value": "Ручная проверка аналитиками (сверка с первичными источниками, выгрузки)"
            },
            "comment": {
              "cell": "E42",
              "value": null
            },
            "mark": {
              "cell": "F42",
              "value": 1
            },
            "processed": {
              "cell": "G42",
              "value": null
            }
          },
          {
            "row": 43,
            "answer": {
              "cell": "D43",
              "value": "Проверка на стороне источника данных (DWH, витрины) силами data-инженеров"
            },
            "comment": {
              "cell": "E43",
              "value": null
            },
            "mark": {
              "cell": "F43",
              "value": 1
            },
            "processed": {
              "cell": "G43",
              "value": null
            }
          },
          {
            "row": 44,
            "answer": {
              "cell": "D44",
              "value": "Не используем специальные инструменты — доверяем источнику"
            },
            "comment": {
              "cell": "E44",
              "value": null
            },
            "mark": {
              "cell": "F44",
              "value": null
            },
            "processed": {
              "cell": "G44",
              "value": null
            }
          },
          {
            "row": 45,
            "answer": {
              "cell": "D45",
              "value": "Свой вариант ответа"
            },
            "comment": {
              "cell": "E45",
              "value": null
            },
            "mark": {
              "cell": "F45",
              "value": null
            },
            "processed": {
              "cell": "G45",
              "value": null
            }
          },
          {
            "row": 46,
            "answer": {
              "cell": "D46",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E46",
              "value": null
            },
            "mark": {
              "cell": "F46",
              "value": "ДЕШ по ККД пустой"
            },
            "processed": {
              "cell": "G46",
              "value": null
            }
          }
        ]
      },
      "47": {
        "question": "Используете ли вы промышленные данные для аналитики по вашему продукту?",
        "selectedOptions": [
          "Да, большая часть метрик — на промышленных данных, но часть ещё требует ручной обработки"
        ],
        "comments": [
          {
            "cell": "E48",
            "value": "Данные по микросервисам, которыми владеет ЕЛК или другие смежные команда банка (Прайм, Лояльность, Сбер ID) - получаем из промышленного контура. Данные по микросервисам, которыми владеют ДЗО - через отдельный запрос в ДЗО."
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 47,
            "answer": {
              "cell": "D47",
              "value": "Да, все ключевые метрики строятся на основе промышленных данных (витрины, DWH, автоматизированные пайплайны)"
            },
            "comment": {
              "cell": "E47",
              "value": null
            },
            "mark": {
              "cell": "F47",
              "value": null
            },
            "processed": {
              "cell": "G47",
              "value": 0.5
            }
          },
          {
            "row": 48,
            "answer": {
              "cell": "D48",
              "value": "Да, большая часть метрик — на промышленных данных, но часть ещё требует ручной обработки"
            },
            "comment": {
              "cell": "E48",
              "value": "Данные по микросервисам, которыми владеет ЕЛК или другие смежные команда банка (Прайм, Лояльность, Сбер ID) - получаем из промышленного контура. Данные по микросервисам, которыми владеют ДЗО - через отдельный запрос в ДЗО."
            },
            "mark": {
              "cell": "F48",
              "value": 1
            },
            "processed": {
              "cell": "G48",
              "value": null
            }
          },
          {
            "row": 49,
            "answer": {
              "cell": "D49",
              "value": "Частично: промышленные данные есть, но мы чаще используем ad-hoc-выгрузки и ручную обработку"
            },
            "comment": {
              "cell": "E49",
              "value": null
            },
            "mark": {
              "cell": "F49",
              "value": null
            },
            "processed": {
              "cell": "G49",
              "value": null
            }
          },
          {
            "row": 50,
            "answer": {
              "cell": "D50",
              "value": "Нет, аналитика строится преимущественно на ad-hoc-выгрузках и ручной обработке"
            },
            "comment": {
              "cell": "E50",
              "value": null
            },
            "mark": {
              "cell": "F50",
              "value": null
            },
            "processed": {
              "cell": "G50",
              "value": null
            }
          },
          {
            "row": 51,
            "answer": {
              "cell": "D51",
              "value": "Нет, промышленные данные недоступны для нашего продукта"
            },
            "comment": {
              "cell": "E51",
              "value": null
            },
            "mark": {
              "cell": "F51",
              "value": null
            },
            "processed": {
              "cell": "G51",
              "value": null
            }
          },
          {
            "row": 52,
            "answer": {
              "cell": "D52",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E52",
              "value": null
            },
            "mark": {
              "cell": "F52",
              "value": null
            },
            "processed": {
              "cell": "G52",
              "value": null
            }
          },
          {
            "row": 53,
            "answer": {
              "cell": "D53",
              "value": "Свой вариант ответа"
            },
            "comment": {
              "cell": "E53",
              "value": null
            },
            "mark": {
              "cell": "F53",
              "value": null
            },
            "processed": {
              "cell": "G53",
              "value": null
            }
          }
        ]
      },
      "54": {
        "question": "Отчетность по целям/драйверам/прогнозам продукта уровня ЛЮ-ЛТ выведена на мониторинг и доступна владельцу продукта",
        "selectedOptions": [
          "Цели",
          "Факторный анализ (драйверы 1-2 уровня согласно модели БП)"
        ],
        "comments": [
          {
            "cell": "E54",
            "value": "Цели на уровне ЛТ:\n- Создать Единый личный кабинет (ЕЛК), который помогает клиенту легко находить и использовать преимущества экосистемы Сбера"
          },
          {
            "cell": "E55",
            "value": "Ключевые показатели: MAU, кол-во сервисов с ЕЛК, CX ревью, CSI\n"
          },
          {
            "cell": "E56",
            "value": "Выполнение плановых показателей ключевых результатов"
          },
          {
            "cell": "E57",
            "value": "MAU - 7,8 млн\nКол-во сервисов с ЕЛК - 18\nСХ ревью - 60%\nCSI - 4,22"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 54,
            "answer": {
              "cell": "D54",
              "value": "Цели"
            },
            "comment": {
              "cell": "E54",
              "value": "Цели на уровне ЛТ:\n- Создать Единый личный кабинет (ЕЛК), который помогает клиенту легко находить и использовать преимущества экосистемы Сбера"
            },
            "mark": {
              "cell": "F54",
              "value": 1
            },
            "processed": {
              "cell": "G54",
              "value": 1
            }
          },
          {
            "row": 55,
            "answer": {
              "cell": "D55",
              "value": "Факторный анализ (драйверы 1-2 уровня согласно модели БП)"
            },
            "comment": {
              "cell": "E55",
              "value": "Ключевые показатели: MAU, кол-во сервисов с ЕЛК, CX ревью, CSI\n"
            },
            "mark": {
              "cell": "F55",
              "value": 1
            },
            "processed": {
              "cell": "G55",
              "value": 1
            }
          },
          {
            "row": 56,
            "answer": {
              "cell": "D56",
              "value": "Прогноз по целям"
            },
            "comment": {
              "cell": "E56",
              "value": "Выполнение плановых показателей ключевых результатов"
            },
            "mark": {
              "cell": "F56",
              "value": null
            },
            "processed": {
              "cell": "G56",
              "value": 1
            }
          },
          {
            "row": 57,
            "answer": {
              "cell": "D57",
              "value": "Прогноз по драйверам"
            },
            "comment": {
              "cell": "E57",
              "value": "MAU - 7,8 млн\nКол-во сервисов с ЕЛК - 18\nСХ ревью - 60%\nCSI - 4,22"
            },
            "mark": {
              "cell": "F57",
              "value": null
            },
            "processed": {
              "cell": "G57",
              "value": null
            }
          }
        ]
      },
      "58": {
        "question": "Настроена ли регулярная отчётность по воронке использования?",
        "selectedOptions": [
          "Да"
        ],
        "comments": [
          {
            "cell": "E58",
            "value": "Да, в Навигаторе:\nhttps://navigator.sigma.sbrf.ru/gdash/1000002960"
          }
        ],
        "links": [
          "https://navigator.sigma.sbrf.ru/gdash/1000002960"
        ],
        "sourceCells": [
          {
            "row": 58,
            "answer": {
              "cell": "D58",
              "value": "Да "
            },
            "comment": {
              "cell": "E58",
              "value": "Да, в Навигаторе:\nhttps://navigator.sigma.sbrf.ru/gdash/1000002960"
            },
            "mark": {
              "cell": "F58",
              "value": 1
            },
            "processed": {
              "cell": "G58",
              "value": 0.5
            }
          },
          {
            "row": 59,
            "answer": {
              "cell": "D59",
              "value": "Нет"
            },
            "comment": {
              "cell": "E59",
              "value": null
            },
            "mark": {
              "cell": "F59",
              "value": null
            },
            "processed": {
              "cell": "G59",
              "value": null
            }
          },
          {
            "row": 60,
            "answer": {
              "cell": "D60",
              "value": "Не релевантно для моего канала"
            },
            "comment": {
              "cell": "E60",
              "value": null
            },
            "mark": {
              "cell": "F60",
              "value": null
            },
            "processed": {
              "cell": "G60",
              "value": null
            }
          },
          {
            "row": 61,
            "answer": {
              "cell": "D61",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E61",
              "value": null
            },
            "mark": {
              "cell": "F61",
              "value": null
            },
            "processed": {
              "cell": "G61",
              "value": null
            }
          }
        ]
      },
      "62": {
        "question": "Что включает воронка использования?",
        "selectedOptions": [
          "CR и CTR"
        ],
        "comments": [
          {
            "cell": "E62",
            "value": "Разрезы по сервисам, на которых размещен ЕЛК, CR/CTR виджетов Прайм, Спасибо"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 62,
            "answer": {
              "cell": "D62",
              "value": "Каналы привлечения"
            },
            "comment": {
              "cell": "E62",
              "value": "Разрезы по сервисам, на которых размещен ЕЛК, CR/CTR виджетов Прайм, Спасибо"
            },
            "mark": {
              "cell": "F62",
              "value": null
            },
            "processed": {
              "cell": "G62",
              "value": 0.5
            }
          },
          {
            "row": 63,
            "answer": {
              "cell": "D63",
              "value": "Пошаговая воронка "
            },
            "comment": {
              "cell": "E63",
              "value": null
            },
            "mark": {
              "cell": "F63",
              "value": null
            },
            "processed": {
              "cell": "G63",
              "value": null
            }
          },
          {
            "row": 64,
            "answer": {
              "cell": "D64",
              "value": "CR и CTR"
            },
            "comment": {
              "cell": "E64",
              "value": null
            },
            "mark": {
              "cell": "F64",
              "value": 1
            },
            "processed": {
              "cell": "G64",
              "value": null
            }
          },
          {
            "row": 65,
            "answer": {
              "cell": "D65",
              "value": "Объёмы коммуникаций"
            },
            "comment": {
              "cell": "E65",
              "value": null
            },
            "mark": {
              "cell": "F65",
              "value": null
            },
            "processed": {
              "cell": "G65",
              "value": null
            }
          },
          {
            "row": 66,
            "answer": {
              "cell": "D66",
              "value": "Количество целевых действий"
            },
            "comment": {
              "cell": "E66",
              "value": null
            },
            "mark": {
              "cell": "F66",
              "value": null
            },
            "processed": {
              "cell": "G66",
              "value": null
            }
          },
          {
            "row": 67,
            "answer": {
              "cell": "D67",
              "value": "Сегментный/ кагортный разрез"
            },
            "comment": {
              "cell": "E67",
              "value": null
            },
            "mark": {
              "cell": "F67",
              "value": null
            },
            "processed": {
              "cell": "G67",
              "value": null
            }
          },
          {
            "row": 68,
            "answer": {
              "cell": "D68",
              "value": "UX/UI-дизайн"
            },
            "comment": {
              "cell": "E68",
              "value": null
            },
            "mark": {
              "cell": "F68",
              "value": null
            },
            "processed": {
              "cell": "G68",
              "value": null
            }
          },
          {
            "row": 69,
            "answer": {
              "cell": "D69",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E69",
              "value": null
            },
            "mark": {
              "cell": "F69",
              "value": null
            },
            "processed": {
              "cell": "G69",
              "value": null
            }
          }
        ]
      },
      "70": {
        "question": "Какая регулярность обновления отчета по воронке по каналам использования?",
        "selectedOptions": [
          "Автоматически (daily или weekly)"
        ],
        "comments": [
          {
            "cell": "E70",
            "value": "С помощью дашбордда в навигаторе:\nhttps://navigator.sigma.sbrf.ru/gdash/1000002960"
          }
        ],
        "links": [
          "https://navigator.sigma.sbrf.ru/gdash/1000002960"
        ],
        "sourceCells": [
          {
            "row": 70,
            "answer": {
              "cell": "D70",
              "value": "Автоматически (daily или weekly)"
            },
            "comment": {
              "cell": "E70",
              "value": "С помощью дашбордда в навигаторе:\nhttps://navigator.sigma.sbrf.ru/gdash/1000002960"
            },
            "mark": {
              "cell": "F70",
              "value": 1
            },
            "processed": {
              "cell": "G70",
              "value": null
            }
          },
          {
            "row": 71,
            "answer": {
              "cell": "D71",
              "value": "По запросу"
            },
            "comment": {
              "cell": "E71",
              "value": null
            },
            "mark": {
              "cell": "F71",
              "value": null
            },
            "processed": {
              "cell": "G71",
              "value": null
            }
          },
          {
            "row": 72,
            "answer": {
              "cell": "D72",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E72",
              "value": null
            },
            "mark": {
              "cell": "F72",
              "value": null
            },
            "processed": {
              "cell": "G72",
              "value": null
            }
          },
          {
            "row": 73,
            "answer": {
              "cell": "D73",
              "value": "Приложите ссылку на отчет воронки привлечения"
            },
            "comment": {
              "cell": "E73",
              "value": null
            },
            "mark": {
              "cell": "F73",
              "value": null
            },
            "processed": {
              "cell": "G73",
              "value": null
            }
          }
        ],
        "textEntries": [
          {
            "cell": "D73",
            "value": "Приложите ссылку на отчет воронки привлечения"
          }
        ]
      },
      "74": {
        "question": "Настроена ли регулярная отчётность по воронке привлечения?",
        "selectedOptions": [],
        "comments": [],
        "links": [],
        "sourceCells": []
      },
      "78": {
        "question": "Что включает воронка привлечения?",
        "selectedOptions": [],
        "comments": [],
        "links": [],
        "sourceCells": []
      },
      "86": {
        "question": "Какая регулярность обновления отчета по воронке привлечения?",
        "selectedOptions": [],
        "comments": [],
        "links": [],
        "sourceCells": []
      },
      "89": {
        "question": "Приложите ссылку на отчет воронки привлечения",
        "selectedOptions": [],
        "comments": [],
        "links": [],
        "sourceCells": []
      },
      "90": {
        "question": "Настроена ли регулярная отчётность по воронке оттока (анализа снижения активности в канале)?",
        "selectedOptions": [
          "Да"
        ],
        "comments": [
          {
            "cell": "E90",
            "value": "Отслеживаем динамику DAU/MAU ЕЛК с помощью дашборда в навигаторе"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 90,
            "answer": {
              "cell": "D90",
              "value": "Да"
            },
            "comment": {
              "cell": "E90",
              "value": "Отслеживаем динамику DAU/MAU ЕЛК с помощью дашборда в навигаторе"
            },
            "mark": {
              "cell": "F90",
              "value": 1
            },
            "processed": {
              "cell": "G90",
              "value": 0.5
            }
          },
          {
            "row": 91,
            "answer": {
              "cell": "D91",
              "value": "Нет"
            },
            "comment": {
              "cell": "E91",
              "value": null
            },
            "mark": {
              "cell": "F91",
              "value": null
            },
            "processed": {
              "cell": "G91",
              "value": null
            }
          },
          {
            "row": 92,
            "answer": {
              "cell": "D92",
              "value": "Не релевантно для моего канала"
            },
            "comment": {
              "cell": "E92",
              "value": null
            },
            "mark": {
              "cell": "F92",
              "value": null
            },
            "processed": {
              "cell": "G92",
              "value": null
            }
          },
          {
            "row": 93,
            "answer": {
              "cell": "D93",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E93",
              "value": null
            },
            "mark": {
              "cell": "F93",
              "value": null
            },
            "processed": {
              "cell": "G93",
              "value": null
            }
          }
        ]
      },
      "94": {
        "question": "Что включает воронка оттока (анализа снижения активности в канале)?",
        "selectedOptions": [
          "Механики удержания",
          "% оттока"
        ],
        "comments": [
          {
            "cell": "E94",
            "value": "Отток из подписки Прайм через ЕЛК\n% удержанных пользователей в Прайм с помощью ЕЛК\nОтток по DAU/MAU ЕЛК и CR виджетов"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 94,
            "answer": {
              "cell": "D94",
              "value": null
            },
            "comment": {
              "cell": "E94",
              "value": "Отток из подписки Прайм через ЕЛК\n% удержанных пользователей в Прайм с помощью ЕЛК\nОтток по DAU/MAU ЕЛК и CR виджетов"
            },
            "mark": {
              "cell": "F94",
              "value": null
            },
            "processed": {
              "cell": "G94",
              "value": 0.5
            }
          },
          {
            "row": 95,
            "answer": {
              "cell": "D95",
              "value": "Сегментный/когортный разрез"
            },
            "comment": {
              "cell": "E95",
              "value": null
            },
            "mark": {
              "cell": "F95",
              "value": null
            },
            "processed": {
              "cell": "G95",
              "value": null
            }
          },
          {
            "row": 96,
            "answer": {
              "cell": "D96",
              "value": "Когортный retention"
            },
            "comment": {
              "cell": "E96",
              "value": null
            },
            "mark": {
              "cell": "F96",
              "value": null
            },
            "processed": {
              "cell": "G96",
              "value": null
            }
          },
          {
            "row": 97,
            "answer": {
              "cell": "D97",
              "value": "Механики удержания"
            },
            "comment": {
              "cell": "E97",
              "value": null
            },
            "mark": {
              "cell": "F97",
              "value": 1
            },
            "processed": {
              "cell": "G97",
              "value": null
            }
          },
          {
            "row": 98,
            "answer": {
              "cell": "D98",
              "value": "% оттока"
            },
            "comment": {
              "cell": "E98",
              "value": null
            },
            "mark": {
              "cell": "F98",
              "value": 1
            },
            "processed": {
              "cell": "G98",
              "value": null
            }
          },
          {
            "row": 99,
            "answer": {
              "cell": "D99",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E99",
              "value": null
            },
            "mark": {
              "cell": "F99",
              "value": null
            },
            "processed": {
              "cell": "G99",
              "value": null
            }
          }
        ]
      },
      "102": {
        "question": "Какая регулярность обновления отчета по воронке оттока (анализа снижения активности в канале)?",
        "selectedOptions": [
          "Автоматически (daily или weekly)"
        ],
        "comments": [
          {
            "cell": "E102",
            "value": "С помощью дашбордда в навигаторе:\nhttps://navigator.sigma.sbrf.ru/gdash/1000002960"
          }
        ],
        "links": [
          "https://navigator.sigma.sbrf.ru/gdash/1000002960"
        ],
        "sourceCells": [
          {
            "row": 102,
            "answer": {
              "cell": "D102",
              "value": "Автоматически (daily или weekly)"
            },
            "comment": {
              "cell": "E102",
              "value": "С помощью дашбордда в навигаторе:\nhttps://navigator.sigma.sbrf.ru/gdash/1000002960"
            },
            "mark": {
              "cell": "F102",
              "value": 1
            },
            "processed": {
              "cell": "G102",
              "value": null
            }
          },
          {
            "row": 103,
            "answer": {
              "cell": "D103",
              "value": "По запросу"
            },
            "comment": {
              "cell": "E103",
              "value": null
            },
            "mark": {
              "cell": "F103",
              "value": null
            },
            "processed": {
              "cell": "G103",
              "value": null
            }
          },
          {
            "row": 104,
            "answer": {
              "cell": "D104",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E104",
              "value": null
            },
            "mark": {
              "cell": "F104",
              "value": null
            },
            "processed": {
              "cell": "G104",
              "value": null
            }
          },
          {
            "row": 105,
            "answer": {
              "cell": "D105",
              "value": "Приложите ссылку на отчет воронки оттока (анализа снижения активности в канале)?"
            },
            "comment": {
              "cell": "E105",
              "value": null
            },
            "mark": {
              "cell": "F105",
              "value": null
            },
            "processed": {
              "cell": "G105",
              "value": null
            }
          }
        ],
        "textEntries": [
          {
            "cell": "D105",
            "value": "Приложите ссылку на отчет воронки оттока (анализа снижения активности в канале)?"
          }
        ]
      },
      "106": {
        "question": "Есть ли бенчмарки по метрикам воронок оттока и привлечения?",
        "selectedOptions": [
          "Нет"
        ],
        "comments": [],
        "links": [],
        "sourceCells": [
          {
            "row": 106,
            "answer": {
              "cell": "D106",
              "value": "Да"
            },
            "comment": {
              "cell": "E106",
              "value": null
            },
            "mark": {
              "cell": "F106",
              "value": null
            },
            "processed": {
              "cell": "G106",
              "value": 1
            }
          },
          {
            "row": 107,
            "answer": {
              "cell": "D107",
              "value": "Нет"
            },
            "comment": {
              "cell": "E107",
              "value": null
            },
            "mark": {
              "cell": "F107",
              "value": 1
            },
            "processed": {
              "cell": "G107",
              "value": null
            }
          },
          {
            "row": 108,
            "answer": {
              "cell": "D108",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E108",
              "value": null
            },
            "mark": {
              "cell": "F108",
              "value": null
            },
            "processed": {
              "cell": "G108",
              "value": null
            }
          }
        ]
      },
      "109": {
        "question": "Опишите, какие бенчмарки используются",
        "selectedOptions": [],
        "comments": [
          {
            "cell": "E109",
            "value": "Не используем"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 109,
            "answer": {
              "cell": "D109",
              "value": null
            },
            "comment": {
              "cell": "E109",
              "value": "Не используем"
            },
            "mark": {
              "cell": "F109",
              "value": null
            },
            "processed": {
              "cell": "G109",
              "value": null
            }
          }
        ]
      },
      "110": {
        "question": "Проводился ли за последний квартал анализ воронки привлечения?",
        "selectedOptions": [],
        "comments": [],
        "links": [],
        "sourceCells": []
      },
      "117": {
        "question": "Есть ли задачи/мероприятия по работе с отклонениями по воронке привлечения?",
        "selectedOptions": [],
        "comments": [],
        "links": [],
        "sourceCells": []
      },
      "120": {
        "question": "Проводился ли за последний квартал анализ воронки использования?",
        "selectedOptions": [
          "A/B тесты",
          "UX/UI воронки целевых действий"
        ],
        "comments": [
          {
            "cell": "E120",
            "value": "Проводили:\n- АБ тесты бейджа\n- UX/UI кабинетное исследование клиентского пути пульзователя от главной спервиса до витрины Выгод"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 120,
            "answer": {
              "cell": "D120",
              "value": "Сравнение с конкурентами процесса оформления продукта, условий продукта или мониторинг новых фичей"
            },
            "comment": {
              "cell": "E120",
              "value": "Проводили:\n- АБ тесты бейджа\n- UX/UI кабинетное исследование клиентского пути пульзователя от главной спервиса до витрины Выгод"
            },
            "mark": {
              "cell": "F120",
              "value": null
            },
            "processed": {
              "cell": "G120",
              "value": 1
            }
          },
          {
            "row": 121,
            "answer": {
              "cell": "D121",
              "value": "По кампаниям продаж: воронка внутри кампаний, количество достигших целевого действия, оценка результативности компаний"
            },
            "comment": {
              "cell": "E121",
              "value": null
            },
            "mark": {
              "cell": "F121",
              "value": null
            },
            "processed": {
              "cell": "G121",
              "value": null
            }
          },
          {
            "row": 122,
            "answer": {
              "cell": "D122",
              "value": "A/B тесты"
            },
            "comment": {
              "cell": "E122",
              "value": null
            },
            "mark": {
              "cell": "F122",
              "value": 1
            },
            "processed": {
              "cell": "G122",
              "value": null
            }
          },
          {
            "row": 123,
            "answer": {
              "cell": "D123",
              "value": "Сегментный/Когортный анализ"
            },
            "comment": {
              "cell": "E123",
              "value": null
            },
            "mark": {
              "cell": "F123",
              "value": null
            },
            "processed": {
              "cell": "G123",
              "value": null
            }
          },
          {
            "row": 124,
            "answer": {
              "cell": "D124",
              "value": "UX/UI воронки целевых действий"
            },
            "comment": {
              "cell": "E124",
              "value": null
            },
            "mark": {
              "cell": "F124",
              "value": 1
            },
            "processed": {
              "cell": "G124",
              "value": null
            }
          },
          {
            "row": 125,
            "answer": {
              "cell": "D125",
              "value": "Что-то еще? Напишите"
            },
            "comment": {
              "cell": "E125",
              "value": null
            },
            "mark": {
              "cell": "F125",
              "value": null
            },
            "processed": {
              "cell": "G125",
              "value": null
            }
          },
          {
            "row": 126,
            "answer": {
              "cell": "D126",
              "value": "Все перечисленное выше"
            },
            "comment": {
              "cell": "E126",
              "value": null
            },
            "mark": {
              "cell": "F126",
              "value": null
            },
            "processed": {
              "cell": "G126",
              "value": null
            }
          },
          {
            "row": 127,
            "answer": {
              "cell": "D127",
              "value": "Не проводился"
            },
            "comment": {
              "cell": "E127",
              "value": null
            },
            "mark": {
              "cell": "F127",
              "value": null
            },
            "processed": {
              "cell": "G127",
              "value": null
            }
          },
          {
            "row": 128,
            "answer": {
              "cell": "D128",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E128",
              "value": null
            },
            "mark": {
              "cell": "F128",
              "value": null
            },
            "processed": {
              "cell": "G128",
              "value": null
            }
          }
        ]
      },
      "129": {
        "question": "Составлен ли перечень задач/мероприятий по работе с отклонениями по воронке привлечения?",
        "selectedOptions": [
          "Да"
        ],
        "comments": [
          {
            "cell": "E129",
            "value": "Тираж виджетов и дин бейджа на 20 партнеров до конца года"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 129,
            "answer": {
              "cell": "D129",
              "value": "Да"
            },
            "comment": {
              "cell": "E129",
              "value": "Тираж виджетов и дин бейджа на 20 партнеров до конца года"
            },
            "mark": {
              "cell": "F129",
              "value": 1
            },
            "processed": {
              "cell": "G129",
              "value": 1
            }
          },
          {
            "row": 130,
            "answer": {
              "cell": "D130",
              "value": "Нет"
            },
            "comment": {
              "cell": "E130",
              "value": null
            },
            "mark": {
              "cell": "F130",
              "value": null
            },
            "processed": {
              "cell": "G130",
              "value": null
            }
          },
          {
            "row": 131,
            "answer": {
              "cell": "D131",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E131",
              "value": null
            },
            "mark": {
              "cell": "F131",
              "value": null
            },
            "processed": {
              "cell": "G131",
              "value": null
            }
          },
          {
            "row": 132,
            "answer": {
              "cell": "D132",
              "value": "Приведите пример задачи/мероприятия за последний квартал"
            },
            "comment": {
              "cell": "E132",
              "value": null
            },
            "mark": {
              "cell": "F132",
              "value": null
            },
            "processed": {
              "cell": "G132",
              "value": null
            }
          }
        ],
        "textEntries": [
          {
            "cell": "D132",
            "value": "Приведите пример задачи/мероприятия за последний квартал"
          }
        ]
      },
      "133": {
        "question": "Проводился ли за последний квартал анализ воронки оттока (снижения активности в канале)?",
        "selectedOptions": [
          "Не проводился"
        ],
        "comments": [],
        "links": [],
        "sourceCells": [
          {
            "row": 133,
            "answer": {
              "cell": "D133",
              "value": "Анализ процесса использования канала: количество проведенного времени, количество просмотренных страниц, отзывы"
            },
            "comment": {
              "cell": "E133",
              "value": null
            },
            "mark": {
              "cell": "F133",
              "value": null
            },
            "processed": {
              "cell": "G133",
              "value": null
            }
          },
          {
            "row": 134,
            "answer": {
              "cell": "D134",
              "value": "Выявление ключевых точек потери клиентов - составлен ТОР 3 фактора и причины"
            },
            "comment": {
              "cell": "E134",
              "value": null
            },
            "mark": {
              "cell": "F134",
              "value": null
            },
            "processed": {
              "cell": "G134",
              "value": null
            }
          },
          {
            "row": 135,
            "answer": {
              "cell": "D135",
              "value": "Сегментный/когортный анализ"
            },
            "comment": {
              "cell": "E135",
              "value": null
            },
            "mark": {
              "cell": "F135",
              "value": null
            },
            "processed": {
              "cell": "G135",
              "value": null
            }
          },
          {
            "row": 136,
            "answer": {
              "cell": "D136",
              "value": "A/B тесты"
            },
            "comment": {
              "cell": "E136",
              "value": null
            },
            "mark": {
              "cell": "F136",
              "value": null
            },
            "processed": {
              "cell": "G136",
              "value": null
            }
          },
          {
            "row": 137,
            "answer": {
              "cell": "D137",
              "value": "Что-то еще? Напишите"
            },
            "comment": {
              "cell": "E137",
              "value": null
            },
            "mark": {
              "cell": "F137",
              "value": null
            },
            "processed": {
              "cell": "G137",
              "value": null
            }
          },
          {
            "row": 138,
            "answer": {
              "cell": "D138",
              "value": "Все перечисленное выше"
            },
            "comment": {
              "cell": "E138",
              "value": null
            },
            "mark": {
              "cell": "F138",
              "value": null
            },
            "processed": {
              "cell": "G138",
              "value": null
            }
          },
          {
            "row": 139,
            "answer": {
              "cell": "D139",
              "value": "Не проводился"
            },
            "comment": {
              "cell": "E139",
              "value": null
            },
            "mark": {
              "cell": "F139",
              "value": 1
            },
            "processed": {
              "cell": "G139",
              "value": "Не проводился"
            }
          },
          {
            "row": 140,
            "answer": {
              "cell": "D140",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E140",
              "value": null
            },
            "mark": {
              "cell": "F140",
              "value": null
            },
            "processed": {
              "cell": "G140",
              "value": null
            }
          }
        ]
      },
      "141": {
        "question": "Есть ли задачи/мероприятия по работе с отклонениями по воронке оттока (анализа снижения активности в канале)?\n",
        "selectedOptions": [
          "Нет"
        ],
        "comments": [],
        "links": [],
        "sourceCells": [
          {
            "row": 141,
            "answer": {
              "cell": "D141",
              "value": "Да"
            },
            "comment": {
              "cell": "E141",
              "value": null
            },
            "mark": {
              "cell": "F141",
              "value": null
            },
            "processed": {
              "cell": "G141",
              "value": null
            }
          },
          {
            "row": 142,
            "answer": {
              "cell": "D142",
              "value": "Нет"
            },
            "comment": {
              "cell": "E142",
              "value": null
            },
            "mark": {
              "cell": "F142",
              "value": 1
            },
            "processed": {
              "cell": "G142",
              "value": null
            }
          },
          {
            "row": 143,
            "answer": {
              "cell": "D143",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E143",
              "value": null
            },
            "mark": {
              "cell": "F143",
              "value": null
            },
            "processed": {
              "cell": "G143",
              "value": null
            }
          },
          {
            "row": 144,
            "answer": {
              "cell": "D144",
              "value": "Приведите пример задачи/мероприятия за последний квартал"
            },
            "comment": {
              "cell": "E144",
              "value": null
            },
            "mark": {
              "cell": "F144",
              "value": null
            },
            "processed": {
              "cell": "G144",
              "value": null
            }
          }
        ],
        "textEntries": [
          {
            "cell": "D144",
            "value": "Приведите пример задачи/мероприятия за последний квартал"
          }
        ]
      },
      "145": {
        "question": "Какие показатели включает в себя анализ воронки? (Если ответ на вопрос \"Какие типы воронок вы отслеживаете?\" был \"Что-то еще? Напишите\")",
        "selectedOptions": [
          "Воронка целевых действий - DAU, MAU, CR/CTR виджетов в разрезе сервисов"
        ],
        "comments": [],
        "links": [],
        "sourceCells": [
          {
            "row": 145,
            "answer": {
              "cell": "D145",
              "value": "Воронка целевых действий - DAU, MAU, CR/CTR виджетов в разрезе сервисов"
            },
            "comment": {
              "cell": "E145",
              "value": null
            },
            "mark": {
              "cell": "F145",
              "value": 1
            },
            "processed": {
              "cell": "G145",
              "value": null
            }
          }
        ]
      },
      "146": {
        "question": "Есть ли задачи/мероприятия по работе с отклонениями? (Если ответ на вопрос \"Какие типы воронок вы отслеживаете?\" был \"Что-то еще? Напишите\")",
        "selectedOptions": [
          "Отклонение в CSI"
        ],
        "comments": [
          {
            "cell": "E146",
            "value": "Исследование причин отклонения CSI, формирование списка продуктовых улучшений "
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 146,
            "answer": {
              "cell": "D146",
              "value": "Отклонение в CSI"
            },
            "comment": {
              "cell": "E146",
              "value": "Исследование причин отклонения CSI, формирование списка продуктовых улучшений "
            },
            "mark": {
              "cell": "F146",
              "value": 1
            },
            "processed": {
              "cell": "G146",
              "value": null
            }
          },
          {
            "row": 147,
            "answer": {
              "cell": "D147",
              "value": "Приведите пример задачи/мероприятия за последний квартал"
            },
            "comment": {
              "cell": "E147",
              "value": null
            },
            "mark": {
              "cell": "F147",
              "value": null
            },
            "processed": {
              "cell": "G147",
              "value": null
            }
          }
        ],
        "textEntries": [
          {
            "cell": "D147",
            "value": "Приведите пример задачи/мероприятия за последний квартал"
          }
        ]
      },
      "148": {
        "question": "Настроены ли автоматические оповещения по системным сбоям?",
        "selectedOptions": [
          "Да"
        ],
        "comments": [
          {
            "cell": "E148",
            "value": "Мониторятся работа сервисов в Grafana службой сопровождения"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 148,
            "answer": {
              "cell": "D148",
              "value": "Да"
            },
            "comment": {
              "cell": "E148",
              "value": "Мониторятся работа сервисов в Grafana службой сопровождения"
            },
            "mark": {
              "cell": "F148",
              "value": 1
            },
            "processed": {
              "cell": "G148",
              "value": 1
            }
          },
          {
            "row": 149,
            "answer": {
              "cell": "D149",
              "value": "Частично"
            },
            "comment": {
              "cell": "E149",
              "value": null
            },
            "mark": {
              "cell": "F149",
              "value": null
            },
            "processed": {
              "cell": "G149",
              "value": null
            }
          },
          {
            "row": 150,
            "answer": {
              "cell": "D150",
              "value": "Нет"
            },
            "comment": {
              "cell": "E150",
              "value": null
            },
            "mark": {
              "cell": "F150",
              "value": null
            },
            "processed": {
              "cell": "G150",
              "value": null
            }
          },
          {
            "row": 151,
            "answer": {
              "cell": "D151",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E151",
              "value": null
            },
            "mark": {
              "cell": "F151",
              "value": null
            },
            "processed": {
              "cell": "G151",
              "value": null
            }
          }
        ]
      },
      "152": {
        "question": "Настроены ли автоматические оповещения по проблемам, связанным с UX и пользовательскому опыту?  ",
        "selectedOptions": [
          "Частично"
        ],
        "comments": [
          {
            "cell": "E152",
            "value": "Настроены оповещения на основные сервисы продукты"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 152,
            "answer": {
              "cell": "D152",
              "value": "Да"
            },
            "comment": {
              "cell": "E152",
              "value": "Настроены оповещения на основные сервисы продукты"
            },
            "mark": {
              "cell": "F152",
              "value": null
            },
            "processed": {
              "cell": "G152",
              "value": 1
            }
          },
          {
            "row": 153,
            "answer": {
              "cell": "D153",
              "value": "Частично"
            },
            "comment": {
              "cell": "E153",
              "value": null
            },
            "mark": {
              "cell": "F153",
              "value": 1
            },
            "processed": {
              "cell": "G153",
              "value": null
            }
          },
          {
            "row": 154,
            "answer": {
              "cell": "D154",
              "value": "Нет"
            },
            "comment": {
              "cell": "E154",
              "value": null
            },
            "mark": {
              "cell": "F154",
              "value": null
            },
            "processed": {
              "cell": "G154",
              "value": null
            }
          },
          {
            "row": 155,
            "answer": {
              "cell": "D155",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E155",
              "value": null
            },
            "mark": {
              "cell": "F155",
              "value": null
            },
            "processed": {
              "cell": "G155",
              "value": null
            }
          }
        ]
      },
      "156": {
        "question": "Настроены ли автоматические оповещения по ключевым бизнес-метрикам?  \n",
        "selectedOptions": [
          "Нет"
        ],
        "comments": [
          {
            "cell": "E156",
            "value": "На текущем этапе отследивание аномалий проводится вручную с помощью дашборда в навигаторе"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 156,
            "answer": {
              "cell": "D156",
              "value": "Да"
            },
            "comment": {
              "cell": "E156",
              "value": "На текущем этапе отследивание аномалий проводится вручную с помощью дашборда в навигаторе"
            },
            "mark": {
              "cell": "F156",
              "value": null
            },
            "processed": {
              "cell": "G156",
              "value": 1
            }
          },
          {
            "row": 157,
            "answer": {
              "cell": "D157",
              "value": "Частично"
            },
            "comment": {
              "cell": "E157",
              "value": null
            },
            "mark": {
              "cell": "F157",
              "value": null
            },
            "processed": {
              "cell": "G157",
              "value": null
            }
          },
          {
            "row": 158,
            "answer": {
              "cell": "D158",
              "value": "Нет"
            },
            "comment": {
              "cell": "E158",
              "value": null
            },
            "mark": {
              "cell": "F158",
              "value": 1
            },
            "processed": {
              "cell": "G158",
              "value": null
            }
          },
          {
            "row": 159,
            "answer": {
              "cell": "D159",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E159",
              "value": null
            },
            "mark": {
              "cell": "F159",
              "value": null
            },
            "processed": {
              "cell": "G159",
              "value": null
            }
          }
        ]
      },
      "160": {
        "question": "Какие механики настроены по вашему каналу?",
        "selectedOptions": [
          "Стимулирование клиента (геймификация, пуши,Nudging механики)",
          "Nudging механики для виджетов ЕЛК и бейджа (изменение визуала, добавление анимаций)"
        ],
        "comments": [
          {
            "cell": "E165",
            "value": "На данном этапе планируем тестировать механику динамичнеского бейджа"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 160,
            "answer": {
              "cell": "D160",
              "value": "Удержание клиентов"
            },
            "comment": {
              "cell": "E160",
              "value": null
            },
            "mark": {
              "cell": "F160",
              "value": null
            },
            "processed": {
              "cell": "G160",
              "value": null
            }
          },
          {
            "row": 161,
            "answer": {
              "cell": "D161",
              "value": "Возврат клиентов"
            },
            "comment": {
              "cell": "E161",
              "value": null
            },
            "mark": {
              "cell": "F161",
              "value": null
            },
            "processed": {
              "cell": "G161",
              "value": null
            }
          },
          {
            "row": 162,
            "answer": {
              "cell": "D162",
              "value": "Персонализация интерфейса, контента и рекомендаций"
            },
            "comment": {
              "cell": "E162",
              "value": null
            },
            "mark": {
              "cell": "F162",
              "value": null
            },
            "processed": {
              "cell": "G162",
              "value": 0.5
            }
          },
          {
            "row": 163,
            "answer": {
              "cell": "D163",
              "value": "Стимулирование клиента (геймификация, пуши,Nudging механики)"
            },
            "comment": {
              "cell": "E163",
              "value": null
            },
            "mark": {
              "cell": "F163",
              "value": 1
            },
            "processed": {
              "cell": "G163",
              "value": 0.5
            }
          },
          {
            "row": 164,
            "answer": {
              "cell": "D164",
              "value": "Обучающие механики (подсказки, пошаговое знакомство и тд)"
            },
            "comment": {
              "cell": "E164",
              "value": null
            },
            "mark": {
              "cell": "F164",
              "value": null
            },
            "processed": {
              "cell": "G164",
              "value": 0.5
            }
          },
          {
            "row": 165,
            "answer": {
              "cell": "D165",
              "value": "Nudging механики для виджетов ЕЛК и бейджа (изменение визуала, добавление анимаций)"
            },
            "comment": {
              "cell": "E165",
              "value": "На данном этапе планируем тестировать механику динамичнеского бейджа"
            },
            "mark": {
              "cell": "F165",
              "value": 1
            },
            "processed": {
              "cell": "G165",
              "value": null
            }
          },
          {
            "row": 166,
            "answer": {
              "cell": "D166",
              "value": "Механика динамического бейджа для Единого личного кабинета СберID — это персонализированный визуальный элемент (иконка, цифра, текст), который отображается на аватаре или в профиле клиента и меняется в зависимости от его действий, статуса или достижений в экосистеме."
            },
            "comment": {
              "cell": "E166",
              "value": null
            },
            "mark": {
              "cell": "F166",
              "value": null
            },
            "processed": {
              "cell": "G166",
              "value": null
            }
          }
        ]
      },
      "167": {
        "question": "Как работает механика перекрестных продаж (cross-sell)?",
        "selectedOptions": [],
        "comments": [],
        "links": [],
        "sourceCells": [
          {
            "row": 175,
            "answer": {
              "cell": "D175",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E175",
              "value": null
            },
            "mark": {
              "cell": "F175",
              "value": null
            },
            "processed": {
              "cell": "G175",
              "value": null
            }
          }
        ]
      },
      "176": {
        "question": "Как работает механика удержания клиентов?",
        "selectedOptions": [
          "Создание ценности"
        ],
        "comments": [
          {
            "cell": "E176",
            "value": "Позволяем пользователю решать задачи связанные с аккаунтом Сбер ID, подпиской Прайм и бонусами Спасибо в сервисах экосистемы "
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 176,
            "answer": {
              "cell": "D176",
              "value": "Информационная комуникация"
            },
            "comment": {
              "cell": "E176",
              "value": "Позволяем пользователю решать задачи связанные с аккаунтом Сбер ID, подпиской Прайм и бонусами Спасибо в сервисах экосистемы "
            },
            "mark": {
              "cell": "F176",
              "value": null
            },
            "processed": {
              "cell": "G176",
              "value": null
            }
          },
          {
            "row": 177,
            "answer": {
              "cell": "D177",
              "value": "Создание ценности"
            },
            "comment": {
              "cell": "E177",
              "value": null
            },
            "mark": {
              "cell": "F177",
              "value": 1
            },
            "processed": {
              "cell": "G177",
              "value": 0.5
            }
          },
          {
            "row": 178,
            "answer": {
              "cell": "D178",
              "value": "Что-то еще? Напишите"
            },
            "comment": {
              "cell": "E178",
              "value": null
            },
            "mark": {
              "cell": "F178",
              "value": null
            },
            "processed": {
              "cell": "G178",
              "value": null
            }
          },
          {
            "row": 179,
            "answer": {
              "cell": "D179",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E179",
              "value": null
            },
            "mark": {
              "cell": "F179",
              "value": null
            },
            "processed": {
              "cell": "G179",
              "value": null
            }
          }
        ]
      },
      "180": {
        "question": "Как работает механика возврата клиентов?",
        "selectedOptions": [
          "Не релевантно для вашего продукта"
        ],
        "comments": [],
        "links": [],
        "sourceCells": [
          {
            "row": 180,
            "answer": {
              "cell": "D180",
              "value": "Информационная комуникация"
            },
            "comment": {
              "cell": "E180",
              "value": null
            },
            "mark": {
              "cell": "F180",
              "value": null
            },
            "processed": {
              "cell": "G180",
              "value": null
            }
          },
          {
            "row": 181,
            "answer": {
              "cell": "D181",
              "value": "Создание ценности"
            },
            "comment": {
              "cell": "E181",
              "value": null
            },
            "mark": {
              "cell": "F181",
              "value": null
            },
            "processed": {
              "cell": "G181",
              "value": null
            }
          },
          {
            "row": 182,
            "answer": {
              "cell": "D182",
              "value": "Не релевантно для вашего продукта"
            },
            "comment": {
              "cell": "E182",
              "value": null
            },
            "mark": {
              "cell": "F182",
              "value": 1
            },
            "processed": {
              "cell": "G182",
              "value": "Не релевантно для вашего продукта"
            }
          },
          {
            "row": 183,
            "answer": {
              "cell": "D183",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E183",
              "value": null
            },
            "mark": {
              "cell": "F183",
              "value": null
            },
            "processed": {
              "cell": "G183",
              "value": null
            }
          }
        ]
      },
      "184": {
        "question": "Какие методы аутентификации вы используете?",
        "selectedOptions": [],
        "comments": [],
        "links": [],
        "sourceCells": [
          {
            "row": 184,
            "answer": {
              "cell": "D184",
              "value": "Вопрос для СБЕР ID"
            },
            "comment": {
              "cell": "E184",
              "value": null
            },
            "mark": {
              "cell": "F184",
              "value": null
            },
            "processed": {
              "cell": "G184",
              "value": null
            }
          }
        ],
        "text": "Вопрос для СБЕР ID",
        "textEntries": [
          {
            "cell": "D184",
            "value": "Вопрос для СБЕР ID"
          }
        ]
      },
      "185": {
        "question": "Как работает механика регистрации новых клиентов при первом входе?",
        "selectedOptions": [],
        "comments": [],
        "links": [],
        "sourceCells": [
          {
            "row": 185,
            "answer": {
              "cell": "D185",
              "value": "Вопрос для СБЕР ID"
            },
            "comment": {
              "cell": "E185",
              "value": null
            },
            "mark": {
              "cell": "F185",
              "value": null
            },
            "processed": {
              "cell": "G185",
              "value": null
            }
          }
        ],
        "text": "Вопрос для СБЕР ID",
        "textEntries": [
          {
            "cell": "D185",
            "value": "Вопрос для СБЕР ID"
          }
        ]
      },
      "186": {
        "question": "Опишите метрики, которые вы используете для мониторинга и оценки эффективности работы механики",
        "selectedOptions": [],
        "comments": [
          {
            "cell": "E186",
            "value": "MAU, DAU, CSI"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 186,
            "answer": {
              "cell": "D186",
              "value": "MAU, DAU, CSI"
            },
            "comment": {
              "cell": "E186",
              "value": "MAU, DAU, CSI"
            },
            "mark": {
              "cell": "F186",
              "value": 1
            },
            "processed": {
              "cell": "G186",
              "value": 0.25
            }
          }
        ],
        "text": "MAU, DAU, CSI",
        "textEntries": [
          {
            "cell": "D186",
            "value": "MAU, DAU, CSI"
          }
        ]
      },
      "187": {
        "question": "Возможно ли изменить набор опций канала без IT-разработки?  ",
        "selectedOptions": [
          "Да, могу изменить набор опций канала"
        ],
        "comments": [
          {
            "cell": "E187",
            "value": "Можно менять состав и содержимое виджетов ЕЛК под каждый сервис экосистемы"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 187,
            "answer": {
              "cell": "D187",
              "value": "Нет, для всех изменений нужна IT разработка"
            },
            "comment": {
              "cell": "E187",
              "value": "Можно менять состав и содержимое виджетов ЕЛК под каждый сервис экосистемы"
            },
            "mark": {
              "cell": "F187",
              "value": null
            },
            "processed": {
              "cell": "G187",
              "value": null
            }
          },
          {
            "row": 188,
            "answer": {
              "cell": "D188",
              "value": "Да, могу изменить набор опций канала"
            },
            "comment": {
              "cell": "E188",
              "value": null
            },
            "mark": {
              "cell": "F188",
              "value": 1
            },
            "processed": {
              "cell": "G188",
              "value": null
            }
          },
          {
            "row": 189,
            "answer": {
              "cell": "D189",
              "value": "Да, могу изменить набор опций с учетом персонализация до клиенстких подсегментов"
            },
            "comment": {
              "cell": "E189",
              "value": null
            },
            "mark": {
              "cell": "F189",
              "value": null
            },
            "processed": {
              "cell": "G189",
              "value": 1
            }
          },
          {
            "row": 190,
            "answer": {
              "cell": "D190",
              "value": "Что-то еще? Напишите"
            },
            "comment": {
              "cell": "E190",
              "value": null
            },
            "mark": {
              "cell": "F190",
              "value": null
            },
            "processed": {
              "cell": "G190",
              "value": null
            }
          },
          {
            "row": 191,
            "answer": {
              "cell": "D191",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E191",
              "value": null
            },
            "mark": {
              "cell": "F191",
              "value": null
            },
            "processed": {
              "cell": "G191",
              "value": null
            }
          }
        ]
      },
      "192": {
        "question": "Какая доля задач аналитиков данных (DA) в бэклоге связана с исследованиями?",
        "selectedOptions": [
          "Меньше 20%",
          "Нет собственных аналитиков"
        ],
        "comments": [
          {
            "cell": "E192",
            "value": "Используем общий ресурс аналитиков с Сбер ID, занимаем до 20% бэклога ежеквартально"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 192,
            "answer": {
              "cell": "D192",
              "value": "Больше 80%"
            },
            "comment": {
              "cell": "E192",
              "value": "Используем общий ресурс аналитиков с Сбер ID, занимаем до 20% бэклога ежеквартально"
            },
            "mark": {
              "cell": "F192",
              "value": null
            },
            "processed": {
              "cell": "G192",
              "value": 1
            }
          },
          {
            "row": 193,
            "answer": {
              "cell": "D193",
              "value": "От 40 до 79%"
            },
            "comment": {
              "cell": "E193",
              "value": null
            },
            "mark": {
              "cell": "F193",
              "value": null
            },
            "processed": {
              "cell": "G193",
              "value": null
            }
          },
          {
            "row": 194,
            "answer": {
              "cell": "D194",
              "value": "От 20 до 39%"
            },
            "comment": {
              "cell": "E194",
              "value": null
            },
            "mark": {
              "cell": "F194",
              "value": null
            },
            "processed": {
              "cell": "G194",
              "value": null
            }
          },
          {
            "row": 195,
            "answer": {
              "cell": "D195",
              "value": "Меньше 20%"
            },
            "comment": {
              "cell": "E195",
              "value": null
            },
            "mark": {
              "cell": "F195",
              "value": 1
            },
            "processed": {
              "cell": "G195",
              "value": null
            }
          },
          {
            "row": 196,
            "answer": {
              "cell": "D196",
              "value": "Нет собственных аналитиков"
            },
            "comment": {
              "cell": "E196",
              "value": null
            },
            "mark": {
              "cell": "F196",
              "value": 1
            },
            "processed": {
              "cell": "G196",
              "value": null
            }
          },
          {
            "row": 197,
            "answer": {
              "cell": "D197",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E197",
              "value": null
            },
            "mark": {
              "cell": "F197",
              "value": null
            },
            "processed": {
              "cell": "G197",
              "value": null
            }
          }
        ]
      },
      "198": {
        "question": "Приложите ссылку на бэклог задач аналитиков данных (DA) по вашему каналу",
        "selectedOptions": [],
        "comments": [],
        "links": [
          "https://jira.sberbank.ru/browse/SID-76026?jql=component%20%3D%20%22SberID_Data%26Analytic%22%20AND%20labels%20%3D%20sberid_elk"
        ],
        "sourceCells": [
          {
            "row": 198,
            "answer": {
              "cell": "D198",
              "value": "https://jira.sberbank.ru/browse/SID-76026?jql=component%20%3D%20%22SberID_Data%26Analytic%22%20AND%20labels%20%3D%20sberid_elk",
              "hyperlink": "https://jira.sberbank.ru/browse/SID-76026?jql=component%20%3D%20%22SberID_Data%26Analytic%22%20AND%20labels%20%3D%20sberid_elk"
            },
            "comment": {
              "cell": "E198",
              "value": null
            },
            "mark": {
              "cell": "F198",
              "value": null
            },
            "processed": {
              "cell": "G198",
              "value": "https://jira.sberbank.ru/browse/SID-76026?jql=component%20%3D%20%22SberID_Data%26Analytic%22%20AND%20labels%20%3D%20sberid_elk"
            }
          }
        ],
        "text": "https://jira.sberbank.ru/browse/SID-76026?jql=component%20%3D%20%22SberID_Data%26Analytic%22%20AND%20labels%20%3D%20sberid_elk",
        "textEntries": [
          {
            "cell": "D198",
            "value": "https://jira.sberbank.ru/browse/SID-76026?jql=component%20%3D%20%22SberID_Data%26Analytic%22%20AND%20labels%20%3D%20sberid_elk"
          }
        ]
      },
      "199": {
        "question": "Какое последнее исследование вы проводили?",
        "selectedOptions": [],
        "comments": [],
        "links": [],
        "sourceCells": [
          {
            "row": 199,
            "answer": {
              "cell": "D199",
              "value": "Воронка подключения Прайм и Спасибо через ЕЛК, воронка взаимодействия с витриной Выгод через ЕЛК"
            },
            "comment": {
              "cell": "E199",
              "value": null
            },
            "mark": {
              "cell": "F199",
              "value": 1
            },
            "processed": {
              "cell": "G199",
              "value": "Воронка подключения Прайм и Спасибо через ЕЛК, воронка взаимодействия с витриной Выгод через ЕЛК"
            }
          }
        ],
        "text": "Воронка подключения Прайм и Спасибо через ЕЛК, воронка взаимодействия с витриной Выгод через ЕЛК",
        "textEntries": [
          {
            "cell": "D199",
            "value": "Воронка подключения Прайм и Спасибо через ЕЛК, воронка взаимодействия с витриной Выгод через ЕЛК"
          }
        ]
      },
      "200": {
        "question": "Ваши фокусные data driven направления на следующий квартал",
        "selectedOptions": [
          "А/В тесты",
          "Исследования/инициативы"
        ],
        "comments": [
          {
            "cell": "E200",
            "value": "АБ динамического бейджа\nИсследование кросссервисного функционала и настроек управления"
          }
        ],
        "links": [],
        "sourceCells": [
          {
            "row": 200,
            "answer": {
              "cell": "D200",
              "value": "Базовая отчетность по каналу (цели, драйверы, прогнозы)"
            },
            "comment": {
              "cell": "E200",
              "value": "АБ динамического бейджа\nИсследование кросссервисного функционала и настроек управления"
            },
            "mark": {
              "cell": "F200",
              "value": null
            },
            "processed": {
              "cell": "G200",
              "value": null
            }
          },
          {
            "row": 201,
            "answer": {
              "cell": "D201",
              "value": "Мониторинг и анализ воронок (привлечение/отток)"
            },
            "comment": {
              "cell": "E201",
              "value": null
            },
            "mark": {
              "cell": "F201",
              "value": null
            },
            "processed": {
              "cell": "G201",
              "value": null
            }
          },
          {
            "row": 202,
            "answer": {
              "cell": "D202",
              "value": "Система оповещений"
            },
            "comment": {
              "cell": "E202",
              "value": null
            },
            "mark": {
              "cell": "F202",
              "value": null
            },
            "processed": {
              "cell": "G202",
              "value": null
            }
          },
          {
            "row": 203,
            "answer": {
              "cell": "D203",
              "value": "Продуктовые механики"
            },
            "comment": {
              "cell": "E203",
              "value": null
            },
            "mark": {
              "cell": "F203",
              "value": null
            },
            "processed": {
              "cell": "G203",
              "value": null
            }
          },
          {
            "row": 204,
            "answer": {
              "cell": "D204",
              "value": "А/В тесты"
            },
            "comment": {
              "cell": "E204",
              "value": null
            },
            "mark": {
              "cell": "F204",
              "value": 1
            },
            "processed": {
              "cell": "G204",
              "value": "А/В тесты"
            }
          },
          {
            "row": 205,
            "answer": {
              "cell": "D205",
              "value": "Исследования/инициативы"
            },
            "comment": {
              "cell": "E205",
              "value": null
            },
            "mark": {
              "cell": "F205",
              "value": 1
            },
            "processed": {
              "cell": "G205",
              "value": "Исследования/инициативы"
            }
          },
          {
            "row": 206,
            "answer": {
              "cell": "D206",
              "value": "Что-то еще? Напишите"
            },
            "comment": {
              "cell": "E206",
              "value": null
            },
            "mark": {
              "cell": "F206",
              "value": null
            },
            "processed": {
              "cell": "G206",
              "value": null
            }
          },
          {
            "row": 207,
            "answer": {
              "cell": "D207",
              "value": "Затрудняюсь ответить"
            },
            "comment": {
              "cell": "E207",
              "value": null
            },
            "mark": {
              "cell": "F207",
              "value": null
            },
            "processed": {
              "cell": "G207",
              "value": null
            }
          }
        ]
      },
      "208": {
        "question": "Каких инструментов или какой поддержки не хватает вам для повышения уровня data driven вашего канала?",
        "selectedOptions": [],
        "comments": [],
        "links": [],
        "sourceCells": []
      }
    },
    "reviewFlags": [
      {
        "questionRow": 24,
        "cell": "E24",
        "value": "Не релевантно, т.к. продукт встроен нативно в сервисы экосистемы и не позиционируется как отдельная сущность"
      }
    ],
    "requiresReview": true,
    "notes": [
      "Custom Nudging option F165 is preserved in raw history, not counted as a second static mechanic.",
      "Conflicting previous Discovery choices F195 and F196 are both preserved; only the accepted Jira URL controls question exclusion."
    ]
  }
};
