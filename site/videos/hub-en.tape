# Hub mode (English): bond hub init with a React frontend (submodule) and an Express backend (symlink), bond hub check, and a pi orchestrator that splits the story into a vertical branch with bond team (one pi minion per repo), collects and reviews.
Output hub-en.mp4
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
Type "This is an English demo: answer only in English, and write every task you send to the agents in English, telling them to answer in English too. This hub has a frontend (React + Vite) and a backend (Express). The story: the frontend shows the greeting the backend returns at GET /api/hello. Open a vertical branch feat/hello with bond team, one pi agent per repo, and act as the orchestrator: you do not write code, you hand out the task, wait, collect with bond team collect and review. You have my OK for everything except merging. At the end check in the worktrees that the backend answers /api/hello and the frontend builds, show me bond team status and write finished and the time (HH:MM)."
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
Wait+Screen@600s /[Ff]inished\W*\d\d:\d\d/
Sleep 12s
