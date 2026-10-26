# bond init en fluzo: elegir agentes y herramientas, y ver qué genera.
Output init.mp4
Set Shell "bash"
Set FontSize 16
Set Width 1280
Set Height 800
Set Padding 24
Set TypingSpeed 35ms
Set Theme "Catppuccin Mocha"

Hide
Type "export PS1='\[\e[35m\]\W\[\e[0m\] $ ' && /tmp/bond-demo/tapes/reset-fluzo.sh && cd /tmp/bond-demo/fluzo && clear"
Enter
Show

Type "# fluzo: un repo en Rust que ya tiene su AGENTS.md"
Enter
Sleep 500ms
Type "bond init"
Enter
Sleep 3s
# Agentes: nos quedamos con pi y Claude Code
Down
Sleep 300ms
Down
Sleep 300ms
Space
Sleep 300ms
Down
Sleep 300ms
Space
Sleep 300ms
Down
Sleep 300ms
Space
Sleep 1s
Enter
Sleep 1500ms
# Agente por defecto: pi
Enter
Sleep 2500ms
# Herramientas: fluzo ya tiene sus propias versiones de tres skills; añadimos plan-team
Down 5
Sleep 400ms
Space
Sleep 300ms
Down
Sleep 300ms
Space
Sleep 300ms
Down
Sleep 300ms
Space
Sleep 400ms
Down 5
Sleep 400ms
Space
Sleep 1500ms
Enter
Sleep 5s
Type "clear"
Enter
Type "head -7 .bond/bond.toml"
Enter
Sleep 3s
Type "git status --short"
Enter
Sleep 3s
Type "bond sync --check"
Enter
Sleep 4s
