# Claude orquesta: una sola instrucción, plan y reparto entre dos minions pi con bond team, la
# tabla en vivo, revisión, integración en main y limpieza del equipo. Todo dentro de bond.
Output orquestador.mp4
Set Shell "bash"
Set FontSize 13
Set Width 1600
Set Height 940
Set Padding 12
Set TypingSpeed 12ms
Set Theme "Catppuccin Mocha"

Hide
Type "herdr --session bond-demo"
Enter
Sleep 4s
Type "export PATH=/tmp/bond-demo/bin:$PATH && cd /tmp/bond-demo/web && clear"
Enter
Sleep 1s
Show
Type "bond"
Enter
Sleep 12s
Type "Quiero una web muy sencilla para un club de lectura, solo HTML sin estilos: una portada (index.html) y una página de contacto (contacto.html) con un formulario, enlazadas entre sí. Haz un plan, reparte el trabajo entre 2 agentes pi con bond team y actúa de orquestador: tú no escribes las páginas, coordinas y revisas. Tienes mi OK para el reparto; cuando las dos ramas estén listas, intégralas en main y limpia el equipo."
Sleep 1s
Enter
Wait+Screen@420s /done \d\d:\d\d/
Sleep 12s
