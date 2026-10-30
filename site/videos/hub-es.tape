# Modo hub (castellano): bond hub init con un frontend React (submódulo) y un backend Express (symlink), bond hub check, y un orquestador pi que reparte la historia en una rama vertical con bond team (un minion pi por repo), recoge y revisa.
Output hub-es.mp4
Set Shell "bash"
Set FontSize 13
Set Width 1600
Set Height 940
Set Padding 12
Set TypingSpeed 12ms
Set Theme "Catppuccin Mocha"

Hide
Type "export BOND_HOME=/tmp/bond-demo/home PATH=/tmp/bond-demo/bin:$PATH && herdr --session bond-demo"
Enter
Sleep 4s
Type "source /tmp/bond-demo/tapes/bond-fn.zsh && cd /tmp/bond-demo/hub-demo/hub && clear"
Enter
Sleep 1s
Show

Type "bond hub init . --yes --name demo-hub file:///tmp/bond-demo/hub-demo/src/frontend.git /tmp/bond-demo/hub-demo/src/backend"
Enter
Sleep 8s
Type "clear && bond hub check && bond hub"
Enter
Sleep 7s
Type "bond"
Enter
Sleep 12s
Type "Este hub tiene un frontend (React + Vite) y un backend (Express). La historia: el frontend muestra el saludo que devuelve el backend en GET /api/hello. Abre con bond team una rama vertical feat/hello, con un agente pi en cada repo, y actúa de orquestador: tú no escribes código, repartes la tarea, esperas, recoges con bond team collect y revisas. Tienes mi OK para todo menos fusionar. Al final comprueba en los worktrees que el backend responde a /api/hello y que el frontend compila, enséñame bond team status y escribe terminado y la hora (HH:MM)."
Sleep 1s
Enter
Sleep 40s
Hide
Sleep 40s
Show
Sleep 3s
Hide
Sleep 40s
Show
Sleep 3s
Hide
Sleep 40s
Show
Sleep 3s
Hide
Sleep 40s
Show
Sleep 3s
Hide
Sleep 40s
Show
Sleep 3s
Hide
Sleep 40s
Show
Sleep 3s
Hide
Sleep 40s
Show
Sleep 3s
Hide
Sleep 40s
Show
Sleep 3s
Wait+Screen@600s /[Tt]erminado\W*\d\d:\d\d/
Sleep 12s
