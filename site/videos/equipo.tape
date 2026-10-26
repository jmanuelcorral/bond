# Un equipo de agentes: dos ramas de fluzo, un minion pi en cada una, la tabla en vivo y el estado.
Output equipo.mp4
Set Shell "bash"
Set FontSize 14
Set Width 1500
Set Height 880
Set Padding 16
Set TypingSpeed 30ms
Set Theme "Catppuccin Mocha"

Hide
Type "herdr --session bond-demo"
Enter
Sleep 4s
Type "source /tmp/bond-demo/tapes/bond-fn.zsh && cd /tmp/bond-demo/fluzo && clear"
Enter
Sleep 1s
Show

Type "bond team demo/contributing demo/quickstart --base main"
Enter
Sleep 12s
Type "bond team prompt demo/contributing 'At the top of CONTRIBUTING.md, add one short line pointing agents to AGENTS.md for the project conventions. Then commit.'"
Enter
Sleep 2s
Type "bond team prompt demo/quickstart 'At the top of QUICKSTART.md, add one short line pointing to README.md for the project overview. Then commit.'"
Enter
Sleep 10s
Hide
Sleep 120s
Show
Sleep 5s
Type "clear && bond team status"
Enter
Sleep 8s
