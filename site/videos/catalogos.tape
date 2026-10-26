# Catálogos del equipo: crear uno, añadirlo a fluzo y verlo en bond init y bond doctor.
Output catalogos.mp4
Set Shell "bash"
Set FontSize 17
Set Width 1280
Set Height 760
Set Padding 24
Set TypingSpeed 35ms
Set Theme "Catppuccin Mocha"

Hide
Type "export PS1='\[\e[35m\]\W\[\e[0m\] $ ' GIT_AUTHOR_NAME=Equipo GIT_AUTHOR_EMAIL=equipo@example.com GIT_COMMITTER_NAME=Equipo GIT_COMMITTER_EMAIL=equipo@example.com"
Enter
Type "/tmp/bond-demo/tapes/reset-fluzo.sh init && rm -rf /tmp/bond-demo/skills-equipo && mkdir -p /tmp/bond-demo/skills-equipo && cd /tmp/bond-demo/skills-equipo && git init -q -b main && clear"
Enter
Show

Type "# Un repo nuevo para el catálogo del equipo"
Enter
Sleep 500ms
Type "bond catalog create --name equipo"
Enter
Sleep 2s
Type "ls -R | head -12"
Enter
Sleep 2s

Hide
Type "mkdir -p skills/revisar-migraciones && printf -- '---\nname: revisar-migraciones\ndescription: Revisar una migración de base de datos antes de aplicarla. Úsalo al tocar migrations/.\n---\n\n# Revisar migraciones\n\nBloqueos, datos que se pierden y cómo volver atrás.\n' > skills/revisar-migraciones/SKILL.md && clear"
Enter
Show
Type "# Añadimos una skill del equipo y comprobamos el catálogo"
Enter
Type "cat skills/revisar-migraciones/SKILL.md"
Enter
Sleep 2s
Type "bond catalog check"
Enter
Sleep 2s
Type "git add -A && git commit -qm 'Catálogo del equipo' && git tag v1"
Enter
Sleep 1s
Type "clear"
Enter

Type "# Ahora, en fluzo: lo declaramos con el commit fijado"
Enter
Type "cd ../fluzo"
Enter
Type "bond catalog add file:///tmp/bond-demo/skills-equipo --ref v1 --yes"
Enter
Sleep 4s
Type "bond catalog list"
Enter
Sleep 2s
Type "bond init --list | grep equipo"
Enter
Sleep 3s
Type "bond doctor --quick 2>&1 | grep catálogo"
Enter
Sleep 8s
