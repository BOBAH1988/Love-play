#!/usr/bin/env python3
"""Fix check.js to use locally-defined variables for the PARENT_BACK validation."""
import re

with open('tools/check.js', 'r', encoding='utf-8') as f:
    s = f.read()

# Replace timerSrc references in the PARENT_BACK block with timerSrcLocal
# and allJs with allJsLocal
# We do targeted replacements within the block only

# First, fix the variable definitions
old_block_start = """  // Вложенные экраны игр без паузы (история, итоги): стрелка «←» и кнопка
  // «Назад»/«В меню» должны возвращать на шаг назад — в настройки игры,
  // а НЕ в хаб. Раньше каждый такой экран включил #setup вручную и не
  // снимал его .active — из-за этого после «Продолжить игру» из хаба
  // игрок видел «экран из двух частей» (хаб + настройки). Три раза
  // правили, каждый раз убирая ручное переключение в пользу вызова её
  // функции выхода (PARENT_BACK в fants-timer.js). Чтобы баг не
  // вернулся четвёртый: проверяем, что карта PARENT_BACK есть и что
  // каждый экран из неё:
  //   • есть в SETUP_ONLY_SCREENS (иначе «←» уйдёт в generic-fallback → хаб);
  //   • есть в SECTION_FOR_SCREEN (связь с группой хаба для fallback-меню);
  //   • имеет функцию выхода, которую он ссылается.
  const parentBackMatch = timerSrc.match(/const PARENT_BACK\\s*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};/);"""

new_block_start = """  // Вложенные экраны игр без паузы (история, итоги): стрелка «←» и кнопка
  // «Назад»/«В меню» должны возвращать на шаг назад — в настройки игры,
  // а НЕ в хаб. Раньше каждый такой экран включил #setup вручную и не
  // снимал его .active — из-за этого после «Продолжить игру» из хаба
  // игрок видел «экран из двух частей» (хаб + настройки). Три раза
  // правили, каждый раз убирая рубое переключение в пользу вызова её
  // функции выхода (PARENT_BACK в fants-timer.js). Чтобы баг не
  // вернулся четвёртый: проверяем, что карта PARENT_BACK есть и что
  // каждый экран из неё:
  //   • есть в SETUP_ONLY_SCREENS (иначе «←» уйдёт в generic-fallback → хаб);
  //   • имеет функцию выхода, которую он ссылается.
  const timerSrcLocal = read('games/fants-timer.js');
  const allJsLocal = fs.readdirSync(path.join(ROOT, 'games'))
    .map((f) => read(path.join('games', f))).join('\\n');
  const parentBackMatch = timerSrcLocal.match(/const PARENT_BACK\\s*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};/);"""

# Just do targeted string replacements
# Replace "timerSrc.match" with "timerSrcLocal.match" in the parentBack line
s = s.replace(
    "const parentBackMatch = timerSrc.match(/const PARENT_BACK",
    "const timerSrcLocal = read('games/fants-timer.js');\n  const allJsLocal = fs.readdirSync(path.join(ROOT, 'games'))\n    .map((f) => read(path.join('games', f))).join('\\n');\n  const parentBackMatch = timerSrcLocal.match(/const PARENT_BACK"
)

# Replace allJs with allJsLocal in the test
s = s.replace(
    ".test(allJs),",
    ".test(allJsLocal),"
)

# Replace timerSrc with timerSrcLocal in the setupOnlyBlock
s = s.replace(
    "const setupOnlyBlock = timerSrc.slice(",
    "const setupOnlyBlock = timerSrcLocal.slice("
)

with open('tools/check.js', 'w', encoding='utf-8') as f:
    f.write(s)

print("Done - replacements applied")
